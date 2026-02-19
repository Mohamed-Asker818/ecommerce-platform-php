<?php
session_start();

ini_set('display_errors', 1);
error_reporting(E_ALL);

require_once __DIR__ . '/../Model/db.php';
require_once __DIR__ . '/../Smarty/libs/Smarty.class.php';

$smarty = new Smarty();
$smarty->setTemplateDir(__DIR__ . '/../Views/');
$smarty->setCompileDir(__DIR__ . '/../Templates_c/');
$smarty->setCacheDir(__DIR__ . '/../Cache/');

$user_id = isset($_SESSION['user_id']) ? (int)$_SESSION['user_id'] : 0;
$logged_in = ($user_id > 0);

$cartCount = 0;
$wishlistCount = 0;
$compareCount = isset($_SESSION['compare']) ? count($_SESSION['compare']) : 0;

if ($logged_in) {
    $cStmt = $conn->prepare("SELECT SUM(quantity) as total FROM user_cart WHERE user_id = ?");
    $cStmt->bind_param("i", $user_id);
    $cStmt->execute();
    $cRes = $cStmt->get_result()->fetch_assoc();
    $cartCount = (int)($cRes['total'] ?? 0);
    $cStmt->close();

    $wStmt = $conn->prepare("SELECT COUNT(*) as total FROM user_wishlist WHERE user_id = ?");
    $wStmt->bind_param("i", $user_id);
    $wStmt->execute();
    $wRes = $wStmt->get_result()->fetch_assoc();
    $wishlistCount = (int)($wRes['total'] ?? 0);
    $wStmt->close();
} else {
    $cartCount = isset($_SESSION['cart']) ? array_sum($_SESSION['cart']) : 0;
    $wishlistCount = isset($_SESSION['wishlist']) ? count($_SESSION['wishlist']) : 0;
}

$smarty->assign('logged_in', $logged_in);
$smarty->assign('counts', [
    'cart' => $cartCount,
    'wishlist' => $wishlistCount,
    'compare' => $compareCount
]);

$smarty->display('cart.html');
?>
