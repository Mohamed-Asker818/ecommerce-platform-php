<?php
session_start();
require_once '../Model/db.php';

header('Content-Type: application/json; charset=utf-8');
error_reporting(E_ALL);
ini_set('display_errors', 1);

class MyOrdersAPI {
    private $conn;
    private $userId;
    
    public function __construct($conn, $userId) {
        $this->conn = $conn;
        $this->userId = $userId;
    }
    
    public function handleRequest() {
        $action = isset($_GET['action']) ? $_GET['action'] : '';
        
        switch ($action) {
            case 'get_orders':
                return $this->getOrders();
            case 'get_order_details':
                return $this->getOrderDetails();
            case 'cancel_order':
                return $this->cancelOrder();
            case 'repeat_order':
                return $this->repeatOrder();
            default:
                return $this->errorResponse('طلب غير معروف');
        }
    }
    
    private function getOrders() {
        try {
            $page = isset($_GET['page']) ? max(1, (int)$_GET['page']) : 1;
            $limit = isset($_GET['limit']) ? max(1, min(50, (int)$_GET['limit'])) : 10;
            $offset = ($page - 1) * $limit;
            
            $status = isset($_GET['status']) ? $_GET['status'] : null;
            
            $query = "SELECT SQL_CALC_FOUND_ROWS 
                      o.*, 
                      COUNT(oi.id) as items_count
                      FROM orders o
                      LEFT JOIN order_items oi ON o.id = oi.order_id
                      WHERE o.user_id = ?";
            
            $params = [$this->userId];
            $paramTypes = "i";
            
            if ($status && $status !== 'all') {
                $query .= " AND o.status = ?";
                $params[] = $status;
                $paramTypes .= "s";
            }
            
            $query .= " GROUP BY o.id ORDER BY o.created_at DESC LIMIT ? OFFSET ?";
            $params[] = $limit;
            $params[] = $offset;
            $paramTypes .= "ii";
            
            $stmt = $this->conn->prepare($query);
            if (!$stmt) {
                throw new Exception('فشل في إعداد الاستعلام: ' . $this->conn->error);
            }
            
            $stmt->bind_param($paramTypes, ...$params);
            if (!$stmt->execute()) {
                throw new Exception('فشل في تنفيذ الاستعلام: ' . $stmt->error);
            }
            
            $result = $stmt->get_result();
            
            $orders = [];
            while ($row = $result->fetch_assoc()) {
                $orders[] = $this->formatOrder($row);
            }
            
            $totalResult = $this->conn->query("SELECT FOUND_ROWS() as total");
            $totalRow = $totalResult->fetch_assoc();
            $total = $totalRow['total'];
            
            $stats = $this->getOrderStats();
            
            return [
                'success' => true,
                'orders' => $orders,
                'pagination' => [
                    'page' => $page,
                    'limit' => $limit,
                    'total' => $total,
                    'pages' => ceil($total / $limit)
                ],
                'stats' => $stats,
                'filters' => [
                    'status' => $status
                ]
            ];
            
        } catch (Exception $e) {
            return $this->errorResponse('حدث خطأ في جلب الطلبات: ' . $e->getMessage());
        }
    }
    
    private function getOrderDetails() {
        $orderId = isset($_GET['order_id']) ? (int)$_GET['order_id'] : 0;
        
        if ($orderId <= 0) {
            return $this->errorResponse('رقم الطلب غير صالح');
        }
        
        try {
            $order = $this->getOrderById($orderId);
            if (!$order) {
                return $this->errorResponse('الطلب غير موجود أو لا تملك صلاحية الوصول');
            }
            
            $items = $this->getOrderItems($orderId);
            
            $timeline = $this->getOrderTimeline($orderId, $order);
            
            $shipping = $this->getShippingInfo($orderId);
            
            return [
                'success' => true,
                'order' => $order,
                'items' => $items,
                'timeline' => $timeline,
                'shipping' => $shipping
            ];
            
        } catch (Exception $e) {
            return $this->errorResponse('حدث خطأ في جلب تفاصيل الطلب: ' . $e->getMessage());
        }
    }
    
    private function cancelOrder() {
        $orderId = isset($_POST['order_id']) ? (int)$_POST['order_id'] : 0;
        $reason = isset($_POST['reason']) ? trim($_POST['reason']) : '';
        
        if ($orderId <= 0) {
            return $this->errorResponse('رقم الطلب غير صالح');
        }
        
        $this->conn->begin_transaction();
        
        try {
            $order = $this->getOrderById($orderId);
            if (!$order) {
                throw new Exception('الطلب غير موجود أو لا تملك صلاحية الوصول');
            }
            
            if (!in_array($order['status'], ['pending', 'processing'])) {
                throw new Exception('لا يمكن إلغاء الطلب في مرحلته الحالية');
            }
            
            $query = "UPDATE orders SET status = 'cancelled', cancelled_at = NOW(), 
                      cancellation_reason = ? WHERE id = ? AND user_id = ?";
            $stmt = $this->conn->prepare($query);
            $stmt->bind_param('sii', $reason, $orderId, $this->userId);
            
            if (!$stmt->execute()) {
                throw new Exception('فشل تحديث حالة الطلب');
            }
            
            $this->restoreOrderStock($orderId);
            
            $this->logOrderActivity($orderId, 'cancelled', $reason);
            
            $this->conn->commit();
            
            return [
                'success' => true,
                'message' => 'تم إلغاء الطلب بنجاح',
                'order_id' => $orderId
            ];
            
        } catch (Exception $e) {
            $this->conn->rollback();
            return $this->errorResponse($e->getMessage());
        }
    }
    
    private function repeatOrder() {
        $orderId = isset($_POST['order_id']) ? (int)$_POST['order_id'] : 0;
        
        if ($orderId <= 0) {
            return $this->errorResponse('رقم الطلب غير صالح');
        }
        
        try {
            $query = "SELECT product_id, quantity FROM order_items WHERE order_id = ?";
            $stmt = $this->conn->prepare($query);
            $stmt->bind_param('i', $orderId);
            $stmt->execute();
            $result = $stmt->get_result();
            
            $addedCount = 0;
            $failedItems = [];
            
            while ($row = $result->fetch_assoc()) {
                $productId = (int)$row['product_id'];
                $quantity = (int)$row['quantity'];
                
                $product = $this->getProductInfo($productId);
                if (!$product) {
                    $failedItems[] = "المنتج غير موجود (ID: $productId)";
                    continue;
                }
                
                if ($product['stock'] < $quantity) {
                    $failedItems[] = "الكمية غير متوفرة للمنتج: {$product['name']}";
                    continue;
                }
                
                if ($this->addToCart($productId, $quantity)) {
                    $addedCount++;
                } else {
                    $failedItems[] = "فشل إضافة المنتج: {$product['name']}";
                }
            }
            
            if ($addedCount > 0) {
                $message = "تم إضافة $addedCount منتج إلى سلة المشتريات";
                if (!empty($failedItems)) {
                    $message .= ". فشل إضافة بعض المنتجات: " . implode(', ', $failedItems);
                }
                
                return [
                    'success' => true,
                    'message' => $message,
                    'added_count' => $addedCount,
                    'failed_items' => $failedItems
                ];
            } else {
                return $this->errorResponse('فشل إضافة أي منتج إلى السلة');
            }
            
        } catch (Exception $e) {
            return $this->errorResponse('حدث خطأ في إعادة الطلب: ' . $e->getMessage());
        }
    }
    
    private function formatOrder($row) {
        $status = $row['status'] ?? 'pending';
        $statusInfo = $this->getStatusInfo($status);
        $paymentInfo = $this->getPaymentInfo($row['payment_method'] ?? 'cod', $row['payment_status'] ?? 'pending');
        
        return [
            'id' => (int)$row['id'],
            'order_number' => $this->generateOrderNumber($row['id']),
            'total' => (float)($row['total'] ?? 0),
            'formatted_total' => number_format($row['total'] ?? 0, 2),
            'status' => $status,
            'status_name' => $statusInfo['name'],
            'status_icon' => $statusInfo['icon'],
            'status_color' => $statusInfo['color'],
            'status_class' => $statusInfo['class'],
            'payment_method' => $paymentInfo['method_name'],
            'payment_status' => $paymentInfo['status_name'],
            'items_count' => (int)($row['items_count'] ?? 0),
            'created_at' => $this->formatDate($row['created_at'] ?? date('Y-m-d H:i:s')),
            'created_at_raw' => $row['created_at'] ?? date('Y-m-d H:i:s'),
            'customer_name' => htmlspecialchars($row['customer_name'] ?? ''),
            'address' => htmlspecialchars($row['address'] ?? ''),
            'phone' => htmlspecialchars($row['phone'] ?? ''),
            'can_cancel' => in_array($status, ['pending', 'processing']),
            'can_repeat' => true,
            'has_shipping' => !empty($row['tracking_number'] ?? '')
        ];
    }
    
    private function getOrderById($orderId) {
        $query = "SELECT * FROM orders WHERE id = ? AND user_id = ? LIMIT 1";
        $stmt = $this->conn->prepare($query);
        $stmt->bind_param('ii', $orderId, $this->userId);
        $stmt->execute();
        $result = $stmt->get_result();
        
        if ($row = $result->fetch_assoc()) {
            return $this->formatOrder($row);
        }
        
        return null;
    }
    
    private function getOrderItems($orderId) {
        $query = "SELECT oi.*, p.image, p.stock as current_stock
                  FROM order_items oi
                  LEFT JOIN products p ON oi.product_id = p.id
                  WHERE oi.order_id = ?";
        
        $stmt = $this->conn->prepare($query);
        $stmt->bind_param('i', $orderId);
        $stmt->execute();
        $result = $stmt->get_result();
        
        $items = [];
        while ($row = $result->fetch_assoc()) {
            $subtotal = (float)$row['price'] * (int)$row['quantity'];
            
            $items[] = [
                'product_id' => (int)$row['product_id'],
                'product_name' => htmlspecialchars($row['product_name'] ?? ''),
                'image' => $row['image'] ?: 'default.jpg',
                'price' => (float)$row['price'],
                'formatted_price' => number_format($row['price'] ?? 0, 2),
                'quantity' => (int)$row['quantity'],
                'subtotal' => $subtotal,
                'formatted_subtotal' => number_format($subtotal, 2),
                'current_stock' => (int)($row['current_stock'] ?? 0),
                'is_available' => (($row['current_stock'] ?? 0) > 0)
            ];
        }
        
        return $items;
    }
    
    private function getOrderTimeline($orderId, $order = null) {
        try {
            $checkTable = $this->conn->query("SHOW TABLES LIKE 'order_timeline'");
            if ($checkTable->num_rows == 0) {
                if (!$order) {
                    $order = $this->getOrderById($orderId);
                }
                return $order ? $this->generateDefaultTimeline($order) : [];
            }
            
            $query = "SELECT * FROM order_timeline WHERE order_id = ? ORDER BY created_at ASC";
            $stmt = $this->conn->prepare($query);
            if (!$stmt) {
                throw new Exception('فشل في إعداد استعلام الجدول الزمني');
            }
            
            $stmt->bind_param('i', $orderId);
            if (!$stmt->execute()) {
                throw new Exception('فشل في تنفيذ استعلام الجدول الزمني');
            }
            
            $result = $stmt->get_result();
            
            $timeline = [];
            while ($row = $result->fetch_assoc()) {
                $timeline[] = [
                    'status' => $row['status'],
                    'description' => htmlspecialchars($row['description'] ?? ''),
                    'created_at' => $this->formatDate($row['created_at']),
                    'icon' => $this->getTimelineIcon($row['status'])
                ];
            }
            
            if (empty($timeline)) {
                if (!$order) {
                    $order = $this->getOrderById($orderId);
                }
                $timeline = $order ? $this->generateDefaultTimeline($order) : [];
            }
            
            return $timeline;
            
        } catch (Exception $e) {
            if (!$order) {
                $order = $this->getOrderById($orderId);
            }
            return $order ? $this->generateDefaultTimeline($order) : [];
        }
    }
    
    private function getShippingInfo($orderId) {
        try {
            $checkTable = $this->conn->query("SHOW TABLES LIKE 'order_shipping'");
            if ($checkTable->num_rows == 0) {
                return null;
            }
            
            $query = "SELECT tracking_number, carrier, estimated_delivery, 
                             actual_delivery, shipping_address
                      FROM order_shipping WHERE order_id = ? LIMIT 1";
            $stmt = $this->conn->prepare($query);
            if (!$stmt) {
                return null;
            }
            
            $stmt->bind_param('i', $orderId);
            if (!$stmt->execute()) {
                return null;
            }
            
            $result = $stmt->get_result();
            
            if ($row = $result->fetch_assoc()) {
                return [
                    'tracking_number' => htmlspecialchars($row['tracking_number'] ?? ''),
                    'carrier' => htmlspecialchars($row['carrier'] ?? ''),
                    'estimated_delivery' => $this->formatDate($row['estimated_delivery'] ?? ''),
                    'actual_delivery' => $this->formatDate($row['actual_delivery'] ?? ''),
                    'shipping_address' => htmlspecialchars($row['shipping_address'] ?? '')
                ];
            }
            
            return null;
            
        } catch (Exception $e) {
            return null;
        }
    }
    
    private function getOrderStats() {
        $stats = [];
        
        try {
            $query = "SELECT COUNT(*) as total FROM orders WHERE user_id = ?";
            $stmt = $this->conn->prepare($query);
            $stmt->bind_param('i', $this->userId);
            $stmt->execute();
            $result = $stmt->get_result();
            $row = $result->fetch_assoc();
            $stats['total_orders'] = (int)($row['total'] ?? 0);
            
            $query = "SELECT SUM(total) as total_spent FROM orders 
                      WHERE user_id = ? AND payment_status = 'paid'";
            $stmt = $this->conn->prepare($query);
            $stmt->bind_param('i', $this->userId);
            $stmt->execute();
            $result = $stmt->get_result();
            $row = $result->fetch_assoc();
            $stats['total_spent'] = (float)($row['total_spent'] ?? 0);
            $stats['formatted_total_spent'] = number_format($stats['total_spent'], 2);
            
            $query = "SELECT status, COUNT(*) as count FROM orders 
                      WHERE user_id = ? GROUP BY status";
            $stmt = $this->conn->prepare($query);
            $stmt->bind_param('i', $this->userId);
            $stmt->execute();
            $result = $stmt->get_result();
            
            $stats['by_status'] = [];
            while ($row = $result->fetch_assoc()) {
                $stats['by_status'][$row['status']] = (int)$row['count'];
            }
            
            $query = "SELECT COUNT(*) as recent_orders FROM orders 
                      WHERE user_id = ? AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)";
            $stmt = $this->conn->prepare($query);
            $stmt->bind_param('i', $this->userId);
            $stmt->execute();
            $result = $stmt->get_result();
            $row = $result->fetch_assoc();
            $stats['recent_orders'] = (int)($row['recent_orders'] ?? 0);
            
        } catch (Exception $e) {
            $stats = [
                'total_orders' => 0,
                'total_spent' => 0,
                'formatted_total_spent' => '0.00',
                'by_status' => [],
                'recent_orders' => 0
            ];
        }
        
        return $stats;
    }
    
    private function getStatusInfo($status) {
        $statuses = [
            'pending' => [
                'name' => 'قيد الانتظار',
                'icon' => '⏳',
                'color' => '#FF9800',
                'class' => 'pending'
            ],
            'processing' => [
                'name' => 'قيد المعالجة',
                'icon' => '⚙️',
                'color' => '#2196F3',
                'class' => 'processing'
            ],
            'shipped' => [
                'name' => 'تم الشحن',
                'icon' => '🚚',
                'color' => '#4CAF50',
                'class' => 'shipped'
            ],
            'delivered' => [
                'name' => 'تم التسليم',
                'icon' => '📦',
                'color' => '#2E7D32',
                'class' => 'delivered'
            ],
            'completed' => [
                'name' => 'مكتمل',
                'icon' => '✅',
                'color' => '#9C27B0',
                'class' => 'completed'
            ],
            'cancelled' => [
                'name' => 'ملغي',
                'icon' => '❌',
                'color' => '#F44336',
                'class' => 'cancelled'
            ]
        ];
        
        return isset($statuses[$status]) ? $statuses[$status] : [
            'name' => $status,
            'icon' => '❓',
            'color' => '#757575',
            'class' => 'unknown'
        ];
    }
    
    private function getPaymentInfo($method, $status) {
        $methods = [
            'card' => '💳 بطاقة ائتمان',
            'paypal' => '💰 PayPal',
            'wallet' => '📱 محفظة إلكترونية',
            'cod' => '📦 الدفع عند الاستلام'
        ];
        
        $statuses = [
            'pending' => '⏳ قيد الانتظار',
            'paid' => '✅ مدفوع',
            'failed' => '❌ فشل الدفع',
            'refunded' => '↩️ تم الاسترداد',
            'cod' => '📦 عند الاستلام'
        ];
        
        return [
            'method_name' => isset($methods[$method]) ? $methods[$method] : $method,
            'status_name' => isset($statuses[$status]) ? $statuses[$status] : $status
        ];
    }
    
    private function generateOrderNumber($orderId) {
        return 'ORD-' . str_pad($orderId, 6, '0', STR_PAD_LEFT);
    }
    
    private function formatDate($date) {
        if (empty($date) || $date == '0000-00-00 00:00:00') return '';
        
        $timestamp = strtotime($date);
        if ($timestamp === false) return '';
        
        $formatted = date('Y-m-d H:i', $timestamp);
        
        // Add Arabic month names
        $arabicMonths = [
            'January' => 'يناير', 'February' => 'فبراير', 'March' => 'مارس',
            'April' => 'أبريل', 'May' => 'مايو', 'June' => 'يونيو',
            'July' => 'يوليو', 'August' => 'أغسطس', 'September' => 'سبتمبر',
            'October' => 'أكتوبر', 'November' => 'نوفمبر', 'December' => 'ديسمبر'
        ];
        
        $englishMonth = date('F', $timestamp);
        if (isset($arabicMonths[$englishMonth])) {
            $formatted = date('d', $timestamp) . ' ' . $arabicMonths[$englishMonth] . ' ' . date('Y H:i', $timestamp);
        }
        
        return $formatted;
    }
    
    private function getTimelineIcon($status) {
        $icons = [
            'created' => '📝',
            'payment_received' => '💰',
            'processing' => '⚙️',
            'shipped' => '🚚',
            'delivered' => '📦',
            'completed' => '✅',
            'cancelled' => '❌'
        ];
        
        return isset($icons[$status]) ? $icons[$status] : '📌';
    }
    
    private function generateDefaultTimeline($order) {
        $timeline = [];
        
        $timeline[] = [
            'status' => 'created',
            'description' => 'تم إنشاء الطلب',
            'created_at' => $order['created_at'],
            'icon' => '📝'
        ];
        
        if ($order['status'] !== 'pending') {
            $timeline[] = [
                'status' => 'payment_received',
                'description' => 'تم استلام الدفع',
                'created_at' => $order['created_at'],
                'icon' => '💰'
            ];
        }
        
        if (in_array($order['status'], ['processing', 'shipped', 'delivered', 'completed'])) {
            $timeline[] = [
                'status' => 'processing',
                'description' => 'جارٍ تجهيز الطلب',
                'created_at' => $order['created_at'],
                'icon' => '⚙️'
            ];
        }
        
        if (in_array($order['status'], ['shipped', 'delivered', 'completed'])) {
            $timeline[] = [
                'status' => 'shipped',
                'description' => 'تم شحن الطلب',
                'created_at' => $order['created_at'],
                'icon' => '🚚'
            ];
        }
        
        if (in_array($order['status'], ['delivered', 'completed'])) {
            $timeline[] = [
                'status' => 'delivered',
                'description' => 'تم تسليم الطلب',
                'created_at' => $order['created_at'],
                'icon' => '📦'
            ];
        }
        
        if ($order['status'] === 'completed') {
            $timeline[] = [
                'status' => 'completed',
                'description' => 'اكتمل الطلب',
                'created_at' => $order['created_at'],
                'icon' => '✅'
            ];
        }
        
        if ($order['status'] === 'cancelled') {
            $timeline[] = [
                'status' => 'cancelled',
                'description' => 'تم إلغاء الطلب',
                'created_at' => $order['created_at'],
                'icon' => '❌'
            ];
        }
        
        return $timeline;
    }
    
    private function restoreOrderStock($orderId) {
        $query = "UPDATE products p
                  JOIN order_items oi ON p.id = oi.product_id
                  SET p.stock = p.stock + oi.quantity
                  WHERE oi.order_id = ?";
        
        $stmt = $this->conn->prepare($query);
        $stmt->bind_param('i', $orderId);
        $stmt->execute();
    }
    
    private function logOrderActivity($orderId, $action, $details = '') {
        $checkTable = $this->conn->query("SHOW TABLES LIKE 'order_activity'");
        if ($checkTable->num_rows == 0) {
            return;
        }
        
        $query = "INSERT INTO order_activity (order_id, action, details, created_at) 
                  VALUES (?, ?, ?, NOW())";
        $stmt = $this->conn->prepare($query);
        $stmt->bind_param('iss', $orderId, $action, $details);
        $stmt->execute();
    }
    
    private function getProductInfo($productId) {
        $query = "SELECT name, stock FROM products WHERE id = ? AND status = 'active' LIMIT 1";
        $stmt = $this->conn->prepare($query);
        $stmt->bind_param('i', $productId);
        $stmt->execute();
        $result = $stmt->get_result();
        
        if ($row = $result->fetch_assoc()) {
            return [
                'name' => $row['name'],
                'stock' => (int)$row['stock']
            ];
        }
        
        return null;
    }
    
    private function addToCart($productId, $quantity) {
        $query = "SELECT quantity FROM user_cart 
                  WHERE user_id = ? AND product_id = ? LIMIT 1";
        $stmt = $this->conn->prepare($query);
        $stmt->bind_param('ii', $this->userId, $productId);
        $stmt->execute();
        $result = $stmt->get_result();
        
        if ($row = $result->fetch_assoc()) {
            $query = "UPDATE user_cart SET quantity = quantity + ? 
                      WHERE user_id = ? AND product_id = ?";
            $stmt = $this->conn->prepare($query);
            $stmt->bind_param('iii', $quantity, $this->userId, $productId);
        } else {
            $query = "INSERT INTO user_cart (user_id, product_id, quantity) 
                      VALUES (?, ?, ?)";
            $stmt = $this->conn->prepare($query);
            $stmt->bind_param('iii', $this->userId, $productId, $quantity);
        }
        
        return $stmt->execute();
    }
    
    private function errorResponse($message) {
        return [
            'success' => false,
            'message' => $message
        ];
    }
}

try {
    if (!isset($_SESSION['user_id'])) {
        echo json_encode(['success' => false, 'message' => 'يجب تسجيل الدخول']);
        exit;
    }
    
    $userId = (int)$_SESSION['user_id'];
    $myOrdersAPI = new MyOrdersAPI($conn, $userId);
    $response = $myOrdersAPI->handleRequest();
    
    echo json_encode($response, JSON_UNESCAPED_UNICODE);
    
} catch (Exception $e) {
    echo json_encode([
        'success' => false,
        'message' => 'حدث خطأ غير متوقع: ' . $e->getMessage()
    ], JSON_UNESCAPED_UNICODE);
} finally {
    if (isset($conn)) {
        $conn->close();
    }
}
?>
