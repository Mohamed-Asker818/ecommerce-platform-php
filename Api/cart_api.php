<?php
session_start();
require_once '../Model/db.php';

header('Content-Type: application/json; charset=utf-8');

class CartAPI {
    private $conn;
    private $userId;
    
    public function __construct($conn) {
        $this->conn = $conn;
        $this->userId = isset($_SESSION['user_id']) ? (int)$_SESSION['user_id'] : 0;
    }
    
    public function handleRequest() {
        $action = isset($_GET['action']) ? $_GET['action'] : '';
        
        switch ($action) {
            case 'get_count':
                return $this->getCartCount();
            default:
                return $this->errorResponse('طلب غير معروف');
        }
    }
    
    private function getCartCount() {
        $cartCount = 0;
        
        if ($this->userId > 0) {
            $query = "SELECT COUNT(*) as count FROM user_cart WHERE user_id = ?";
            $stmt = $this->conn->prepare($query);
            $stmt->bind_param('i', $this->userId);
            $stmt->execute();
            $result = $stmt->get_result();
            
            if ($row = $result->fetch_assoc()) {
                $cartCount = $row['count'];
            }
        } elseif (isset($_SESSION['cart'])) {
            $cartCount = count($_SESSION['cart']);
        }
        
        return [
            'success' => true,
            'count' => $cartCount
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
    $cartAPI = new CartAPI($conn);
    $response = $cartAPI->handleRequest();
    
    echo json_encode($response, JSON_UNESCAPED_UNICODE);
    
} catch (Exception $e) {
    echo json_encode([
        'success' => false,
        'msg' => 'حدث خطأ غير متوقع: ' . $e->getMessage()
    ], JSON_UNESCAPED_UNICODE);
}
?>
