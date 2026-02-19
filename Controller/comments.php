<?php
session_start();
require_once '../Model/db.php';

header('Content-Type: application/json; charset=utf-8');

$action = isset($_GET['action']) ? $_GET['action'] : 'list';
$product_id = isset($_REQUEST['product_id']) ? (int)$_REQUEST['product_id'] : 0;

if ($product_id <= 0 && $action !== 'check_notifications') {
    echo json_encode(['success' => false, 'msg' => 'منتج غير صالح']);
    exit;
}

if ($action === 'list') {
    $stmt = $conn->prepare("
        SELECT c.comment, c.rating, c.created_at, u.name, u.avatar 
        FROM product_comments c 
        JOIN users u ON c.user_id = u.id 
        WHERE c.product_id = ? 
        ORDER BY c.created_at DESC
    ");
    $stmt->bind_param("i", $product_id);
    $stmt->execute();
    $result = $stmt->get_result();
    $comments = [];
    while ($row = $result->fetch_assoc()) {
        $comments[] = [
            'name' => htmlspecialchars($row['name']),
            'avatar' => !empty($row['avatar']) ? $row['avatar'] : 'default-avatar.png',
            'comment' => htmlspecialchars($row['comment']),
            'rating' => (int)$row['rating'],
            'date' => date('Y-m-d', strtotime($row['created_at']))
        ];
    }
    echo json_encode(['success' => true, 'comments' => $comments]);
    $stmt->close();
} elseif ($action === 'check_eligibility') {
    $user_id = isset($_SESSION['user_id']) ? (int)$_SESSION['user_id'] : 0;
    if ($user_id <= 0) {
        echo json_encode(['eligible' => false, 'msg' => 'يجب تسجيل الدخول للتعليق']);
        exit;
    }

    $checkPurchase = $conn->prepare("
        SELECT o.id 
        FROM orders o 
        JOIN order_items oi ON o.id = oi.order_id 
        WHERE o.user_id = ? AND oi.product_id = ? AND (o.status = 'delivered' OR o.status = 'completed')
        LIMIT 1
    ");
    $checkPurchase->bind_param("ii", $user_id, $product_id);
    $checkPurchase->execute();
    $res = $checkPurchase->get_result();
    
    if ($res->num_rows === 0) {
        echo json_encode(['eligible' => false, 'msg' => 'يمكنك التعليق فقط بعد شراء المنتج واستلامه']);
        $checkPurchase->close();
        exit;
    }
    $checkPurchase->close();

    $checkComment = $conn->prepare("SELECT id FROM product_comments WHERE user_id = ? AND product_id = ? LIMIT 1");
    $checkComment->bind_param("ii", $user_id, $product_id);
    $checkComment->execute();
    if ($checkComment->get_result()->num_rows > 0) {
        echo json_encode(['eligible' => false, 'already_commented' => true, 'msg' => 'لقد قمت بالتقييم مسبقاً، شكراً لك!']);
        $checkComment->close();
        exit;
    }
    $checkComment->close();

    echo json_encode(['eligible' => true]);
} elseif ($action === 'add') {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        echo json_encode(['success' => false, 'msg' => 'طلب غير صالح']);
        exit;
    }

    $user_id = isset($_SESSION['user_id']) ? (int)$_SESSION['user_id'] : 0;
    $comment = isset($_POST['comment']) ? trim($_POST['comment']) : '';
    $rating = isset($_POST['rating']) ? (int)$_POST['rating'] : 0;

    if ($user_id <= 0) {
        echo json_encode(['success' => false, 'msg' => 'يجب تسجيل الدخول أولاً للتعليق']);
        exit;
    }

    if (empty($comment) || $rating < 1 || $rating > 5) {
        echo json_encode(['success' => false, 'msg' => 'يرجى كتابة تعليق واختيار تقييم']);
        exit;
    }

    $checkPurchase = $conn->prepare("
        SELECT o.id 
        FROM orders o 
        JOIN order_items oi ON o.id = oi.order_id 
        WHERE o.user_id = ? AND oi.product_id = ? AND (o.status = 'delivered' OR o.status = 'completed')
        LIMIT 1
    ");
    $checkPurchase->bind_param("ii", $user_id, $product_id);
    $checkPurchase->execute();
    if ($checkPurchase->get_result()->num_rows === 0) {
        echo json_encode(['success' => false, 'msg' => 'يجب شراء المنتج واستلامه لتتمكن من التعليق']);
        $checkPurchase->close();
        exit;
    }
    $checkPurchase->close();

    $stmt = $conn->prepare("INSERT INTO product_comments (product_id, user_id, comment, rating, created_at) VALUES (?, ?, ?, ?, NOW())");
    $stmt->bind_param("iisi", $product_id, $user_id, $comment, $rating);
    if ($stmt->execute()) {
        $updateProd = $conn->prepare("
            UPDATE products 
            SET rating = (SELECT AVG(rating) FROM product_comments WHERE product_id = ?),
                rating_count = (SELECT COUNT(*) FROM product_comments WHERE product_id = ?)
            WHERE id = ?
        ");
        $updateProd->bind_param("iii", $product_id, $product_id, $product_id);
        $updateProd->execute();
        $updateProd->close();

        echo json_encode(['success' => true, 'msg' => 'تم إضافة تعليقك وتقييمك بنجاح']);
    } else {
        echo json_encode(['success' => false, 'msg' => 'فشل إضافة التعليق']);
    }
    $stmt->close();
} elseif ($action === 'check_notifications') {
    $user_id = isset($_SESSION['user_id']) ? (int)$_SESSION['user_id'] : 0;
    if ($user_id <= 0) {
        echo json_encode(['success' => false, 'msg' => 'يجب تسجيل الدخول']);
        exit;
    }

    $query = "
        SELECT p.id, p.name, p.image 
        FROM orders o 
        JOIN order_items oi ON o.id = oi.order_id 
        JOIN products p ON oi.product_id = p.id 
        WHERE o.user_id = ? AND (o.status = 'delivered' OR o.status = 'completed')
        AND NOT EXISTS (
            SELECT 1 FROM product_comments pc 
            WHERE pc.user_id = o.user_id AND pc.product_id = p.id
        )
        GROUP BY p.id
    ";
    $stmt = $conn->prepare($query);
    $stmt->bind_param("i", $user_id);
    $stmt->execute();
    $res = $stmt->get_result();
    $pending = [];
    while ($row = $res->fetch_assoc()) {
        $pending[] = $row;
    }
    echo json_encode(['success' => true, 'pending_reviews' => $pending]);
    $stmt->close();
}
$conn->close();
?>
