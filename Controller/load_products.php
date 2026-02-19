<?php

session_start();

ini_set('display_errors', 0);
error_reporting(E_ALL);

require_once __DIR__ . '/../Model/db.php';
require_once __DIR__ . '/../Smarty/libs/Smarty.class.php';

$smarty = new Smarty();
$smarty->registerPlugin('modifier', 'urlencode', 'urlencode');
$smarty->registerPlugin('modifier', 'number_format', 'number_format');
$smarty->setTemplateDir(__DIR__ . '/../Views/');
$smarty->setCompileDir(__DIR__ . '/templates_c/');

function sendResponse($success, $data = []) {
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(array_merge(['success' => $success], $data));
    exit;
}

if (!$conn) {
    sendResponse(false, ['msg' => 'فشل الاتصال بقاعدة البيانات']);
}

$wishlist_ids = [];
if (isset($_SESSION['user_id'])) {
    $uid = intval($_SESSION['user_id']);
    $wStmt = $conn->prepare("SELECT product_id FROM user_wishlist WHERE user_id=?");
    if ($wStmt) {
        $wStmt->bind_param("i", $uid);
        $wStmt->execute();
        $wRes = $wStmt->get_result();
        while ($w = $wRes->fetch_assoc()) {
            $wishlist_ids[] = (int)$w['product_id'];
        }
        $wStmt->close();
    }
} else {
    $wishlist_ids = isset($_SESSION['wishlist']) && is_array($_SESSION['wishlist']) ? array_map('intval', $_SESSION['wishlist']) : [];
}

$compare_ids = isset($_SESSION['compare']) ? array_keys($_SESSION['compare']) : [];

$page = isset($_GET['page']) ? max(1, (int)$_GET['page']) : 1;
$perPage = isset($_GET['limit']) ? min(100, (int)$_GET['limit']) : 12;
$start = ($page - 1) * $perPage;

$searchRaw = $_GET['q'] ?? '';
$search = "%{$searchRaw}%";

$whereSQL = "WHERE name LIKE ?";
$params = [$search];
$types = "s";

if (!empty($_GET['category'])) {
    $whereSQL .= " AND category_id=?";
    $params[] = intval($_GET['category']);
    $types .= "i";
}
if (isset($_GET['min']) && $_GET['min'] !== '') {
    $whereSQL .= " AND price>=?";
    $params[] = floatval($_GET['min']);
    $types .= "d";
}
if (isset($_GET['max']) && $_GET['max'] !== '') {
    $whereSQL .= " AND price<=?";
    $params[] = floatval($_GET['max']);
    $types .= "d";
}

$orderSQL = "ORDER BY id DESC";
if (!empty($_GET['sort'])) {
    switch ($_GET['sort']) {
        case 'newest': $orderSQL = "ORDER BY created_at DESC, id DESC"; break;
        case 'price-asc': $orderSQL = "ORDER BY price ASC, created_at DESC"; break;
        case 'price-desc': $orderSQL = "ORDER BY price DESC, created_at DESC"; break;
    }
}

$sql = "SELECT id, name, price, old_price, stock, is_new, image FROM products $whereSQL $orderSQL LIMIT ?, ?";
$stmt = $conn->prepare($sql);
if (!$stmt) {
    sendResponse(false, ['msg' => 'خطأ في استعلام قاعدة البيانات']);
}

$paramsWithLimit = array_merge($params, [$start, $perPage]);
$typesWithLimit = $types . "ii";

$stmt->bind_param($typesWithLimit, ...$paramsWithLimit);
$stmt->execute();
$result = $stmt->get_result();
$productsRaw = $result->fetch_all(MYSQLI_ASSOC);
$stmt->close();

$countSql = "SELECT COUNT(*) as total FROM products $whereSQL";
$countStmt = $conn->prepare($countSql);
$total = 0;
if ($countStmt) {
    $countStmt->bind_param($types, ...$params);
    $countStmt->execute();
    $total = (int) $countStmt->get_result()->fetch_assoc()['total'];
    $countStmt->close();
}

$totalPages = ceil($total / $perPage);
$hasNextPage = $page < $totalPages;

$productIds = array_map(fn($p) => (int)$p['id'], $productsRaw);
$ratings = [];
if (!empty($productIds)) {
    $placeholders = implode(',', array_fill(0, count($productIds), '?'));
    $ratingSql = "SELECT product_id, AVG(rating) as avg_rating, COUNT(*) as cnt FROM product_ratings WHERE product_id IN ($placeholders) GROUP BY product_id";
    $ratingStmt = $conn->prepare($ratingSql);
    if ($ratingStmt) {
        $ratingStmt->bind_param(str_repeat('i', count($productIds)), ...$productIds);
        $ratingStmt->execute();
        $rres = $ratingStmt->get_result();
        while ($row = $rres->fetch_assoc()) {
            $ratings[(int)$row['product_id']] = ['avg' => round((float)$row['avg_rating'], 1), 'cnt' => (int)$row['cnt']];
        }
        $ratingStmt->close();
    }
}

$productPayload = [];
foreach ($productsRaw as $row) {
    $pid = (int)$row['id'];
    $discount = (!empty($row['old_price']) && $row['old_price'] > $row['price']) ? round((($row['old_price'] - $row['price']) / $row['old_price']) * 100) : 0;
    
    $productPayload[] = [
        'id' => $pid,
        'name' => $row['name'],
        'price' => (float)$row['price'],
        'old_price' => (float)$row['old_price'],
        'stock' => (int)$row['stock'],
        'is_new' => (bool)$row['is_new'],
        'image' => !empty($row['image']) ? $row['image'] : 'default-product.png',
        'discount' => $discount,
        'rating' => $ratings[$pid]['avg'] ?? 0,
        'rating_count' => $ratings[$pid]['cnt'] ?? 0,
        'in_wishlist' => in_array($pid, $wishlist_ids),
        'in_compare' => in_array($pid, $compare_ids)
    ];
}

$smarty->assign('products', $productPayload);
$html = $smarty->fetch('load_products.html');

sendResponse(true, [
    'html' => $html,
    'hasNextPage' => $hasNextPage,
    'total' => $total,
    'page' => $page
]);
