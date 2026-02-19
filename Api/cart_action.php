<?php
session_start();
require_once '../Model/db.php';

header('Content-Type: application/json; charset=utf-8');

class CartAction {
    private $conn;
    private $userId;
    private $productId;
    private $action;
    
    public function __construct($conn) {
        $this->conn = $conn;
        $this->userId = isset($_SESSION['user_id']) ? (int)$_SESSION['user_id'] : 0;
        $this->productId = isset($_GET['id']) ? (int)$_GET['id'] : 0;
        $this->action = isset($_GET['action']) ? trim($_GET['action']) : '';
    }
    
    public function handleAction() {
        $validActions = ['add', 'minus', 'remove', 'clear'];
        if (!in_array($this->action, $validActions)) {
            return $this->errorResponse('إجراء غير صالح');
        }
        
        if (!$this->isAuthenticated() && !$this->isGuestAction()) {
            return $this->errorResponse('يجب تسجيل الدخول لإجراء هذه العملية');
        }
        
        switch ($this->action) {
            case 'add':
                return $this->addToCart();
            case 'minus':
                return $this->minusFromCart();
            case 'remove':
                return $this->removeFromCart();
            case 'clear':
                return $this->clearCart();
            default:
                return $this->errorResponse('إجراء غير معروف');
        }
    }
    
    private function addToCart() {
        if ($this->productId <= 0) {
            return $this->errorResponse('معرف المنتج غير صالح');
        }
        
        $stock = $this->getProductStock($this->productId);
        if ($stock <= 0) {
            return $this->errorResponse('المنتج غير متاح حالياً');
        }
        
        if ($this->userId > 0) {
            return $this->addToUserCart($stock);
        } else {
            return $this->addToGuestCart($stock);
        }
    }
    
    private function addToUserCart($stock) {
        $currentQty = $this->getCurrentQuantity();
        if ($currentQty >= $stock) {
            return $this->errorResponse('لا يمكن إضافة كمية أكثر من المخزون المتاح');
        }
        
        if ($currentQty > 0) {
            $query = "UPDATE user_cart SET quantity = quantity + 1 
                      WHERE user_id = ? AND product_id = ?";
        } else {
            $query = "INSERT INTO user_cart (user_id, product_id, quantity) 
                      VALUES (?, ?, 1)";
        }
        
        $stmt = $this->conn->prepare($query);
        $params = [$this->userId, $this->productId];
        $stmt->bind_param('ii', ...$params);
        
        if ($stmt->execute()) {
            return $this->successResponse('تم إضافة المنتج إلى السلة');
        } else {
            return $this->errorResponse('فشل إضافة المنتج إلى السلة');
        }
    }
    
    private function addToGuestCart($stock) {
        if (!isset($_SESSION['cart'])) {
            $_SESSION['cart'] = [];
        }
        
        $currentQty = isset($_SESSION['cart'][$this->productId]) ? 
                     (int)$_SESSION['cart'][$this->productId] : 0;
        
        if ($currentQty >= $stock) {
            return $this->errorResponse('لا يمكن إضافة كمية أكثر من المخزون المتاح');
        }
        
        $_SESSION['cart'][$this->productId] = $currentQty + 1;
        return $this->successResponse('تم إضافة المنتج إلى السلة');
    }
    
    private function minusFromCart() {
        if ($this->productId <= 0) {
            return $this->errorResponse('معرف المنتج غير صالح');
        }
        
        if ($this->userId > 0) {
            return $this->minusFromUserCart();
        } else {
            return $this->minusFromGuestCart();
        }
    }
    
    private function minusFromUserCart() {
        $currentQty = $this->getCurrentQuantity();
        
        if ($currentQty <= 1) {
            return $this->removeFromUserCart();
        }
        
        $query = "UPDATE user_cart SET quantity = quantity - 1 
                  WHERE user_id = ? AND product_id = ?";
        
        $stmt = $this->conn->prepare($query);
        $stmt->bind_param('ii', $this->userId, $this->productId);
        
        if ($stmt->execute()) {
            return $this->successResponse('تم تقليل الكمية');
        } else {
            return $this->errorResponse('فشل تحديث الكمية');
        }
    }
    
    private function minusFromGuestCart() {
        if (!isset($_SESSION['cart'][$this->productId])) {
            return $this->errorResponse('المنتج غير موجود في السلة');
        }
        
        $currentQty = (int)$_SESSION['cart'][$this->productId];
        
        if ($currentQty <= 1) {
            unset($_SESSION['cart'][$this->productId]);
            return $this->successResponse('تم إزالة المنتج من السلة');
        } else {
            $_SESSION['cart'][$this->productId] = $currentQty - 1;
            return $this->successResponse('تم تقليل الكمية');
        }
    }
    
    private function removeFromCart() {
        if ($this->productId <= 0) {
            return $this->errorResponse('معرف المنتج غير صالح');
        }
        
        if ($this->userId > 0) {
            return $this->removeFromUserCart();
        } else {
            return $this->removeFromGuestCart();
        }
    }
    
    private function removeFromUserCart() {
        $query = "DELETE FROM user_cart WHERE user_id = ? AND product_id = ?";
        $stmt = $this->conn->prepare($query);
        $stmt->bind_param('ii', $this->userId, $this->productId);
        
        if ($stmt->execute()) {
            return $this->successResponse('تم إزالة المنتج من السلة');
        } else {
            return $this->errorResponse('فشل إزالة المنتج من السلة');
        }
    }
    
    private function removeFromGuestCart() {
        if (isset($_SESSION['cart'][$this->productId])) {
            unset($_SESSION['cart'][$this->productId]);
            return $this->successResponse('تم إزالة المنتج من السلة');
        }
        
        return $this->errorResponse('المنتج غير موجود في السلة');
    }
    
    private function clearCart() {
        if ($this->userId > 0) {
            return $this->clearUserCart();
        } else {
            return $this->clearGuestCart();
        }
    }
    
    private function clearUserCart() {
        $query = "DELETE FROM user_cart WHERE user_id = ?";
        $stmt = $this->conn->prepare($query);
        $stmt->bind_param('i', $this->userId);
        
        if ($stmt->execute()) {
            return $this->successResponse('تم تفريغ السلة بنجاح');
        } else {
            return $this->errorResponse('فشل تفريغ السلة');
        }
    }
    
    private function clearGuestCart() {
        $_SESSION['cart'] = [];
        return $this->successResponse('تم تفريغ السلة بنجاح');
    }
    
    private function getCurrentQuantity() {
        if ($this->userId > 0) {
            $query = "SELECT quantity FROM user_cart 
                      WHERE user_id = ? AND product_id = ? LIMIT 1";
            $stmt = $this->conn->prepare($query);
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
    
    private function getProductStock($productId) {
        $query = "SELECT stock FROM products WHERE id = ? LIMIT 1";
        $stmt = $this->conn->prepare($query);
        $stmt->bind_param('i', $productId);
        $stmt->execute();
        $result = $stmt->get_result();
        
        if ($row = $result->fetch_assoc()) {
            return (int)$row['stock'];
        }
        
        return 0;
    }
    
    private function isAuthenticated() {
        return $this->userId > 0;
    }
    
    private function isGuestAction() {
        return $this->userId === 0 && in_array($this->action, ['add', 'minus', 'remove', 'clear']);
    }
    
    private function successResponse($message) {
        return [
            'success' => true,
            'msg' => $message
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
    $cartAction = new CartAction($conn);
    $result = $cartAction->handleAction();
    
    echo json_encode($result);
    
} catch (Exception $e) {
    echo json_encode([
        'success' => false,
        'msg' => 'حدث خطأ غير متوقع: ' . $e->getMessage()
    ]);
} finally {
    if (isset($conn)) {
        $conn->close();
    }
}
?>
