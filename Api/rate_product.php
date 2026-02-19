<?php
session_start();

ini_set('display_errors', 0);
error_reporting(E_ALL);

require_once __DIR__ . '/../Model/db.php';

header('Content-Type: application/json; charset=utf-8');

function sendResponse($success, $msg) {
    echo json_encode(['success' => $success, 'msg' => $msg], JSON_UNESCAPED_UNICODE);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    sendResponse(false, 'طلب غير صالح');
}

$product_id = isset($_POST['product_id']) ? (int)$_POST['product_id'] : 0;
$rating = isset($_POST['rating']) ? (int)$_POST['rating'] : 0;
$user_id = isset($_SESSION['user_id']) ? (int)$_SESSION['user_id'] : 0;

if ($user_id <= 0) {
    sendResponse(false, 'يجب تسجيل الدخول أولاً لتتمكن من التقييم');
}

if ($product_id <= 0 || $rating < 1 || $rating > 5) {
    sendResponse(false, 'بيانات التقييم غير صحيحة');
}

try {
    $checkPurchase = $conn->prepare("
        SELECT oi.id 
        FROM order_items oi 
        JOIN orders o ON oi.order_id = o.id 
        WHERE o.user_id = ? AND oi.product_id = ? AND o.status = 'completed'
    ");
    
    if ($checkPurchase) {
        $checkPurchase->bind_param("ii", $user_id, $product_id);
        $checkPurchase->execute();
        if ($checkPurchase->get_result()->num_rows === 0) {
            $checkPurchase->close();
            sendResponse(false, 'يجب شراء المنتج واستلامه لتتمكن من تقييمه');
        }
        $checkPurchase->close();
    }

    $checkStmt = $conn->prepare("SELECT id FROM product_ratings WHERE product_id = ? AND user_id = ?");
    if ($checkStmt) {
        $checkStmt->bind_param("ii", $product_id, $user_id);
        $checkStmt->execute();
        if ($checkStmt->get_result()->num_rows > 0) {
            $checkStmt->close();
            sendResponse(false, 'لقد قمت بتقييم هذا المنتج مسبقاً');
        }
        $checkStmt->close();
    }

    $stmt = $conn->prepare("INSERT INTO product_ratings (product_id, user_id, rating, created_at) VALUES (?, ?, ?, NOW())");
    if ($stmt) {
        $stmt->bind_param("iii", $product_id, $user_id, $rating);
        if ($stmt->execute()) {
            $stmt->close();
            sendResponse(true, 'شكراً لتقييمك!');
        } else {
            $stmt->close();
            sendResponse(false, 'فشل تسجيل التقييم');
        }
    } else {
        sendResponse(false, 'خطأ في إعداد قاعدة البيانات');
    }

} catch (Exception $e) {
    sendResponse(false, 'حدث خطأ فني أثناء معالجة التقييم');
}

if (isset($conn)) {
    $conn->close();
}
?>
