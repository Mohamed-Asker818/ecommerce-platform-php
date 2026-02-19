<?php
session_start();
ini_set('display_errors', 0);
ini_set('display_startup_errors', 0);
error_reporting(E_ALL);

require_once __DIR__ . '/../Model/db.php';
require_once __DIR__ . '/cache.php';
require_once __DIR__ . '/../Smarty/libs/Smarty.class.php';

if (empty($_SESSION['csrf_token'])) {
    $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
}

$cache = new SimpleCache(300);
$smarty = new Smarty();
$smarty->registerPlugin('modifier', 'urlencode', 'urlencode');
$smarty->registerPlugin('modifier', 'number_format', 'number_format');
$smarty->setTemplateDir(__DIR__ . '/templates/');
$smarty->setCompileDir(__DIR__ . '/templates_c/');
$smarty->setCacheDir(__DIR__ . '/cache/');
$smarty->setConfigDir(__DIR__ . '/configs/');

if (is_file(__DIR__ . '/../Api/mobile_detection.php')) {
    include_once __DIR__ . '/../Api/mobile_detection.php';
    $show_mobile_splash = function_exists('should_show_mobile_ui') ? should_show_mobile_ui() : false;
} else {
    $show_mobile_splash = false;
}

function safe_int($v) { return isset($v) ? (int)$v : 0; }
function safe_float($v) { return isset($v) ? (float)$v : 0.0; }

$wishlist = [];
if (isset($_SESSION['user_id'])) {
    $uid = intval($_SESSION['user_id']);
    $wStmt = $conn->prepare("SELECT product_id FROM user_wishlist WHERE user_id=?");
    if ($wStmt) {
        $wStmt->bind_param("i", $uid);
        $wStmt->execute();
        $wRes = $wStmt->get_result();
        while ($w = $wRes->fetch_assoc()) {
            $wishlist[] = (int)$w['product_id'];
        }
        $wStmt->close();
    }
} else {
    $wishlist = isset($_SESSION['wishlist']) && is_array($_SESSION['wishlist']) ? array_map('intval', $_SESSION['wishlist']) : [];
}
$wishlistCount = count($wishlist);

$cart = [];
if (isset($_SESSION['user_id'])) {
    $uid = intval($_SESSION['user_id']);
    $cStmt = $conn->prepare("SELECT product_id, quantity FROM user_cart WHERE user_id=?");
    if ($cStmt) {
        $cStmt->bind_param("i", $uid);
        $cStmt->execute();
        $cRes = $cStmt->get_result();
        while ($c = $cRes->fetch_assoc()) {
            $cart[(int)$c['product_id']] = (int)$c['quantity'];
        }
        $cStmt->close();
    }
} else {
    if (isset($_SESSION['cart']) && is_array($_SESSION['cart'])) {
        foreach ($_SESSION['cart'] as $k => $v) {
            if (is_array($v) && isset($v['quantity'])) {
                $cart[intval($k)] = intval($v['quantity']);
            } else {
                $cart[intval($k)] = intval($v);
            }
        }
    }
}
$cartCount = array_sum($cart);

$compare_ids = isset($_SESSION['compare']) ? array_keys($_SESSION['compare']) : [];
$compareCount = count($compare_ids);

$searchRaw = isset($_GET['q']) ? $_GET['q'] : '';
$search = "{$searchRaw}%";

$perPage = 20;
$page = isset($_GET['page']) ? max(1, (int)$_GET['page']) : 1;
$start = ($page - 1) * $perPage;

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
        case 'newest':
            $orderSQL = "ORDER BY created_at DESC, id DESC";
            break;
        case 'price-asc':
            $orderSQL = "ORDER BY price ASC, created_at DESC";
            break;
        case 'price-desc':
            $orderSQL = "ORDER BY price DESC, created_at DESC";
            break;
    }
}

$sql = "SELECT id, name, price, old_price, stock, is_new, image, countdown FROM products $whereSQL $orderSQL LIMIT ?, ?";
$paramsWithLimit = $params;
$paramsWithLimit[] = $start;
$paramsWithLimit[] = $perPage;
$typesWithLimit = $types . "ii";

$stmt = $conn->prepare($sql);
if ($stmt === false) {
    $errorOut = ['ok' => false, 'error' => 'prepare_failed', 'message' => $conn->error];
    if ((isset($_GET['format']) && $_GET['format'] === 'json') || (isset($_SERVER['HTTP_X_REQUESTED_WITH']) && strtolower($_SERVER['HTTP_X_REQUESTED_WITH']) === 'xmlhttprequest')) {
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode($errorOut, JSON_UNESCAPED_UNICODE);
        exit;
    } else {
        die("DB prepare failed: " . htmlspecialchars($conn->error));
    }
}

$bindParams = [];
foreach ($paramsWithLimit as $k => $v) {
    $bindParams[$k] = &$paramsWithLimit[$k];
}
array_unshift($bindParams, $typesWithLimit);
call_user_func_array([$stmt, 'bind_param'], $bindParams);

$cacheKey = 'products_' . md5(json_encode($paramsWithLimit) . $typesWithLimit . $orderSQL);
$products = $cache->get($cacheKey);
if ($products === false) {
    $stmt->execute();
    $res = $stmt->get_result();
    $products = $res->fetch_all(MYSQLI_ASSOC);
    $cache->set($cacheKey, $products);
}
$stmt->close();

$countSql = "SELECT COUNT(*) as total FROM products $whereSQL";
$countStmt = $conn->prepare($countSql);
if ($countStmt === false) {
    $errorOut = ['ok' => false, 'error' => 'prepare_failed_count'];
    if ((isset($_GET['format']) && $_GET['format'] === 'json') || (isset($_SERVER['HTTP_X_REQUESTED_WITH']) && strtolower($_SERVER['HTTP_X_REQUESTED_WITH']) === 'xmlhttprequest')) {
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode($errorOut, JSON_UNESCAPED_UNICODE);
        exit;
    } else {
        die("DB prepare failed (count).");
    }
}
if (!empty($params)) {
    $bindCount = [$types];
    foreach ($params as $k => $v) { $bindCount[] = &$params[$k]; }
    call_user_func_array([$countStmt, 'bind_param'], $bindCount);
}
$countKey = 'products_count_' . md5(json_encode($params) . $types . $orderSQL);
$total = $cache->get($countKey);
if ($total === false) {
    $countStmt->execute();
    $countRes = $countStmt->get_result()->fetch_assoc();
    $total = isset($countRes['total']) ? intval($countRes['total']) : 0;
    $cache->set($countKey, $total);
}
$countStmt->close();

$totalPages = max(1, ceil($total / $perPage));
$hasNextPage = $page < $totalPages;

$featuredSql = "SELECT id, name, price, old_price, image FROM products WHERE featured = 1 ORDER BY created_at DESC LIMIT 4";
$featuredRes = $conn->query($featuredSql);
$featuredProducts = $featuredRes ? $featuredRes->fetch_all(MYSQLI_ASSOC) : [];

$productIds = [];
foreach ($products as $p) { $productIds[] = (int)$p['id']; }
$ratings = [];
if (!empty($productIds)) {
    $placeholders = implode(',', array_fill(0, count($productIds), '?'));
    $ratingSql = "SELECT product_id, AVG(rating) as avg_rating, COUNT(*) as cnt FROM product_ratings WHERE product_id IN ($placeholders) GROUP BY product_id";
    $ratingStmt = $conn->prepare($ratingSql);
    if ($ratingStmt) {
        $typesStr = str_repeat('i', count($productIds));
        $ratingStmt->bind_param($typesStr, ...$productIds);
        $ratingStmt->execute();
        $rres = $ratingStmt->get_result();
        while ($row = $rres->fetch_assoc()) {
            $ratings[(int)$row['product_id']] = [
                'avg' => $row['avg_rating'] ? round($row['avg_rating'], 2) : 0,
                'cnt' => intval($row['cnt'])
            ];
        }
        $ratingStmt->close();
    }
}

$userName = '';
$userAvatar = 'default_avatar.png';
$loggedIn = false;

if (isset($_SESSION['user_id'])) {
    $loggedIn = true;
    $uid = (int)$_SESSION['user_id'];

    $uStmt = $conn->prepare("SELECT name, avatar FROM users WHERE id=? LIMIT 1");
    if ($uStmt) {
        $uStmt->bind_param("i", $uid);
        $uStmt->execute();
        $uRes = $uStmt->get_result()->fetch_assoc();

        $userName = !empty($uRes['name']) ? htmlspecialchars($uRes['name']) : '';

        if (!empty($uRes['avatar'])) {
            $avatarPath = __DIR__ . '/../Assets/uploads/avatars/' . $uRes['avatar'];
            if (file_exists($avatarPath)) {
                $userAvatar = $uRes['avatar'];
            }
        }
        $uStmt->close();
    }
}

$categories = [];
$catStmt = $conn->query("SELECT c.id, c.name, c.image, COUNT(p.id) as product_count FROM categories c LEFT JOIN products p ON c.id = p.category_id GROUP BY c.id ORDER BY c.id");
while ($cat = $catStmt->fetch_assoc()) {
    $categories[] = [
        'id' => (int)$cat['id'],
        'name' => htmlspecialchars($cat['name']),
        'image' => !empty($cat['image']) ? $cat['image'] : 'clothes.png',
        'count' => (int)$cat['product_count']
    ];
}

$randomKey = 'random_products_home';
$randomProducts = $cache->get($randomKey);
if ($randomProducts === false) {
    $randomSql = "SELECT id, name, price, old_price, image FROM products LIMIT 10";
    $randomRes = $conn->query($randomSql);
    $randomProducts = $randomRes ? $randomRes->fetch_all(MYSQLI_ASSOC) : [];
    $cache->set($randomKey, $randomProducts, 3600);
}

$isAjax = (isset($_SERVER['HTTP_X_REQUESTED_WITH']) && strtolower($_SERVER['HTTP_X_REQUESTED_WITH']) === 'xmlhttprequest');

$selectedCategoryName = '';
$currentCategoryId = isset($_GET['category']) ? intval($_GET['category']) : '';
if (!empty($currentCategoryId)) {
    $catQuery = $conn->prepare("SELECT name FROM categories WHERE id = ?");
    if ($catQuery) {
        $catQuery->bind_param("i", $currentCategoryId);
        $catQuery->execute();
        $catResult = $catQuery->get_result();
        if ($catRow = $catResult->fetch_assoc()) {
            $selectedCategoryName = htmlspecialchars($catRow['name']);
        }
        $catQuery->close();
    }
}

$productPayload = [];
foreach ($products as $row) {
    $pid = (int)$row['id'];
    $imgName = !empty($row['image']) ? $row['image'] : 'default-product.png';
    $discount = 0;
    if (!empty($row['old_price']) && $row['old_price'] > $row['price']) {
        $discount = round((($row['old_price'] - $row['price']) / $row['old_price']) * 100);
    }
    $productPayload[] = [
        'id' => $pid,
        'name' => htmlspecialchars($row['name']),
        'price' => (float)$row['price'],
        'old_price' => isset($row['old_price']) ? (float)$row['old_price'] : 0,
        'stock' => (int)$row['stock'],
        'is_new' => (bool)$row['is_new'],
        'image' => $imgName,
        'discount' => $discount,
        'rating' => isset($ratings[$pid]) ? $ratings[$pid]['avg'] : 0,
        'rating_count' => isset($ratings[$pid]) ? $ratings[$pid]['cnt'] : 0,
        'in_wishlist' => in_array($pid, $wishlist),
        'in_compare' => in_array($pid, $compare_ids),
        'countdown' => $row['countdown']
    ];
}

$featuredPayload = [];
foreach ($featuredProducts as $p) {
    $featuredPayload[] = [
        'id' => (int)$p['id'],
        'name' => htmlspecialchars($p['name']),
        'price' => (float)$p['price'],
        'old_price' => isset($p['old_price']) ? (float)$p['old_price'] : 0,
        'image' => !empty($p['image']) ? $p['image'] : 'default-product.png'
    ];
}

$randomPayload = [];
foreach ($randomProducts as $p) {
    $randomPayload[] = [
        'id' => (int)$p['id'],
        'name' => htmlspecialchars($p['name']),
        'price' => (float)$p['price'],
        'old_price' => isset($p['old_price']) ? (float)$p['old_price'] : 0,
        'image' => !empty($p['image']) ? $p['image'] : 'default-product.png'
    ];
}

$phpVars = [
    'page' => $page,
    'hasNextPage' => $hasNextPage,
    'total' => $total,
    'compareCount' => $compareCount,
    'searchQuery' => $searchRaw,
    'selectedCategoryName' => $selectedCategoryName,
    'currentCategoryId' => $currentCategoryId
];

$response = [
    'ok' => true,
    'show_mobile_splash' => (bool)$show_mobile_splash,
    'logged_in' => $loggedIn,
    'user' => [
        'name' => $userName,
        'avatar' => $userAvatar
    ],
    'counts' => [
        'cart' => $cartCount,
        'wishlist' => $wishlistCount,
        'compare' => $compareCount
    ],
    'categories' => $categories,
    'products' => $productPayload,
    'featured' => $featuredPayload,
    'random' => $randomPayload,
    'phpVars' => $phpVars
];

if ($isAjax || (isset($_GET['format']) && $_GET['format'] === 'json')) {
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($response, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    exit;
}

$smarty->assign('csrf_token', $_SESSION['csrf_token']);
$smarty->assign('show_mobile_splash', (bool)$show_mobile_splash);
$smarty->assign('logged_in', $loggedIn);
$smarty->assign('user', ['name' => $userName, 'avatar' => $userAvatar]);
$smarty->assign('counts', ['cart' => $cartCount, 'wishlist' => $wishlistCount, 'compare' => $compareCount]);
$smarty->assign('categories', $categories);
$smarty->assign('products', $productPayload);
$smarty->assign('featured', $featuredPayload);
$smarty->assign('random_products', $randomPayload);
$smarty->assign('selectedCategoryName', $selectedCategoryName);
$smarty->assign('currentCategoryId', $currentCategoryId);
$smarty->assign('phpVarsJson', json_encode($phpVars, JSON_UNESCAPED_UNICODE));
$smarty->assign('year', date('Y'));

$smarty->display('../Views/Home.html');
