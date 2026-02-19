<?php
session_start();
require_once '../Model/db.php';

header('Content-Type: application/json; charset=utf-8');

class ProfileAPI {
    private $conn;
    private $userId;
    
    public function __construct($conn) {
        $this->conn = $conn;
        $this->userId = isset($_SESSION['user_id']) ? (int)$_SESSION['user_id'] : 0;
        
        if ($this->userId === 0) {
            $this->errorResponse('يجب تسجيل الدخول أولاً');
            exit;
        }
    }
    
    public function handleRequest() {
        $action = isset($_GET['action']) ? $_GET['action'] : '';
        
        switch ($action) {
            case 'get_data':
                return $this->getProfileData();
            case 'update_info':
                return $this->updateProfileInfo();
            case 'change_password':
                return $this->changePassword();
            case 'upload_avatar':
                return $this->uploadAvatar();
            case 'delete_account':
                return $this->deleteAccount();
            default:
                return $this->errorResponse('طلب غير معروف');
        }
    }
    
    private function getProfileData() {
        try {
            $query = "SELECT id, name, email, phone, avatar, created_at FROM users WHERE id = ? LIMIT 1";
            $stmt = $this->conn->prepare($query);
            $stmt->bind_param('i', $this->userId);
            $stmt->execute();
            $result = $stmt->get_result();
            
            if ($row = $result->fetch_assoc()) {
                $row['created_at_formatted'] = date('Y-m-d', strtotime($row['created_at']));
                $row['created_at_readable'] = $this->getTimeAgo($row['created_at']);
                $row['avatar_url'] = $this->getAvatarUrl($row['avatar']);
                $row['stats'] = $this->getUserStats();
                
                return [
                    'success' => true,
                    'user' => $row
                ];
            }
            
            return $this->errorResponse('المستخدم غير موجود');
            
        } catch (Exception $e) {
            return $this->errorResponse('حدث خطأ في جلب البيانات: ' . $e->getMessage());
        }
    }
    
    private function updateProfileInfo() {
        try {
            $data = json_decode(file_get_contents('php://input'), true);
            
            $required = ['name', 'email'];
            foreach ($required as $field) {
                if (!isset($data[$field]) || empty(trim($data[$field]))) {
                    return $this->errorResponse("الرجاء ملء حقل: " . $field);
                }
            }
            
            $name = trim($data['name']);
            $email = trim($data['email']);
            $phone = isset($data['phone']) ? trim($data['phone']) : '';
            
            if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
                return $this->errorResponse('البريد الإلكتروني غير صالح');
            }
            
            $checkQuery = "SELECT id FROM users WHERE email = ? AND id != ?";
            $checkStmt = $this->conn->prepare($checkQuery);
            $checkStmt->bind_param('si', $email, $this->userId);
            $checkStmt->execute();
            $checkResult = $checkStmt->get_result();
            
            if ($checkResult->num_rows > 0) {
                return $this->errorResponse('البريد الإلكتروني مستخدم بالفعل');
            }
            
            $query = "UPDATE users SET name = ?, email = ?, phone = ? WHERE id = ?";
            $stmt = $this->conn->prepare($query);
            $stmt->bind_param('sssi', $name, $email, $phone, $this->userId);
            
            if ($stmt->execute()) {
                return [
                    'success' => true,
                    'msg' => 'تم تحديث البيانات بنجاح',
                    'user' => [
                        'name' => $name,
                        'email' => $email,
                        'phone' => $phone
                    ]
                ];
            }
            
            return $this->errorResponse('فشل تحديث البيانات');
            
        } catch (Exception $e) {
            return $this->errorResponse('حدث خطأ: ' . $e->getMessage());
        }
    }
    
    private function changePassword() {
        try {
            $data = json_decode(file_get_contents('php://input'), true);
            
            $required = ['current_password', 'new_password', 'confirm_password'];
            foreach ($required as $field) {
                if (!isset($data[$field]) || empty(trim($data[$field]))) {
                    return $this->errorResponse("الرجاء ملء حقل: " . $field);
                }
            }
            
            $currentPassword = trim($data['current_password']);
            $newPassword = trim($data['new_password']);
            $confirmPassword = trim($data['confirm_password']);
            
            $query = "SELECT password FROM users WHERE id = ?";
            $stmt = $this->conn->prepare($query);
            $stmt->bind_param('i', $this->userId);
            $stmt->execute();
            $result = $stmt->get_result();
            $user = $result->fetch_assoc();
            
            if (md5($currentPassword) !== $user['password']) {
                return $this->errorResponse('كلمة المرور الحالية غير صحيحة');
            }
            
            if (strlen($newPassword) < 6) {
                return $this->errorResponse('كلمة المرور الجديدة قصيرة جداً (6 أحرف على الأقل)');
            }
            
            if ($newPassword !== $confirmPassword) {
                return $this->errorResponse('كلمات المرور غير متطابقة');
            }
            
            $newPasswordHash = md5($newPassword);
            $updateQuery = "UPDATE users SET password = ? WHERE id = ?";
            $updateStmt = $this->conn->prepare($updateQuery);
            $updateStmt->bind_param('si', $newPasswordHash, $this->userId);
            
            if ($updateStmt->execute()) {
                return [
                    'success' => true,
                    'msg' => 'تم تغيير كلمة المرور بنجاح'
                ];
            }
            
            return $this->errorResponse('فشل تغيير كلمة المرور');
            
        } catch (Exception $e) {
            return $this->errorResponse('حدث خطأ: ' . $e->getMessage());
        }
    }
    
    private function uploadAvatar() {
        try {
            if (!isset($_FILES['avatar']) || $_FILES['avatar']['error'] !== UPLOAD_ERR_OK) {
                return $this->errorResponse('لم يتم اختيار صورة أو حدث خطأ في التحميل');
            }
            
            $file = $_FILES['avatar'];
            
            $allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
            if (!in_array($file['type'], $allowedTypes)) {
                return $this->errorResponse('نوع الصورة غير مدعوم');
            }
            
            if ($file['size'] > 5 * 1024 * 1024) {
                return $this->errorResponse('حجم الصورة كبير جداً (الحد الأقصى 5MB)');
            }
            
            $currentAvatarQuery = "SELECT avatar FROM users WHERE id = ?";
            $currentStmt = $this->conn->prepare($currentAvatarQuery);
            $currentStmt->bind_param('i', $this->userId);
            $currentStmt->execute();
            $currentResult = $currentStmt->get_result();
            $currentUser = $currentResult->fetch_assoc();
            $oldAvatar = $currentUser['avatar'];
            
            $extension = pathinfo($file['name'], PATHINFO_EXTENSION);
            $newFilename = 'user_' . $this->userId . '_' . time() . '.' . $extension;
            $uploadPath = '../Assets/uploads/avatars/' . $newFilename;
            
            if (move_uploaded_file($file['tmp_name'], $uploadPath)) {
                $updateQuery = "UPDATE users SET avatar = ? WHERE id = ?";
                $updateStmt = $this->conn->prepare($updateQuery);
                $updateStmt->bind_param('si', $newFilename, $this->userId);
                
                if ($updateStmt->execute()) {
                    if ($oldAvatar && $oldAvatar !== 'default_avatar.png' && file_exists('../Assets/uploads/avatars/' . $oldAvatar)) {
                        unlink('../Assets/uploads/avatars/' . $oldAvatar);
                    }
                    
                    return [
                        'success' => true,
                        'msg' => 'تم تحديث الصورة الشخصية بنجاح',
                        'avatar_url' => $this->getAvatarUrl($newFilename)
                    ];
                }
            }
            
            return $this->errorResponse('فشل رفع الصورة');
            
        } catch (Exception $e) {
            return $this->errorResponse('حدث خطأ: ' . $e->getMessage());
        }
    }
    
    private function deleteAccount() {
        try {
            $data = json_decode(file_get_contents('php://input'), true);
            
            if (!isset($data['password']) || empty(trim($data['password']))) {
                return $this->errorResponse('الرجاء إدخال كلمة المرور للتأكيد');
            }
            
            $password = trim($data['password']);
            
            $query = "SELECT avatar, password FROM users WHERE id = ?";
            $stmt = $this->conn->prepare($query);
            $stmt->bind_param('i', $this->userId);
            $stmt->execute();
            $result = $stmt->get_result();
            $user = $result->fetch_assoc();
            
            if (md5($password) !== $user['password']) {
                return $this->errorResponse('كلمة المرور غير صحيحة');
            }
            
            $this->conn->begin_transaction();
            
            try {
                if ($user['avatar'] && $user['avatar'] !== 'default_avatar.png' && file_exists('../Assets/uploads/avatars/' . $user['avatar'])) {
                    unlink('../Assets/uploads/avatars/' . $user['avatar']);
                }
                
                $deleteQuery = "DELETE FROM users WHERE id = ?";
                $deleteStmt = $this->conn->prepare($deleteQuery);
                $deleteStmt->bind_param('i', $this->userId);
                
                if (!$deleteStmt->execute()) {
                    throw new Exception('فشل حذف الحساب');
                }
                
                $this->conn->commit();
                
                session_destroy();
                
                return [
                    'success' => true,
                    'msg' => 'تم حذف الحساب بنجاح',
                    'redirect' => 'goodbye.php'
                ];
                
            } catch (Exception $e) {
                $this->conn->rollback();
                throw $e;
            }
            
        } catch (Exception $e) {
            return $this->errorResponse('حدث خطأ أثناء حذف الحساب: ' . $e->getMessage());
        }
    }
    
    private function getAvatarUrl($avatar) {
        if (!empty($avatar) && $avatar !== 'default_avatar.png') {
            $avatarPath = '../Assets/uploads/avatars/' . $avatar;
            if (file_exists($avatarPath)) {
                return $avatarPath . '?t=' . time();
            }
        }
        return '../Assets/uploads/avatars/default_avatar.png';
    }
    
    private function getTimeAgo($datetime) {
        $time = strtotime($datetime);
        $timeDiff = time() - $time;
        
        if ($timeDiff < 60) {
            return 'منذ لحظات';
        } elseif ($timeDiff < 3600) {
            return 'منذ ' . floor($timeDiff / 60) . ' دقيقة';
        } elseif ($timeDiff < 86400) {
            return 'منذ ' . floor($timeDiff / 3600) . ' ساعة';
        } elseif ($timeDiff < 2592000) {
            return 'منذ ' . floor($timeDiff / 86400) . ' يوم';
        } else {
            return date('Y-m-d', $time);
        }
    }
    
    private function getUserStats() {
        $stats = [];
        
        $ordersQuery = "SELECT COUNT(*) as total FROM orders WHERE user_id = ?";
        $ordersStmt = $this->conn->prepare($ordersQuery);
        $ordersStmt->bind_param('i', $this->userId);
        $ordersStmt->execute();
        $ordersResult = $ordersStmt->get_result();
        $stats['total_orders'] = $ordersResult->fetch_assoc()['total'] ?? 0;
        
        $spentQuery = "SELECT COALESCE(SUM(total), 0) as total FROM orders WHERE user_id = ? AND payment_status = 'paid'";
        $spentStmt = $this->conn->prepare($spentQuery);
        $spentStmt->bind_param('i', $this->userId);
        $spentStmt->execute();
        $spentResult = $spentStmt->get_result();
        $stats['total_spent'] = $spentResult->fetch_assoc()['total'] ?? 0;
        
        return $stats;
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
    $profileAPI = new ProfileAPI($conn);
    $response = $profileAPI->handleRequest();
    
    echo json_encode($response);
    
} catch (Exception $e) {
    echo json_encode([
        'success' => false,
        'msg' => 'حدث خطأ غير متوقع: ' . $e->getMessage()
    ]);
}
?>
