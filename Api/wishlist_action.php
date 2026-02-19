<?php
session_start();

ini_set('display_errors', 0);
error_reporting(E_ALL);

require_once __DIR__ . '/../Model/db.php';

header('Content-Type: application/json; charset=utf-8');

function sendResponse($success, $msg, $status = '', $count = 0) {
    echo json_encode([
        'success' => $success, 
        'msg' => $msg, 
        'status' => $status, 
        'count' => $count
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

$user_id = isset($_SESSION['user_id']) ? (int)$_SESSION['user_id'] : 0;
$action = isset($_REQUEST['action']) ? $_REQUEST['action'] : 'toggle';
$product_id = isset($_REQUEST['id']) ? (int)$_REQUEST['id'] : 0;

if ($product_id <= 0) {
    sendResponse(false, '❌ معرف المنتج غير صالح');
}

if ($user_id <= 0) {
    if (!isset($_SESSION['wishlist'])) {
        $_SESSION['wishlist'] = [];
    }
    
    $exists = in_array($product_id, $_SESSION['wishlist']);
    
    if ($action === 'toggle') {
        if ($exists) {
            $_SESSION['wishlist'] = array_diff($_SESSION['wishlist'], [$product_id]);
            sendResponse(true, '💔 تمت إزالة المنتج من قائمة الرغبات', 'removed', count($_SESSION['wishlist']));
        } else {
            $_SESSION['wishlist'][] = $product_id;
            sendResponse(true, '❤️ تمت إضافة المنتج إلى قائمة الرغبات', 'added', count($_SESSION['wishlist']));
        }
    }
    
    sendResponse(true, '', $exists ? 'exists' : 'not_exists', count($_SESSION['wishlist']));
}

try {
    $exists = false;
    $stmt = $conn->prepare("SELECT id FROM user_wishlist WHERE user_id=? AND product_id=?");
    if ($stmt) {
        $stmt->bind_param('ii', $user_id, $product_id);
        $stmt->execute();
        $res = $stmt->get_result();
        if ($res->num_rows > 0) {
            $exists = true;
        }
        $stmt->close();
    }

    if ($action === 'toggle') {
        if ($exists) {
            $d = $conn->prepare("DELETE FROM user_wishlist WHERE user_id=? AND product_id=?");
            if ($d) {
                $d->bind_param('ii', $user_id, $product_id);
                $d->execute();
                $d->close();
                
                $c = $conn->prepare("SELECT COUNT(*) FROM user_wishlist WHERE user_id=?");
                $c->bind_param('i', $user_id);
                $c->execute();
                $c->bind_result($cnt);
                $c->fetch();
                $c->close();
                
                sendResponse(true, '💔 تمت إزالة المنتج من قائمة الرغبات', 'removed', (int)$cnt);
            }
        } else {
            $i = $conn->prepare("INSERT IGNORE INTO user_wishlist (user_id, product_id) VALUES (?,?)");
            if ($i) {
                $i->bind_param('ii', $user_id, $product_id);
                $i->execute();
                $i->close();
                
                $c = $conn->prepare("SELECT COUNT(*) FROM user_wishlist WHERE user_id=?");
                $c->bind_param('i', $user_id);
                $c->execute();
                $c->bind_result($cnt);
                $c->fetch();
                $c->close();
                
                sendResponse(true, '❤️ تمت إضافة المنتج إلى قائمة الرغبات', 'added', (int)$cnt);
            }
        }
    }

    $c = $conn->prepare("SELECT COUNT(*) FROM user_wishlist WHERE user_id=?");
    $c->bind_param('i', $user_id);
    $c->execute();
    $c->bind_result($cnt);
    $c->fetch();
    $c->close();
    
    sendResponse(true, '', $exists ? 'exists' : 'not_exists', (int)$cnt);

} catch (Exception $e) {
    sendResponse(false, 'حدث خطأ فني');
} finally {
    if (isset($conn)) {
        $conn->close();
    }
}
?>
