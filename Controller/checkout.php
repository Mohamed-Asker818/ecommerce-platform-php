<?php
session_start();

require_once '../Smarty/libs/Smarty.class.php';
require_once '../Model/db.php';

$smarty = new Smarty();
$smarty->setTemplateDir('../Views/');
$smarty->setCompileDir('../Templates_c/');
$smarty->setCacheDir('../Cache/');

if (!isset($_SESSION['user_id'])) {
    header('Location: login.php?redirect=checkout');
    exit;
}

$user_id = $_SESSION['user_id'];
$cart_items = []; 
$total_amount = 0; 

$smarty->assign('cart_items', $cart_items);
$smarty->assign('total_amount', $total_amount);

$smarty->display('checkout.html');
?>
