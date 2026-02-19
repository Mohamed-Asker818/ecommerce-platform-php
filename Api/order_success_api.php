<?php
class OrderSuccess {
    private $conn;
    private $userId;
    private $orderId;
    
    public function __construct($conn, $userId, $orderId) {
        $this->conn = $conn;
        $this->userId = $userId;
        $this->orderId = $orderId;
    }
    
    public function getOrderData() {
        try {
            $order = $this->getOrderDetails();
            if (!$order) {
                return null;
            }
            
            $items = $this->getOrderItems();
            
            $totals = $this->calculateTotals($items);
            
            $statusInfo = $this->getStatusInfo($order['status']);
            
            $shippingInfo = $this->getShippingInfo($order);
            
            return [
                'order' => $order,
                'items' => $items,
                'totals' => $totals,
                'status_info' => $statusInfo,
                'shipping_info' => $shippingInfo,
                'user_id' => $this->userId
            ];
            
        } catch (Exception $e) {
            error_log("OrderSuccess Error: " . $e->getMessage());
            return null;
        }
    }
    
    private function getOrderDetails() {
        $query = "SELECT o.*, 
                  u.name as user_name, 
                  u.email as user_email,
                  u.phone as user_phone
                  FROM orders o
                  LEFT JOIN users u ON o.user_id = u.id
                  WHERE o.id = ? AND o.user_id = ? 
                  LIMIT 1";
        
        $stmt = $this->conn->prepare($query);
        $stmt->bind_param('ii', $this->orderId, $this->userId);
        $stmt->execute();
        $result = $stmt->get_result();
        $order = $result->fetch_assoc();
        $stmt->close();
        
        if (!$order) {
            return null;
        }
        
        return [
            'id' => (int)$order['id'],
            'order_number' => $this->generateOrderNumber($order['id']),
            'customer_name' => htmlspecialchars($order['customer_name']),
            'user_name' => htmlspecialchars($order['user_name']),
            'user_email' => htmlspecialchars($order['user_email']),
            'user_phone' => htmlspecialchars($order['user_phone']),
            'address' => htmlspecialchars($order['address']),
            'phone' => htmlspecialchars($order['phone']),
            'total' => (float)$order['total'],
            'payment_method' => $this->getPaymentMethodName($order['payment_method']),
            'payment_status' => $this->getPaymentStatusName($order['payment_status']),
            'status' => $order['status'],
            'status_name' => $this->getStatusName($order['status']),
            'created_at' => $this->formatDate($order['created_at']),
            'created_at_raw' => $order['created_at'],
            'notes' => !empty($order['notes']) ? htmlspecialchars($order['notes']) : null
        ];
    }
    
    private function getOrderItems() {
        $query = "SELECT oi.*, p.image as product_image
                  FROM order_items oi
                  LEFT JOIN products p ON oi.product_id = p.id
                  WHERE oi.order_id = ?";
        
        $stmt = $this->conn->prepare($query);
        $stmt->bind_param('i', $this->orderId);
        $stmt->execute();
        $result = $stmt->get_result();
        
        $items = [];
        while ($row = $result->fetch_assoc()) {
            $subtotal = (float)$row['price'] * (int)$row['quantity'];
            
            $items[] = [
                'product_id' => (int)$row['product_id'],
                'product_name' => htmlspecialchars($row['product_name']),
                'image' => $row['product_image'] ?: 'default.jpg',
                'price' => (float)$row['price'],
                'quantity' => (int)$row['quantity'],
                'subtotal' => $subtotal,
                'formatted_price' => number_format($row['price'], 2),
                'formatted_subtotal' => number_format($subtotal, 2)
            ];
        }
        
        $stmt->close();
        return $items;
    }
    
    private function calculateTotals($items) {
        $subtotal = 0;
        foreach ($items as $item) {
            $subtotal += $item['subtotal'];
        }
        
        $shipping = 0;
        $tax = 0;
        $total = $subtotal + $shipping + $tax;
        
        return [
            'subtotal' => $subtotal,
            'shipping' => $shipping,
            'tax' => $tax,
            'total' => $total,
            'formatted_subtotal' => number_format($subtotal, 2),
            'formatted_shipping' => number_format($shipping, 2),
            'formatted_tax' => number_format($tax, 2),
            'formatted_total' => number_format($total, 2)
        ];
    }
    
    private function getStatusInfo($status) {
        $statuses = [
            'pending' => [
                'name' => 'قيد الانتظار',
                'icon' => '⏳',
                'color' => '#FF9800',
                'description' => 'طلبك قيد المراجعة',
                'next_steps' => ['processing', 'cancelled']
            ],
            'processing' => [
                'name' => 'قيد المعالجة',
                'icon' => '⚙️',
                'color' => '#2196F3',
                'description' => 'جارٍ تحضير طلبك',
                'next_steps' => ['shipped', 'cancelled']
            ],
            'shipped' => [
                'name' => 'تم الشحن',
                'icon' => '🚚',
                'color' => '#4CAF50',
                'description' => 'تم شحن طلبك',
                'next_steps' => ['delivered']
            ],
            'delivered' => [
                'name' => 'تم التسليم',
                'icon' => '✅',
                'color' => '#2E7D32',
                'description' => 'تم تسليم طلبك',
                'next_steps' => ['completed']
            ],
            'completed' => [
                'name' => 'مكتمل',
                'icon' => '🎉',
                'color' => '#9C27B0',
                'description' => 'اكتمل طلبك بنجاح',
                'next_steps' => []
            ],
            'cancelled' => [
                'name' => 'ملغي',
                'icon' => '❌',
                'color' => '#F44336',
                'description' => 'تم إلغاء الطلب',
                'next_steps' => []
            ]
        ];
        
        return isset($statuses[$status]) ? $statuses[$status] : [
            'name' => $status,
            'icon' => '❓',
            'color' => '#757575',
            'description' => 'حالة غير معروفة',
            'next_steps' => []
        ];
    }
    
    private function getShippingInfo($order) {
        return [
            'method' => 'توصيل سريع',
            'estimated_delivery' => $this->calculateDeliveryDate($order['created_at_raw']),
            'tracking_number' => $this->generateTrackingNumber($order['id']),
            'carrier' => 'شركة الشحن السريع'
        ];
    }
    
    private function generateOrderNumber($orderId) {
        return 'ORD-' . str_pad($orderId, 6, '0', STR_PAD_LEFT);
    }
    
    private function getPaymentMethodName($method) {
        $methods = [
            'card' => '💳 بطاقة ائتمان',
            'paypal' => '💰 PayPal',
            'wallet' => '📱 محفظة إلكترونية',
            'cod' => '📦 الدفع عند الاستلام'
        ];
        
        return isset($methods[$method]) ? $methods[$method] : $method;
    }
    
    private function getPaymentStatusName($status) {
        $statuses = [
            'pending' => '⏳ قيد الانتظار',
            'paid' => '✅ مدفوع',
            'failed' => '❌ فشل الدفع',
            'refunded' => '↩️ تم الاسترداد',
            'cod' => '📦 عند الاستلام'
        ];
        
        return isset($statuses[$status]) ? $statuses[$status] : $status;
    }
    
    private function getStatusName($status) {
        $statuses = [
            'pending' => 'قيد الانتظار',
            'processing' => 'قيد المعالجة',
            'shipped' => 'تم الشحن',
            'delivered' => 'تم التسليم',
            'completed' => 'مكتمل',
            'cancelled' => 'ملغي'
        ];
        
        return isset($statuses[$status]) ? $statuses[$status] : $status;
    }
    
    private function formatDate($date) {
        $timestamp = strtotime($date);
        $formatted = date('Y-m-d H:i', $timestamp);
        
        $arabicMonths = [
            'January' => 'يناير',
            'February' => 'فبراير',
            'March' => 'مارس',
            'April' => 'أبريل',
            'May' => 'مايو',
            'June' => 'يونيو',
            'July' => 'يوليو',
            'August' => 'أغسطس',
            'September' => 'سبتمبر',
            'October' => 'أكتوبر',
            'November' => 'نوفمبر',
            'December' => 'ديسمبر'
        ];
        
        $englishMonth = date('F', $timestamp);
        if (isset($arabicMonths[$englishMonth])) {
            $formatted = date('d', $timestamp) . ' ' . $arabicMonths[$englishMonth] . ' ' . date('Y H:i', $timestamp);
        }
        
        return $formatted;
    }
    
    private function calculateDeliveryDate($orderDate) {
        $deliveryDate = date('Y-m-d', strtotime($orderDate . ' + 3-5 days'));
        return $deliveryDate;
    }
    
    private function generateTrackingNumber($orderId) {
        return 'TRK' . str_pad($orderId, 8, '0', STR_PAD_LEFT) . strtoupper(substr(md5($orderId), 0, 4));
    }
}
?>
