<?php
session_start();
require_once '../Smarty/libs/Smarty.class.php';
require_once '../Model/db.php';
$smarty = new Smarty();
$smarty->setTemplateDir('../Views/');
$smarty->setCompileDir('../Templates_c/');
$smarty->setCacheDir('../Cache/');
$products_to_compare = []; 
$smarty->assign('products', $products_to_compare);
$smarty->display('compare.html');
?>
