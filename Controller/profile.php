<?php
session_start();
require_once '../Vendor/autoload.php';
require_once '../Smarty/libs/Smarty.class.php'; 
require_once '../Model/db.php'; 
if (!isset($_SESSION['user_id'])) {
    header('Location: login.php');
    exit;
}

$smarty = new Smarty();
$smarty->setTemplateDir('../Views/');
$smarty->setCompileDir('../Templates_c/');
$smarty->setCacheDir('../Cache/');

$user_id = (int)$_SESSION['user_id'];
$smarty->assign('user_id', $user_id);

$smarty->display('profile.html');
?>
