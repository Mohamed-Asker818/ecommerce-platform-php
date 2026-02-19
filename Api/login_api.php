<?php
session_start();
require_once '../Model/db.php';

header('Content-Type: application/json; charset=utf-8');

class LoginAPI {
    private $conn;
    
    public function __construct($conn) {
        $this->conn = $conn;
    }
    
    public function handleRequest() {
        $action = isset($_POST['action']) ? $_POST['action'] : '';
        
        switch ($action) {
            case 'login':
                return $this->processLogin();
            case 'register':
                return $this->processRegister();
            case 'forgot_password':
                return $this->processForgotPassword();
            case 'verify_otp':
                return $this->verifyOTP();
            case 'reset_password':
                return $this->resetPassword();
            case 'check_session':
                return $this->checkSession();
            default:
                return $this->errorResponse('طلب غير معروف');
        }
    }
    
    private function processLogin() {
        $email = trim($_POST['email'] ?? '');
        $password = $_POST['password'] ?? '';
        $remember = isset($_POST['remember']);
        
        if (empty($email) || empty($password)) {
            return $this->errorResponse('الرجاء ملء جميع الحقول');
        }
        
        $query = "SELECT id, name, email, password, phone, avatar, is_active 
                  FROM users WHERE email = ? LIMIT 1";
        $stmt = $this->conn->prepare($query);
        $stmt->bind_param('s', $email);
        $stmt->execute();
        $result = $stmt->get_result();
        
        if ($row = $result->fetch_assoc()) {
            if (!$row['is_active']) {
                return $this->errorResponse('الحساب غير مفعل. يرجى التواصل مع الدعم');
            }
            
            if (password_verify($password, $row['password'])) {
                session_regenerate_id(true);
                
                $_SESSION['user_id'] = $row['id'];
                $_SESSION['user_name'] = $row['name'];
                $_SESSION['user_email'] = $row['email'];
                $_SESSION['user_avatar'] = $row['avatar'] ?: 'default_avatar.png';
                
                if ($remember) {
                    $this->createRememberToken($row['id']);
                }
                
                $this->mergeSessionData($row['id']);
                
                $this->updateLastLogin($row['id']);
                
                return $this->successResponse('تم تسجيل الدخول بنجاح', [
                    'user' => [
                        'id' => $row['id'],
                        'name' => $row['name'],
                        'email' => $row['email'],
                        'avatar' => $row['avatar'] ?: 'default_avatar.png'
                    ]
                ]);
            }
        }
        
        return $this->errorResponse('البريد الإلكتروني أو كلمة المرور غير صحيحة');
    }
    
    private function processRegister() {
        $name = trim($_POST['name'] ?? '');
        $email = trim($_POST['email'] ?? '');
        $password = $_POST['password'] ?? '';
        $confirm_password = $_POST['confirm_password'] ?? '';
        $phone = trim($_POST['phone'] ?? '');
        
        if (empty($name) || empty($email) || empty($password)) {
            return $this->errorResponse('الرجاء ملء جميع الحقول المطلوبة');
        }
        
        if ($password !== $confirm_password) {
            return $this->errorResponse('كلمتا المرور غير متطابقتين');
        }
        
        if (strlen($password) < 6) {
            return $this->errorResponse('كلمة المرور يجب أن تكون 6 أحرف على الأقل');
        }
        
        $checkQuery = "SELECT id FROM users WHERE email = ? LIMIT 1";
        $checkStmt = $this->conn->prepare($checkQuery);
        $checkStmt->bind_param('s', $email);
        $checkStmt->execute();
        
        if ($checkStmt->get_result()->num_rows > 0) {
            return $this->errorResponse('البريد الإلكتروني مسجل بالفعل');
        }
        
        $hashedPassword = password_hash($password, PASSWORD_DEFAULT);
        
        $verificationToken = bin2hex(random_bytes(32));
        
        $query = "INSERT INTO users (name, email, password, phone, verification_token, created_at) 
                  VALUES (?, ?, ?, ?, ?, NOW())";
        
        $stmt = $this->conn->prepare($query);
        $stmt->bind_param('sssss', $name, $email, $hashedPassword, $phone, $verificationToken);
        
        if ($stmt->execute()) {
            $userId = $stmt->insert_id;
            
        
            session_regenerate_id(true);
            $_SESSION['user_id'] = $userId;
            $_SESSION['user_name'] = $name;
            $_SESSION['user_email'] = $email;
            
            return $this->successResponse('تم إنشاء الحساب بنجاح!', [
                'user' => [
                    'id' => $userId,
                    'name' => $name,
                    'email' => $email
                ]
            ]);
        }
        
        return $this->errorResponse('حدث خطأ أثناء إنشاء الحساب');
    }
    
    private function processForgotPassword() {
        $email = trim($_POST['email'] ?? '');
        
        if (empty($email)) {
            return $this->errorResponse('الرجاء إدخال البريد الإلكتروني');
        }
        
        $query = "SELECT id, name FROM users WHERE email = ? LIMIT 1";
        $stmt = $this->conn->prepare($query);
        $stmt->bind_param('s', $email);
        $stmt->execute();
        $result = $stmt->get_result();
        
        if ($row = $result->fetch_assoc()) {
            $otp = rand(100000, 999999);
            $expires = date('Y-m-d H:i:s', strtotime('+15 minutes'));
            
            $otpQuery = "INSERT INTO password_resets (user_id, otp, expires_at) 
                         VALUES (?, ?, ?)
                         ON DUPLICATE KEY UPDATE otp = ?, expires_at = ?";
            $otpStmt = $this->conn->prepare($otpQuery);
            $otpStmt->bind_param('issss', $row['id'], $otp, $expires, $otp, $expires);
            $otpStmt->execute();
                        
            return $this->successResponse('تم إرسال رمز التحقق إلى بريدك الإلكتروني', [
                'user_id' => $row['id'],
                'email' => $email
            ]);
        }
        
        return $this->errorResponse('البريد الإلكتروني غير مسجل');
    }
    
    private function verifyOTP() {
        $userId = $_POST['user_id'] ?? 0;
        $otp = $_POST['otp'] ?? '';
        
        if (empty($userId) || empty($otp)) {
            return $this->errorResponse('الرجاء إدخال رمز التحقق');
        }
        
        $query = "SELECT * FROM password_resets 
                  WHERE user_id = ? AND otp = ? AND expires_at > NOW() 
                  LIMIT 1";
        
        $stmt = $this->conn->prepare($query);
        $stmt->bind_param('is', $userId, $otp);
        $stmt->execute();
        $result = $stmt->get_result();
        
        if ($result->num_rows > 0) {
            return $this->successResponse('تم التحقق بنجاح');
        }
        
        return $this->errorResponse('رمز التحقق غير صالح أو منتهي الصلاحية');
    }
    
    private function resetPassword() {
        $userId = $_POST['user_id'] ?? 0;
        $otp = $_POST['otp'] ?? '';
        $newPassword = $_POST['new_password'] ?? '';
        $confirmPassword = $_POST['confirm_password'] ?? '';
        
        if (empty($newPassword) || $newPassword !== $confirmPassword) {
            return $this->errorResponse('كلمات المرور غير متطابقة');
        }
        
        $verifyQuery = "SELECT * FROM password_resets 
                        WHERE user_id = ? AND otp = ? AND expires_at > NOW() 
                        LIMIT 1";
        
        $verifyStmt = $this->conn->prepare($verifyQuery);
        $verifyStmt->bind_param('is', $userId, $otp);
        $verifyStmt->execute();
        
        if ($verifyStmt->get_result()->num_rows === 0) {
            return $this->errorResponse('رمز التحقق غير صالح');
        }
        
        $hashedPassword = password_hash($newPassword, PASSWORD_DEFAULT);
        
        $updateQuery = "UPDATE users SET password = ? WHERE id = ?";
        $updateStmt = $this->conn->prepare($updateQuery);
        $updateStmt->bind_param('si', $hashedPassword, $userId);
        
        if ($updateStmt->execute()) {
            $deleteQuery = "DELETE FROM password_resets WHERE user_id = ?";
            $deleteStmt = $this->conn->prepare($deleteQuery);
            $deleteStmt->bind_param('i', $userId);
            $deleteStmt->execute();
            
            return $this->successResponse('تم إعادة تعيين كلمة المرور بنجاح');
        }
        
        return $this->errorResponse('حدث خطأ أثناء تحديث كلمة المرور');
    }
    
    private function checkSession() {
        if (isset($_SESSION['user_id'])) {
            return $this->successResponse('User is logged in', [
                'user' => [
                    'id' => $_SESSION['user_id'],
                    'name' => $_SESSION['user_name'] ?? '',
                    'email' => $_SESSION['user_email'] ?? ''
                ]
            ]);
        }
        
        if (isset($_COOKIE['remember_token'])) {
            $token = $_COOKIE['remember_token'];
            
            $query = "SELECT u.id, u.name, u.email, u.avatar 
                      FROM users u
                      JOIN remember_tokens rt ON u.id = rt.user_id
                      WHERE rt.token = ? AND rt.expires_at > NOW() 
                      LIMIT 1";
            
            $stmt = $this->conn->prepare($query);
            $stmt->bind_param('s', $token);
            $stmt->execute();
            $result = $stmt->get_result();
            
            if ($row = $result->fetch_assoc()) {
                session_regenerate_id(true);
                $_SESSION['user_id'] = $row['id'];
                $_SESSION['user_name'] = $row['name'];
                $_SESSION['user_email'] = $row['email'];
                $_SESSION['user_avatar'] = $row['avatar'] ?: 'default_avatar.png';
                
                return $this->successResponse('Auto-login via remember token', [
                    'user' => $row
                ]);
            }
        }
        
        return $this->errorResponse('No active session');
    }
    
    private function createRememberToken($userId) {
        $token = bin2hex(random_bytes(32));
        $expires = date('Y-m-d H:i:s', strtotime('+30 days'));
        
        $query = "INSERT INTO remember_tokens (user_id, token, expires_at) 
                  VALUES (?, ?, ?)
                  ON DUPLICATE KEY UPDATE token = ?, expires_at = ?";
        
        $stmt = $this->conn->prepare($query);
        $stmt->bind_param('issss', $userId, $token, $expires, $token, $expires);
        $stmt->execute();
        
        setcookie('remember_token', $token, [
            'expires' => time() + (86400 * 30),
            'path' => '/',
            'secure' => true,
            'httponly' => true,
            'samesite' => 'Strict'
        ]);
    }
    
    private function mergeSessionData($userId) {
        if (isset($_SESSION['cart'])) {
            foreach ($_SESSION['cart'] as $productId => $quantity) {
                $mergeQuery = "INSERT INTO user_cart (user_id, product_id, quantity) 
                               VALUES (?, ?, ?)
                               ON DUPLICATE KEY UPDATE quantity = quantity + VALUES(quantity)";
                
                $mergeStmt = $this->conn->prepare($mergeQuery);
                $mergeStmt->bind_param('iii', $userId, $productId, $quantity);
                $mergeStmt->execute();
            }
            unset($_SESSION['cart']);
        }
        
        if (isset($_SESSION['wishlist'])) {
            foreach ($_SESSION['wishlist'] as $productId) {
                $wishQuery = "INSERT IGNORE INTO user_wishlist (user_id, product_id) VALUES (?, ?)";
                $wishStmt = $this->conn->prepare($wishQuery);
                $wishStmt->bind_param('ii', $userId, $productId);
                $wishStmt->execute();
            }
            unset($_SESSION['wishlist']);
        }
    }
    
    private function updateLastLogin($userId) {
        $query = "UPDATE users SET last_login = NOW() WHERE id = ?";
        $stmt = $this->conn->prepare($query);
        $stmt->bind_param('i', $userId);
        $stmt->execute();
    }
    
    private function successResponse($message, $data = []) {
        $response = [
            'success' => true,
            'msg' => $message
        ];
        
        if (!empty($data)) {
            $response['data'] = $data;
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
    $loginAPI = new LoginAPI($conn);
    $response = $loginAPI->handleRequest();
    
    echo json_encode($response, JSON_UNESCAPED_UNICODE);
    
} catch (Exception $e) {
    echo json_encode([
        'success' => false,
        'msg' => 'حدث خطأ غير متوقع: ' . $e->getMessage()
    ], JSON_UNESCAPED_UNICODE);
}
?>
