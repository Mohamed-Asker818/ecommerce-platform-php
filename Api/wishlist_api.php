<?php
session_start();
require_once __DIR__ . '/../Model/db.php';

header('Content-Type: application/json; charset=utf-8');

class WishlistAPI {
    private $conn;
    private $userId;
    
    public function __construct($conn) {
        $this->conn = $conn;
        $this->userId = isset($_SESSION['user_id']) ? (int)$_SESSION['user_id'] : 0;
    }
    
    public function handleRequest() {
        $action = isset($_GET['action']) ? $_GET['action'] : '';
        
        switch ($action) {
            case 'get_data':
                return $this->getWishlistData();
            case 'remove_item':
                return $this->removeItem();
            case 'clear_all':
                return $this->clearAll();
            default:
                return $this->errorResponse('طلب غير معروف');
        }
    }
    
    private function getWishlistData() {
        if ($this->userId === 0) {
            return $this->errorResponse('يجب تسجيل الدخول');
        }
        
        try {
            $query = "SELECT p.id, p.name, p.price, p.image, p.stock
                      FROM user_wishlist w
                      JOIN products p ON w.product_id = p.id
                      WHERE w.user_id = ?
                      ORDER BY w.added_at DESC";
            
            $stmt = $this->conn->prepare($query);
            $stmt->bind_param('i', $this->userId);
            $stmt->execute();
            $result = $stmt->get_result();
            
            $wishlist = [];
            while ($row = $result->fetch_assoc()) {
                $wishlist[] = [
                    'id' => (int)$row['id'],
                    'name' => htmlspecialchars($row['name']),
                    'price' => (float)$row['price'],
                    'image' => $row['image'],
                    'stock' => (int)$row['stock']
                ];
            }
            
            return [
                'success' => true,
                'wishlist' => $wishlist,
                'count' => count($wishlist)
            ];
            
        } catch (Exception $e) {
            return $this->errorResponse('حدث خطأ في جلب البيانات: ' . $e->getMessage());
        }
    }
    
    private function removeItem() {
        if ($this->userId === 0) {
            return $this->errorResponse('يجب تسجيل الدخول');
        }
        
        if (!isset($_POST['product_id']) || empty($_POST['product_id'])) {
            return $this->errorResponse('معرف المنتج مطلوب');
        }
        
        $productId = (int)$_POST['product_id'];
        
        try {
            $query = "DELETE FROM user_wishlist WHERE user_id = ? AND product_id = ?";
            $stmt = $this->conn->prepare($query);
            $stmt->bind_param('ii', $this->userId, $productId);
            
            if ($stmt->execute()) {
                $countQuery = "SELECT COUNT(*) as count FROM user_wishlist WHERE user_id = ?";
                $countStmt = $this->conn->prepare($countQuery);
                $countStmt->bind_param('i', $this->userId);
                $countStmt->execute();
                $countResult = $countStmt->get_result();
                $countRow = $countResult->fetch_assoc();
                
                return [
                    'success' => true,
                    'msg' => 'تمت إزالة المنتج من قائمة الرغبات',
                    'count' => (int)$countRow['count']
                ];
            } else {
                throw new Exception('فشل في إزالة المنتج');
            }
            
        } catch (Exception $e) {
            return $this->errorResponse('حدث خطأ: ' . $e->getMessage());
        }
    }
    
    private function clearAll() {
        if ($this->userId === 0) {
            return $this->errorResponse('يجب تسجيل الدخول');
        }
        
        try {
            $query = "DELETE FROM user_wishlist WHERE user_id = ?";
            $stmt = $this->conn->prepare($query);
            $stmt->bind_param('i', $this->userId);
            
            if ($stmt->execute()) {
                return [
                    'success' => true,
                    'msg' => 'تمت إزالة جميع المنتجات من قائمة الرغبات',
                    'count' => 0
                ];
            } else {
                throw new Exception('فشل في إزالة المنتجات');
            }
            
        } catch (Exception $e) {
            return $this->errorResponse('حدث خطأ: ' . $e->getMessage());
        }
    }
    
    private function errorResponse($message) {
        return [
            'success' => false,
            'msg' => $message
        ];
    }
}

try {
    $wishlistAPI = new WishlistAPI($conn);
    $response = $wishlistAPI->handleRequest();
    
    echo json_encode($response);
    
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
