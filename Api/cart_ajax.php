<?php
session_start();
require_once __DIR__ . '/../Model/db.php';

header('Content-Type: application/json; charset=utf-8');

class CartData {
    private $conn;
    private $userId;
    private $isGuest;
    
    public function __construct($conn) {
        $this->conn = $conn;
        $this->userId = isset($_SESSION['user_id']) ? (int)$_SESSION['user_id'] : 0;
        $this->isGuest = $this->userId === 0;
    }
    
    public function getCartData() {
        if ($this->isGuest) {
            return $this->getGuestCartData();
        } else {
            return $this->getUserCartData();
        }
    }
    
    private function getUserCartData() {
        $cartItems = [];
        $totalPrice = 0;
        $totalQty = 0;
        
        $query = "SELECT c.product_id, c.quantity, p.name, p.price, p.image, p.stock
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
                'stock' => (int)$row['stock'],
                'subtotal' => $subtotal
            ];
            
            $totalPrice += $subtotal;
            $totalQty += $row['quantity'];
        }
        
        $stmt->close();
        
        return [
            'cartItems' => $cartItems,
            'totalPrice' => number_format($totalPrice, 2),
            'totalQty' => $totalQty,
            'userInfo' => $this->getUserInfo()
        ];
    }
    
    private function getGuestCartData() {
        $cartItems = [];
        $totalPrice = 0;
        $totalQty = 0;
        
        if (!isset($_SESSION['cart']) || !is_array($_SESSION['cart']) || empty($_SESSION['cart'])) {
            return [
                'cartItems' => [],
                'totalPrice' => '0.00',
                'totalQty' => 0,
                'userInfo' => null
            ];
        }
        
        $productIds = array_keys($_SESSION['cart']);
        $productIds = array_map('intval', $productIds);
        $placeholders = str_repeat('?,', count($productIds) - 1) . '?';
        
        $query = "SELECT id, name, price, image, stock FROM products WHERE id IN ($placeholders)";
        $stmt = $this->conn->prepare($query);
        $stmt->bind_param(str_repeat('i', count($productIds)), ...$productIds);
        $stmt->execute();
        $result = $stmt->get_result();
        
        $products = [];
        while ($row = $result->fetch_assoc()) {
            $products[$row['id']] = $row;
        }
        
        $stmt->close();
        
        foreach ($_SESSION['cart'] as $productId => $quantity) {
            $productId = (int)$productId;
            $quantity = (int)$quantity;
            
            if ($quantity <= 0 || !isset($products[$productId])) {
                continue;
            }
            
            $product = $products[$productId];
            $subtotal = $product['price'] * $quantity;
            
            $cartItems[] = [
                'id' => $productId,
                'name' => htmlspecialchars($product['name']),
                'price' => (float)$product['price'],
                'quantity' => $quantity,
                'image' => $product['image'],
                'stock' => (int)$product['stock'],
                'subtotal' => $subtotal
            ];
            
            $totalPrice += $subtotal;
            $totalQty += $quantity;
        }
        
        return [
            'cartItems' => $cartItems,
            'totalPrice' => number_format($totalPrice, 2),
            'totalQty' => $totalQty,
            'userInfo' => null
        ];
    }
    
    private function getUserInfo() {
        if ($this->isGuest) {
            return null;
        }
        
        $query = "SELECT name, email FROM users WHERE id = ? LIMIT 1";
        $stmt = $this->conn->prepare($query);
        $stmt->bind_param('i', $this->userId);
        $stmt->execute();
        $result = $stmt->get_result();
        
        if ($row = $result->fetch_assoc()) {
            return [
                'name' => htmlspecialchars($row['name']),
                'email' => htmlspecialchars($row['email'])
            ];
        }
        
        return null;
    }
}

try {
    $cartData = new CartData($conn);
    $data = $cartData->getCartData();
    
    echo json_encode([
        'success' => true,
        'cartItems' => $data['cartItems'],
        'totalPrice' => $data['totalPrice'],
        'totalQty' => $data['totalQty'],
        'userInfo' => $data['userInfo']
    ]);
    
} catch (Exception $e) {
    echo json_encode([
        'success' => false,
        'msg' => 'حدث خطأ في تحميل بيانات السلة: ' . $e->getMessage()
    ]);
} finally {
    if (isset($conn)) {
        $conn->close();
    }
}
?>
