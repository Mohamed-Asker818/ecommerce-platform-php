<?php
session_start();

require_once '../Smarty/libs/Smarty.class.php';
require_once '../Model/db.php';

$smarty = new Smarty();
$smarty->setTemplateDir('../Views/');
$smarty->setCompileDir('../Templates_c/');
$smarty->setCacheDir('../Cache/');

$id = isset($_GET['id']) ? intval($_GET['id']) : 0;
if ($id <= 0) {
    header('Location: Home.php');
    exit;
}

$stmt = $conn->prepare("SELECT *, 
                       COALESCE(CONCAT('uploads/high-quality/', image), image) as hq_image 
                       FROM products WHERE id = ? LIMIT 1");
$stmt->bind_param("i", $id);
$stmt->execute();
$res = $stmt->get_result();

if ($res->num_rows === 0) {
    header('Location: Home.php');
    exit;
}

$product = $res->fetch_assoc();
$stmt->close();

$product['display_image'] = !empty($product['hq_image']) ? $product['hq_image'] : $product['image'];

$similar_products = [];
$similar_stmt = $conn->prepare("SELECT id, name, price, 
                               COALESCE(CONCAT('uploads/high-quality/', image), image) as display_image 
                               FROM products 
                               WHERE category_id = ? AND id != ? AND stock > 0 
                               ORDER BY RAND() LIMIT 4");
$similar_stmt->bind_param("ii", $product['category_id'], $id);
$similar_stmt->execute();
$similar_result = $similar_stmt->get_result();
while($row = $similar_result->fetch_assoc()) {
    $similar_products[] = $row;
}
$similar_stmt->close();

$cart_count = 0;
if (isset($_SESSION['user_id'])) {
    $user_id = $_SESSION['user_id'];
    $cart_stmt = $conn->prepare("SELECT SUM(quantity) as count FROM user_cart WHERE user_id = ?");
    $cart_stmt->bind_param("i", $user_id);
    $cart_stmt->execute();
    $cart_res = $cart_stmt->get_result();
    if ($cart_row = $cart_res->fetch_assoc()) {
        $cart_count = $cart_row['count'] ?: 0;
    }
    $cart_stmt->close();
} elseif (isset($_SESSION['cart'])) {
    $cart_count = array_sum($_SESSION['cart']);
}

$smarty->assign('product', $product);
$smarty->assign('similar_products', $similar_products);
$smarty->assign('cart_count', $cart_count);

$smarty->display('product.html');
?>
