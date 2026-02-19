<?php
session_start();

ini_set('display_errors', 0);
error_reporting(E_ALL);

require_once __DIR__ . '/../Model/db.php';

header('Content-Type: application/json; charset=utf-8');

class AddToCart {
    private $conn;
    private $userId;
    private $productId;
    private $quantity;
    
    public function __construct($conn) {
        $this->conn = $conn;
        $this->userId = isset($_SESSION['user_id']) ? (int)$_SESSION['user_id'] : 0;
        $this->productId = isset($_REQUEST['id']) ? (int)$_REQUEST['id'] : 0;
        $this->quantity = isset($_REQUEST['qty']) ? max(1, (int)$_REQUEST['qty']) : 1;
    }
    
    public function process() {
        if (!$this->conn) {
            return $this->errorResponse('فشل الاتصال بقاعدة البيانات');
        }

        if ($this->productId <= 0) {
            return $this->errorResponse('معرف المنتج غير صالح');
        }
        
        $product = $this->getProductDetails();
        if (!$product) {
            return $this->errorResponse('المنتج غير موجود');
        }
        
        if ($product['stock'] <= 0) {
            return $this->errorResponse('المنتج غير متاح حالياً');
        }
        
        $canAdd = $this->calculateAvailableQuantity($product['stock']);
        if ($canAdd <= 0) {
            return $this->errorResponse('لا يمكن إضافة المزيد من هذا المنتج (نفد المخزون)');
        }
        
        $added = $this->addProductToCart($canAdd);
        if (!$added) {
            return $this->errorResponse('فشل إضافة المنتج إلى السلة');
        }
        
        $cartTotals = $this->getCartTotals();
        
        return $this->successResponse($canAdd, $product['stock'], $cartTotals);
    }
    
    private function getProductDetails() {
        $query = "SELECT price, stock FROM products WHERE id = ? LIMIT 1";
        $stmt = $this->conn->prepare($query);
        if (!$stmt) return null;
        $stmt->bind_param('i', $this->productId);
        $stmt->execute();
        $result = $stmt->get_result();
        
        return $result->fetch_assoc();
    }
    
    private function calculateAvailableQuantity($stock) {
        $currentQty = $this->getCurrentQuantity();
        $remaining = $stock - $currentQty;
        
        if ($remaining <= 0) {
            return 0;
        }
        
        return min($this->quantity, $remaining);
    }
    
    private function getCurrentQuantity() {
        if ($this->userId > 0) {
            $query = "SELECT quantity FROM user_cart 
                      WHERE user_id = ? AND product_id = ? LIMIT 1";
            $stmt = $this->conn->prepare($query);
            if (!$stmt) return 0;
            $stmt->bind_param('ii', $this->userId, $this->productId);
            $stmt->execute();
            $result = $stmt->get_result();
            
            if ($row = $result->fetch_assoc()) {
                return (int)$row['quantity'];
            }
        } else {
            return isset($_SESSION['cart'][$this->productId]) ? 
                   (int)$_SESSION['cart'][$this->productId] : 0;
        }
        
        return 0;
    }
    
    private function addProductToCart($quantity) {
        if ($this->userId > 0) {
            return $this->addToUserCart($quantity);
        } else {
            return $this->addToGuestCart($quantity);
        }
    }
    
    private function addToUserCart($quantity) {
        $currentQty = $this->getCurrentQuantity();
        
        if ($currentQty > 0) {
            $query = "UPDATE user_cart SET quantity = quantity + ? 
                      WHERE user_id = ? AND product_id = ?";
            $stmt = $this->conn->prepare($query);
            if (!$stmt) return false;
            $stmt->bind_param('iii', $quantity, $this->userId, $this->productId);
        } else {
            $query = "INSERT INTO user_cart (user_id, product_id, quantity) 
                      VALUES (?, ?, ?)";
            $stmt = $this->conn->prepare($query);
            if (!$stmt) return false;
            $stmt->bind_param('iii', $this->userId, $this->productId, $quantity);
        }
        
        return $stmt->execute();
    }
    
    private function addToGuestCart($quantity) {
        if (!isset($_SESSION['cart'])) {
            $_SESSION['cart'] = [];
        }
        
        $currentQty = isset($_SESSION['cart'][$this->productId]) ? 
                     (int)$_SESSION['cart'][$this->productId] : 0;
        
        $_SESSION['cart'][$this->productId] = $currentQty + $quantity;
        return true;
    }
    
    private function getCartTotals() {
        if ($this->userId > 0) {
            return $this->getUserCartTotals();
        } else {
            return $this->getGuestCartTotals();
        }
    }
    
    private function getUserCartTotals() {
        $query = "SELECT COUNT(*) as count, SUM(c.quantity) as total_qty, 
                         SUM(c.quantity * p.price) as total_price 
                  FROM user_cart c 
                  JOIN products p ON c.product_id = p.id 
                  WHERE c.user_id = ?";
        
        $stmt = $this->conn->prepare($query);
        if (!$stmt) return ['count' => 0, 'total_qty' => 0, 'total_price' => 0];
        $stmt->bind_param('i', $this->userId);
        $stmt->execute();
        $result = $stmt->get_result();
        
        return $result->fetch_assoc();
    }
    
    private function getGuestCartTotals() {
        if (!isset($_SESSION['cart']) || empty($_SESSION['cart'])) {
            return ['count' => 0, 'total_qty' => 0, 'total_price' => 0];
        }
        
        $productIds = array_keys($_SESSION['cart']);
        $placeholders = implode(',', array_fill(0, count($productIds), '?'));
        
        $query = "SELECT id, price FROM products WHERE id IN ($placeholders)";
        $stmt = $this->conn->prepare($query);
        if (!$stmt) return ['count' => 0, 'total_qty' => 0, 'total_price' => 0];
        $stmt->bind_param(str_repeat('i', count($productIds)), ...$productIds);
        $stmt->execute();
        $result = $stmt->get_result();
        
        $prices = [];
        while ($row = $result->fetch_assoc()) {
            $prices[$row['id']] = (float)$row['price'];
        }
        
        $totalQty = 0;
        $totalPrice = 0;
        
        foreach ($_SESSION['cart'] as $productId => $quantity) {
            $price = isset($prices[$productId]) ? $prices[$productId] : 0;
            $totalQty += $quantity;
            $totalPrice += $price * $quantity;
        }
        
        return [
            'count' => count($_SESSION['cart']),
            'total_qty' => $totalQty,
            'total_price' => $totalPrice
        ];
    }
    
    private function successResponse($addedQuantity, $remainingStock, $cartTotals) {
        $message = $addedQuantity == $this->quantity ? 
            '✅ تم إضافة المنتج إلى السلة' : 
            "⚠ تمت إضافة {$addedQuantity} فقط (الباقي غير متوفر)";
        
        return [
            'success' => true,
            'msg' => $message,
            'added' => $addedQuantity,
            'remaining_stock' => $remainingStock,
            'cart_count' => (int)($cartTotals['total_qty'] ?? 0),
            'cart_total' => number_format((float)($cartTotals['total_price'] ?? 0), 2)
        ];
    }
    
    private function errorResponse($message) {
        return [
            'success' => false,
            'msg' => $message
        ];
    }
}

try {
    $addToCart = new AddToCart($conn);
    $result = $addToCart->process();
    echo json_encode($result, JSON_UNESCAPED_UNICODE);
} catch (Exception $e) {
    echo json_encode([
        'success' => false,
        'msg' => 'حدث خطأ غير متوقع'
    ], JSON_UNESCAPED_UNICODE);
} finally {
    if (isset($conn)) {
        $conn->close();
    }
}
?>
