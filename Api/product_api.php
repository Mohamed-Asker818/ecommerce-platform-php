<?php
session_start();
require_once '../Model/db.php';

header('Content-Type: application/json; charset=utf-8');

class ProductAPI {
    private $conn;
    private $userId;
    
    public function __construct($conn) {
        $this->conn = $conn;
        $this->userId = isset($_SESSION['user_id']) ? (int)$_SESSION['user_id'] : 0;
    }
    
    public function handleRequest() {
        $action = isset($_GET['action']) ? $_GET['action'] : '';
        
        switch ($action) {
            case 'get_product':
                return $this->getProduct();
            case 'add_to_cart':
                return $this->addToCart();
            default:
                return $this->errorResponse('طلب غير معروف');
        }
    }
    
    private function getProduct() {
        $productId = isset($_GET['id']) ? (int)$_GET['id'] : 0;
        
        if ($productId <= 0) {
            return $this->errorResponse('معرف المنتج غير صالح');
        }
        
        try {
            $stmt = $this->conn->prepare("SELECT * FROM products WHERE id = ? LIMIT 1");
            $stmt->bind_param('i', $productId);
            $stmt->execute();
            $result = $stmt->get_result();
            
            if ($row = $result->fetch_assoc()) {
                $product = [
                    'id' => $row['id'],
                    'name' => htmlspecialchars($row['name']),
                    'description' => htmlspecialchars($row['description']),
                    'price' => (float)$row['price'],
                    'old_price' => $row['old_price'] ? (float)$row['old_price'] : null,
                    'stock' => (int)$row['stock'],
                    'image' => $row['image']
                ];

                $additional_images = [];
                $imgStmt = $this->conn->prepare("SELECT image_path FROM product_images WHERE product_id = ? ORDER BY sort_order ASC");
                $imgStmt->bind_param('i', $productId);
                $imgStmt->execute();
                $imgResult = $imgStmt->get_result();
                while ($imgRow = $imgResult->fetch_assoc()) {
                    $additional_images[] = $imgRow['image_path'];
                }
                $product['additional_images'] = $additional_images;
                
                $similar_products = $this->getSimilarProducts($row['category_id'], $productId);
                
                return $this->successResponse('تم جلب بيانات المنتج', [
                    'product' => $product,
                    'similar_products' => $similar_products
                ]);
            } else {
                return $this->errorResponse('المنتج غير موجود');
            }
        } catch (Exception $e) {
            return $this->errorResponse('حدث خطأ: ' . $e->getMessage());
        }
    }
    
    private function getSimilarProducts($categoryId, $excludeId) {
        $similar = [];
        
        $query = "SELECT id, name, price, image FROM products 
                  WHERE category_id = ? AND id != ? AND stock > 0 
                  ORDER BY RAND() LIMIT 4";
        $stmt = $this->conn->prepare($query);
        $stmt->bind_param('ii', $categoryId, $excludeId);
        $stmt->execute();
        $result = $stmt->get_result();
        
        while ($row = $result->fetch_assoc()) {
            $similar[] = [
                'id' => $row['id'],
                'name' => htmlspecialchars($row['name']),
                'price' => (float)$row['price'],
                'image' => $row['image']
            ];
        }
        
        return $similar;
    }
    
    private function addToCart() {
        $productId = isset($_POST['product_id']) ? (int)$_POST['product_id'] : 0;
        $quantity = isset($_POST['quantity']) ? (int)$_POST['quantity'] : 1;
        
        if ($productId <= 0 || $quantity <= 0) {
            return $this->errorResponse('بيانات غير صالحة');
        }
        
        try {
            $stmt = $this->conn->prepare("SELECT stock FROM products WHERE id = ?");
            $stmt->bind_param('i', $productId);
            $stmt->execute();
            $result = $stmt->get_result();
            
            if ($row = $result->fetch_assoc()) {
                if ($row['stock'] < $quantity) {
                    return $this->errorResponse('الكمية غير متوفرة في المخزون');
                }
            } else {
                return $this->errorResponse('المنتج غير موجود');
            }
            
            if ($this->userId > 0) {
                $query = "INSERT INTO user_cart (user_id, product_id, quantity, added_at) 
                         VALUES (?, ?, ?, NOW()) 
                         ON DUPLICATE KEY UPDATE quantity = quantity + ?";
                $stmt = $this->conn->prepare($query);
                $stmt->bind_param('iiii', $this->userId, $productId, $quantity, $quantity);
                
                if (!$stmt->execute()) {
                    throw new Exception('فشل إضافة المنتج للسلة');
                }
                
                $countQuery = "SELECT COUNT(*) as count FROM user_cart WHERE user_id = ?";
                $countStmt = $this->conn->prepare($countQuery);
                $countStmt->bind_param('i', $this->userId);
                $countStmt->execute();
                $countResult = $countStmt->get_result();
                $cartCount = $countResult->fetch_assoc()['count'];
            } else {
                if (!isset($_SESSION['cart'])) {
                    $_SESSION['cart'] = [];
                }
                
                if (isset($_SESSION['cart'][$productId])) {
                    $_SESSION['cart'][$productId] += $quantity;
                } else {
                    $_SESSION['cart'][$productId] = $quantity;
                }
                
                $cartCount = count($_SESSION['cart']);
            }
            
            return $this->successResponse('تم إضافة المنتج إلى السلة بنجاح', [
                'cart_count' => $cartCount
            ]);
            
        } catch (Exception $e) {
            return $this->errorResponse($e->getMessage());
        }
    }
    
    private function successResponse($message, $data = []) {
        $response = [
            'success' => true,
            'msg' => $message
        ];
        
        if (!empty($data)) {
            $response = array_merge($response, $data);
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
    $productAPI = new ProductAPI($conn);
    $response = $productAPI->handleRequest();
    
    echo json_encode($response, JSON_UNESCAPED_UNICODE);
    
} catch (Exception $e) {
    echo json_encode([
        'success' => false,
        'msg' => 'حدث خطأ غير متوقع: ' . $e->getMessage()
    ], JSON_UNESCAPED_UNICODE);
}
?>
