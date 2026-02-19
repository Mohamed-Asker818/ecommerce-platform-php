<?php
session_start();
require_once '../Model/db.php';

header('Content-Type: application/json; charset=utf-8');

$config = include '../Model/config.php';

class CheckoutAPI {
    private $conn;
    private $userId;
    private $isGuest;
    private $config;
    
    public function __construct($conn, $config) {
        $this->conn = $conn;
        $this->userId = isset($_SESSION['user_id']) ? (int)$_SESSION['user_id'] : 0;
        $this->isGuest = $this->userId === 0;
        $this->config = $config;
    }
    
    public function handleRequest() {
        $action = isset($_GET['action']) ? $_GET['action'] : '';
        
        switch ($action) {
            case 'get_data':
                return $this->getCheckoutData();
            case 'process_order':
                return $this->processOrder();
            case 'process_direct_order':
                return $this->processDirectOrder();
            case 'validate_cart':
                return $this->validateCart();
            case 'remove_from_cart':
                return $this->removeFromCart();
            default:
                return $this->errorResponse('طلب غير معروف');
        }
    }
    
    private function removeFromCart() {
        if (!isset($_POST['product_id']) || !is_numeric($_POST['product_id'])) {
            return $this->errorResponse('معرف المنتج غير صالح');
        }
        
        $productId = (int)$_POST['product_id'];
        
        try {
            if ($this->isGuest) {
                if (isset($_SESSION['cart'][$productId])) {
                    unset($_SESSION['cart'][$productId]);
                    return $this->successResponse('تم حذف المنتج من السلة');
                } else {
                    return $this->errorResponse('المنتج غير موجود في السلة');
                }
            } else {
                $query = "DELETE FROM user_cart WHERE user_id = ? AND product_id = ?";
                $stmt = $this->conn->prepare($query);
                $stmt->bind_param('ii', $this->userId, $productId);
                
                if ($stmt->execute()) {
                    if ($stmt->affected_rows > 0) {
                        return $this->successResponse('تم حذف المنتج من السلة');
                    } else {
                        return $this->errorResponse('المنتج غير موجود في السلة');
                    }
                } else {
                    throw new Exception('فشل في حذف المنتج: ' . $stmt->error);
                }
            }
        } catch (Exception $e) {
            return $this->errorResponse('حدث خطأ: ' . $e->getMessage());
        }
    }
    
    private function getCheckoutData() {
        try {
            $userData = $this->getUserData();
            
            $cartData = $this->getCartData();
            
            $isDirect = isset($_SESSION['direct_checkout']) && $_SESSION['direct_checkout'];
            
            return [
                'success' => true,
                'user' => $userData,
                'cart' => $cartData,
                'is_direct' => $isDirect
            ];
        } catch (Exception $e) {
            return $this->errorResponse('حدث خطأ في جلب البيانات: ' . $e->getMessage());
        }
    }
    
    private function getUserData() {
        if ($this->isGuest) {
            return [
                'name' => isset($_SESSION['guest_name']) ? $_SESSION['guest_name'] : '',
                'email' => isset($_SESSION['guest_email']) ? $_SESSION['guest_email'] : '',
                'phone' => isset($_SESSION['guest_phone']) ? $_SESSION['guest_phone'] : ''
            ];
        }
        
        $query = "SELECT name, email, phone FROM users WHERE id = ? LIMIT 1";
        $stmt = $this->conn->prepare($query);
        $stmt->bind_param('i', $this->userId);
        $stmt->execute();
        $result = $stmt->get_result();
        
        if ($row = $result->fetch_assoc()) {
            return [
                'name' => htmlspecialchars($row['name']),
                'email' => htmlspecialchars($row['email']),
                'phone' => htmlspecialchars($row['phone'])
            ];
        }
        
        return [
            'name' => '',
            'email' => '',
            'phone' => ''
        ];
    }
    
    private function getCartData() {
        $cartItems = [];
        $totalPrice = 0;
        $itemCount = 0;
        
        if ($this->isGuest) {
            if (!isset($_SESSION['cart']) || empty($_SESSION['cart'])) {
                return [
                    'items' => [], 
                    'totalPrice' => 0, 
                    'shipping' => 0,
                    'itemCount' => 0
                ];
            }
            
            $productIds = array_keys($_SESSION['cart']);
            
            if (empty($productIds)) {
                return [
                    'items' => [], 
                    'totalPrice' => 0, 
                    'shipping' => 0,
                    'itemCount' => 0
                ];
            }
            
            $placeholders = str_repeat('?,', count($productIds) - 1) . '?';
            
            $query = "SELECT id, name, price, image FROM products WHERE id IN ($placeholders)";
            $stmt = $this->conn->prepare($query);
            $stmt->bind_param(str_repeat('i', count($productIds)), ...$productIds);
            $stmt->execute();
            $result = $stmt->get_result();
            
            $products = [];
            while ($row = $result->fetch_assoc()) {
                $products[$row['id']] = $row;
            }
            
            foreach ($_SESSION['cart'] as $productId => $quantity) {
                if (!isset($products[$productId])) continue;
                
                $product = $products[$productId];
                $subtotal = $product['price'] * $quantity;
                
                $cartItems[] = [
                    'id' => (int)$productId,
                    'name' => htmlspecialchars($product['name']),
                    'price' => (float)$product['price'],
                    'quantity' => (int)$quantity,
                    'image' => $product['image'],
                    'subtotal' => $subtotal
                ];
                
                $totalPrice += $subtotal;
                $itemCount += $quantity;
            }
        } else {
            $query = "SELECT c.product_id, c.quantity, p.name, p.price, p.image
                      FROM user_cart c
                      JOIN products p ON c.product_id = p.id
                      WHERE c.user_id = ?";
            
            $stmt = $this->conn->prepare($query);
            $stmt->bind_param('i', $this->userId);
            $stmt->execute();
            $result = $stmt->get_result();
            
            while ($row = $result->fetch_assoc()) {
                $subtotal = $row['price'] * $row['quantity'];
                
                $cartItems[] = [
                    'id' => (int)$row['product_id'],
                    'name' => htmlspecialchars($row['name']),
                    'price' => (float)$row['price'],
                    'quantity' => (int)$row['quantity'],
                    'image' => $row['image'],
                    'subtotal' => $subtotal
                ];
                
                $totalPrice += $subtotal;
                $itemCount += $row['quantity'];
            }
        }
        
        $shipping = $this->calculateShipping($totalPrice);
        
        return [
            'items' => $cartItems,
            'totalPrice' => $totalPrice,
            'shipping' => $shipping,
            'itemCount' => $itemCount,
            'grandTotal' => $totalPrice + $shipping
        ];
    }
    
    private function calculateShipping($total) {
        if ($total >= 500) {
            return 0;
        }
        
        return 50;
    }
    
    private function processOrder() {
        $required = ['customer_name', 'phone', 'address', 'payment_method'];
        foreach ($required as $field) {
            if (!isset($_POST[$field]) || empty(trim($_POST[$field]))) {
                return $this->errorResponse("الرجاء ملء حقل: " . $field);
            }
        }
        
        $customerName = trim($_POST['customer_name']);
        $phone = trim($_POST['phone']);
        $address = trim($_POST['address']);
        $paymentMethod = $_POST['payment_method'];
        $email = isset($_POST['email']) ? trim($_POST['email']) : '';
        $notes = isset($_POST['notes']) ? trim($_POST['notes']) : '';
        
        if (!preg_match('/^[0-9]{10,15}$/', $phone)) {
            return $this->errorResponse('رقم الهاتف غير صالح (يجب أن يكون 10-15 رقم)');
        }
        
        if ($email && !filter_var($email, FILTER_VALIDATE_EMAIL)) {
            return $this->errorResponse('البريد الإلكتروني غير صالح');
        }
        
        $this->conn->begin_transaction();
        
        try {
            $cartValidation = $this->validateCart();
            if (!$cartValidation['success']) {
                throw new Exception($cartValidation['msg']);
            }
            
            $cartItems = $this->getCartItemsWithStock();
            if (empty($cartItems)) {
                throw new Exception('سلة المشتريات فارغة');
            }
            
            $total = 0;
            foreach ($cartItems as $item) {
                $total += $item['price'] * $item['quantity'];
            }
            
            $shipping = $this->calculateShipping($total);
            $grandTotal = $total + $shipping;
            
            $orderId = $this->createOrder($customerName, $phone, $email, $address, 
                                         $total, $shipping, $grandTotal, 
                                         $paymentMethod, $notes);
            
            $this->addOrderItems($orderId, $cartItems);
            
            $paymentResult = $this->processPayment($orderId, $grandTotal, $paymentMethod, $phone);
            
            if (!$paymentResult['success']) {
                throw new Exception($paymentResult['message']);
            }
            
            $this->reduceStock($cartItems);
            
            $this->clearCart();
            
            if (isset($_SESSION['direct_checkout'])) {
                unset($_SESSION['direct_checkout']);
            }
            
            if ($this->isGuest) {
                $_SESSION['guest_name'] = $customerName;
                $_SESSION['guest_email'] = $email;
                $_SESSION['guest_phone'] = $phone;
            }
            
            $this->conn->commit();
            
            $response = $this->successResponse(
                'تم إنشاء الطلب بنجاح. رقم الطلب: #' . $orderId,
                $orderId,
                $paymentResult['redirect'] ?? null
            );
            
            $response['order_summary'] = [
                'order_id' => $orderId,
                'total' => $grandTotal,
                'items_count' => count($cartItems),
                'payment_method' => $paymentMethod,
                'estimated_delivery' => date('Y-m-d', strtotime('+3 days'))
            ];
            
            return $response;
            
        } catch (Exception $e) {
            $this->conn->rollback();
            return $this->errorResponse($e->getMessage());
        }
    }
    
    private function processPayment($orderId, $amount, $method, $phone) {
        switch ($method) {
            case 'card':
                return $this->processCardPayment($orderId, $amount);
            case 'paypal':
                return $this->processPayPalPayment($orderId, $amount);
            case 'wallet':
                $provider = isset($_POST['wallet_provider']) ? $_POST['wallet_provider'] : 'vodafone_cash';
                $walletPhone = isset($_POST['wallet_phone']) ? $_POST['wallet_phone'] : $phone;
                return $this->processWalletPayment($orderId, $amount, $provider, $walletPhone);
            case 'cod':
                return $this->processCODPayment($orderId);
            default:
                throw new Exception('طريقة دفع غير معروفة');
        }
    }
    
    private function processCardPayment($orderId, $amount) {
        $query = "UPDATE orders SET payment_status = 'completed', status = 'processing' WHERE id = ?";
        $stmt = $this->conn->prepare($query);
        $stmt->bind_param('i', $orderId);
        $stmt->execute();
        
        $paymentRef = 'CARD-' . time() . '-' . $orderId;
        
        $query = "INSERT INTO payment_transactions (order_id, transaction_id, amount, status, created_at) 
                  VALUES (?, ?, ?, 'completed', NOW())";
        $stmt = $this->conn->prepare($query);
        $stmt->bind_param('isd', $orderId, $paymentRef, $amount);
        $stmt->execute();
        
        return [
            'success' => true,
            'message' => 'تمت عملية الدفع بالبطاقة بنجاح',
            'order_id' => $orderId,
            'redirect' => 'order_success.php?id=' . $orderId
        ];
    }
    
    private function processPayPalPayment($orderId, $amount) {
        $query = "UPDATE orders SET payment_status = 'processing' WHERE id = ?";
        $stmt = $this->conn->prepare($query);
        $stmt->bind_param('i', $orderId);
        $stmt->execute();
        
        $paypalUrl = 'https://www.paypal.com/cgi-bin/webscr?';
        $params = http_build_query([
            'cmd' => '_xclick',
            'business' => $this->config['paypal_email'],
            'item_name' => 'Order #' . $orderId,
            'amount' => $amount,
            'currency_code' => 'USD',
            'return' => 'https://yourdomain.com/payment_success.php',
            'cancel_return' => 'https://yourdomain.com/payment_cancel.php'
        ]);
        
        return [
            'success' => true,
            'message' => 'تم بدء عملية الدفع عبر PayPal',
            'redirect' => $paypalUrl . $params
        ];
    }
    
    private function processWalletPayment($orderId, $amount, $provider, $walletPhone) {
        $query = "UPDATE orders SET 
                  payment_status = 'pending',
                  wallet_provider = ?,
                  wallet_phone = ?
                  WHERE id = ?";
        
        $stmt = $this->conn->prepare($query);
        $stmt->bind_param('ssi', $provider, $walletPhone, $orderId);
        $stmt->execute();
        
        $paymentRef = 'WALLET-' . time() . '-' . $orderId;
        
        return [
            'success' => true,
            'message' => 'تم بدء عملية الدفع عبر المحفظة. الرجاء إتمام الدفع باستخدام الرقم: ' . $walletPhone,
            'payment_reference' => $paymentRef
        ];
    }
    
    private function processCODPayment($orderId) {
        $query = "UPDATE orders SET payment_status = 'cod', status = 'pending' WHERE id = ?";
        $stmt = $this->conn->prepare($query);
        $stmt->bind_param('i', $orderId);
        $stmt->execute();
        
        return [
            'success' => true,
            'message' => 'تم إنشاء الطلب بنجاح. الدفع عند الاستلام.'
        ];
    }
    
    private function getCartItemsWithStock() {
        $cartItems = [];
        
        if ($this->isGuest) {
            if (!isset($_SESSION['cart']) || empty($_SESSION['cart'])) {
                return [];
            }
            
            $productIds = array_keys($_SESSION['cart']);
            
            if (empty($productIds)) {
                return [];
            }
            
            $placeholders = str_repeat('?,', count($productIds) - 1) . '?';
            
            $query = "SELECT id, name, price, stock FROM products WHERE id IN ($placeholders) FOR UPDATE";
            $stmt = $this->conn->prepare($query);
            $stmt->bind_param(str_repeat('i', count($productIds)), ...$productIds);
            $stmt->execute();
            $result = $stmt->get_result();
            
            $products = [];
            while ($row = $result->fetch_assoc()) {
                $products[$row['id']] = $row;
            }
            
            foreach ($_SESSION['cart'] as $productId => $quantity) {
                if (!isset($products[$productId])) {
                    throw new Exception('المنتج غير موجود: ' . $productId);
                }
                
                $product = $products[$productId];
                if ($product['stock'] < $quantity) {
                    throw new Exception('الكمية غير متوفرة للمنتج: ' . $product['name']);
                }
                
                $cartItems[] = [
                    'id' => (int)$productId,
                    'name' => $product['name'],
                    'price' => (float)$product['price'],
                    'quantity' => (int)$quantity,
                    'stock' => (int)$product['stock']
                ];
            }
        } else {
            $query = "SELECT c.product_id, c.quantity, p.name, p.price, p.stock
                      FROM user_cart c
                      JOIN products p ON c.product_id = p.id
                      WHERE c.user_id = ? FOR UPDATE";
            
            $stmt = $this->conn->prepare($query);
            $stmt->bind_param('i', $this->userId);
            $stmt->execute();
            $result = $stmt->get_result();
            
            while ($row = $result->fetch_assoc()) {
                if ($row['stock'] < $row['quantity']) {
                    throw new Exception('الكمية غير متوفرة للمنتج: ' . $row['name']);
                }
                
                $cartItems[] = [
                    'id' => (int)$row['product_id'],
                    'name' => $row['name'],
                    'price' => (float)$row['price'],
                    'quantity' => (int)$row['quantity'],
                    'stock' => (int)$row['stock']
                ];
            }
        }
        
        return $cartItems;
    }
    
    private function createOrder($customerName, $phone, $email, $address, 
                                $total, $shipping, $grandTotal, 
                                $paymentMethod, $notes) {
        $query = "INSERT INTO orders (user_id, customer_name, email, address, phone, 
                  total, shipping, grand_total, payment_method, notes, 
                  payment_status, status, created_at) 
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', 'pending', NOW())";
        
        $stmt = $this->conn->prepare($query);
        $stmt->bind_param('issssdddss', 
            $this->userId, 
            $customerName, 
            $email, 
            $address, 
            $phone, 
            $total, 
            $shipping, 
            $grandTotal, 
            $paymentMethod, 
            $notes
        );
        
        if (!$stmt->execute()) {
            throw new Exception('فشل إنشاء الطلب: ' . $stmt->error);
        }
        
        return $stmt->insert_id;
    }
    
    private function addOrderItems($orderId, $cartItems) {
        $query = "INSERT INTO order_items (order_id, product_id, product_name, price, quantity, subtotal) 
                  VALUES (?, ?, ?, ?, ?, ?)";
        
        $stmt = $this->conn->prepare($query);
        
        foreach ($cartItems as $item) {
            $subtotal = $item['price'] * $item['quantity'];
            $stmt->bind_param('iisddd', 
                $orderId, 
                $item['id'], 
                $item['name'], 
                $item['price'], 
                $item['quantity'], 
                $subtotal
            );
            
            if (!$stmt->execute()) {
                throw new Exception('فشل إضافة عناصر الطلب: ' . $stmt->error);
            }
        }
    }
    
    private function reduceStock($cartItems) {
        $query = "UPDATE products SET stock = stock - ? WHERE id = ?";
        $stmt = $this->conn->prepare($query);
        
        foreach ($cartItems as $item) {
            $stmt->bind_param('ii', $item['quantity'], $item['id']);
            if (!$stmt->execute()) {
                throw new Exception('فشل تحديث المخزون للمنتج: ' . $item['name']);
            }
        }
    }
    
    private function clearCart() {
        if ($this->isGuest) {
            unset($_SESSION['cart']);
        } else {
            $query = "DELETE FROM user_cart WHERE user_id = ?";
            $stmt = $this->conn->prepare($query);
            $stmt->bind_param('i', $this->userId);
            $stmt->execute();
        }
    }
    
    private function processDirectOrder() {
        $productId = isset($_POST['product_id']) ? (int)$_POST['product_id'] : 0;
        $quantity = isset($_POST['quantity']) ? (int)$_POST['quantity'] : 1;
        
        if ($productId <= 0) {
            return $this->errorResponse('معرف المنتج غير صالح');
        }
        
        try {
            $product = $this->getProductWithStock($productId);
            
            if (!$product) {
                return $this->errorResponse('المنتج غير موجود');
            }
            
            if ($product['stock'] < $quantity) {
                return $this->errorResponse('الكمية غير متوفرة في المخزون');
            }
            
            $_SESSION['direct_checkout'] = [
                'product_id' => $productId,
                'quantity' => $quantity,
                'product_name' => $product['name'],
                'product_price' => $product['price'],
                'timestamp' => time()
            ];
            
            $this->clearCart();
            
            if ($this->isGuest) {
                $_SESSION['cart'][$productId] = $quantity;
            } else {
                $query = "INSERT INTO user_cart (user_id, product_id, quantity, added_at) 
                         VALUES (?, ?, ?, NOW())";
                $stmt = $this->conn->prepare($query);
                $stmt->bind_param('iii', $this->userId, $productId, $quantity);
                $stmt->execute();
            }
            
            return [
                'success' => true,
                'msg' => 'تم تجهيز المنتج للشراء المباشر',
                'redirect' => 'checkout.php?direct=true'
            ];
            
        } catch (Exception $e) {
            return $this->errorResponse('حدث خطأ: ' . $e->getMessage());
        }
    }
    
    private function getProductWithStock($productId) {
        $query = "SELECT id, name, price, stock FROM products WHERE id = ? LIMIT 1";
        $stmt = $this->conn->prepare($query);
        $stmt->bind_param('i', $productId);
        $stmt->execute();
        $result = $stmt->get_result();
        
        if ($row = $result->fetch_assoc()) {
            return [
                'id' => $row['id'],
                'name' => $row['name'],
                'price' => $row['price'],
                'stock' => $row['stock']
            ];
        }
        
        return null;
    }
    
    private function validateCart() {
        try {
            $cartItems = $this->getCartData()['items'];
            
            if (empty($cartItems)) {
                return $this->errorResponse('سلة المشتريات فارغة');
            }
            
            foreach ($cartItems as $item) {
                $product = $this->getProductWithStock($item['id']);
                
                if (!$product) {
                    return $this->errorResponse('المنتج "' . $item['name'] . '" لم يعد متوفراً');
                }
                
                if ($product['stock'] < $item['quantity']) {
                    return $this->errorResponse('الكمية المطلوبة من المنتج "' . $item['name'] . '" غير متوفرة. المتوفر: ' . $product['stock']);
                }
            }
            
            return $this->successResponse('سلة المشتريات صالحة للشراء');
            
        } catch (Exception $e) {
            return $this->errorResponse('حدث خطأ في التحقق: ' . $e->getMessage());
        }
    }
    
    private function successResponse($message, $orderId = null, $redirect = null) {
        $response = [
            'success' => true,
            'msg' => $message
        ];
        
        if ($orderId) {
            $response['order_id'] = $orderId;
        }
        
        if ($redirect) {
            $response['redirect'] = $redirect;
        }
        
        return $response;
    }
    
    private function errorResponse($message) {
        return [
            'success' => false,
            'msg' => $message
        ];
    }
}

try {
    $checkoutAPI = new CheckoutAPI($conn, $config);
    $response = $checkoutAPI->handleRequest();
    
    echo json_encode($response, JSON_UNESCAPED_UNICODE);
    
} catch (Exception $e) {
    echo json_encode([
        'success' => false,
        'msg' => 'حدث خطأ غير متوقع: ' . $e->getMessage()
    ], JSON_UNESCAPED_UNICODE);
} finally {
    if (isset($conn)) {
        $conn->close();
    }
}
?>
