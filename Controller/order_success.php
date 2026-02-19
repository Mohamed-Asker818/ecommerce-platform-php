<?php
session_start();
require_once '../Vendor/autoload.php'; 
require_once '../Smarty/libs/Smarty.class.php'; 
require_once '../Model/db.php'; 

if (!isset($_SESSION['user_id'])) {
    header('Location: login.php?redirect=order_success');
    exit;
}

$order_id = isset($_GET['id']) ? (int)$_GET['id'] : 0;
if ($order_id <= 0) {
    header('Location: my_orders.php?error=invalid_order');
    exit;
}

$user_id = (int)$_SESSION['user_id'];

require_once '../Api/order_success_api.php'; 
$orderSuccess = new OrderSuccess($conn, $user_id, $order_id);

$orderData = $orderSuccess->getOrderData();

if (!$orderData || !$orderData['order']) {
    header('Location: my_orders.php?error=order_not_found');
    exit;
}

$smarty = new Smarty();
$smarty->setTemplateDir('../Views/');
$smarty->setCompileDir('../Templates_c/');
$smarty->setCacheDir('../Cache/');

$smarty->assign('orderData', $orderData);

$smarty->display('order_success.tpl');
?>
