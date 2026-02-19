<?php
session_start();
require_once '../Vendor/autoload.php'; 
require_once '../Smarty/libs/Smarty.class.php'; 
require_once '../Model/db.php'; 

if (isset($_SESSION['user_id'])) {
    header('Location: Home.php');
    exit;
}

$smarty = new Smarty();
$smarty->setTemplateDir('../Views/');
$smarty->setCompileDir('../Templates_c/');
$smarty->setCacheDir('../Cache/');

$smarty->display('register.html');
?>
