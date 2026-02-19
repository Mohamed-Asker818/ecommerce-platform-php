<?php
session_start();

require_once __DIR__ . '/../Model/db.php';
require_once __DIR__ . '/../Smarty/libs/Smarty.class.php';

$id = isset($_GET['id']) ? intval($_GET['id']) : 0;
if ($id <= 0) {
    echo '<div class="error" style="padding:20px; text-align:center; color:red;">معرف المنتج غير صالح</div>';
    exit;
}

$smarty = new Smarty();
$smarty->registerPlugin('modifier', 'urlencode', 'urlencode');
$smarty->registerPlugin('modifier', 'number_format', 'number_format');
$smarty->setTemplateDir(__DIR__ . '/templates/');
$smarty->setCompileDir(__DIR__ . '/templates_c/');

try {
    $sql = "SELECT p.*, c.name as category_name, 
            (SELECT AVG(rating) FROM product_ratings WHERE product_id = p.id) as avg_rating,
            (SELECT COUNT(*) FROM product_ratings WHERE product_id = p.id) as review_count
            FROM products p 
            LEFT JOIN categories c ON p.category_id = c.id 
            WHERE p.id = ? LIMIT 1";
    $stmt = $conn->prepare($sql);
    $stmt->bind_param('i', $id);
    $stmt->execute();
    $res = $stmt->get_result();
    
    if ($res->num_rows == 0) {
        echo '<div class="error" style="padding:20px; text-align:center; color:red;">المنتج غير موجود</div>';
        exit;
    }
    
    $row = $res->fetch_assoc();
    $stmt->close();
    
    $relStmt = $conn->prepare("SELECT id, name, price, image FROM products 
                               WHERE category_id = ? AND id <> ? 
                               AND stock > 0 
                               ORDER BY RAND() LIMIT 6");
    $relStmt->bind_param('ii', $row['category_id'], $id);
    $relStmt->execute();
    $rels = $relStmt->get_result()->fetch_all(MYSQLI_ASSOC);
    $relStmt->close();
    
    $product_data = [
        'id' => $row['id'],
        'name' => htmlspecialchars($row['name']),
        'brand' => htmlspecialchars($row['category_name'] ?? 'ماركة فاخرة'),
        'price' => (float)$row['price'],
        'old_price' => ($row['old_price'] && $row['old_price'] > $row['price']) ? (float)$row['old_price'] : null,
        'image_url' => 'image.php?src=' . urlencode(!empty($row['image']) ? $row['image'] : 'default-product.png') . '&w=600&h=600&q=95',
        'avg_rating' => round($row['avg_rating'] ?? 5, 1),
        'review_count' => $row['review_count'] ?? 0
    ];

    $smarty->assign('product', $product_data);
    $smarty->assign('related_products', $rels);

    $smarty->display('../Views/product_quick.html');

} catch (Exception $e) {
    echo '<div class="error" style="padding:20px; text-align:center; color:red;">حدث خطأ في تحميل البيانات</div>';
    exit;
}
