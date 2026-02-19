<?php
require __DIR__ . '/admin_init.php';
header('Content-Type: application/json; charset=utf-8');
if (!is_admin()) {
    http_response_code(403);
    echo json_encode(array('success' => false, 'msg' => 'غير مصرح'));
    exit;
}


if (!isset($conn) || !($conn instanceof mysqli)) {
    http_response_code(500);
    error_log('order_details: $conn missing or not mysqli');
    echo json_encode(array('success' => false, 'msg' => 'خطأ بالخادم: إعداد قاعدة البيانات غير صحيح'));
    exit;
}


if (!isset($_GET['id']) || !is_numeric($_GET['id'])) {
    http_response_code(400);
    echo json_encode(array('success' => false, 'msg' => 'معرّف طلب غير صالح'));
    exit;
}
$order_id = intval($_GET['id']);


$st = $conn->prepare("SELECT id, customer_name, phone, address, total, status, order_date, notes FROM orders WHERE id=? LIMIT 1");
if (!$st) {
    http_response_code(500);
    error_log('order_details prepare error: ' . $conn->error);
    echo json_encode(array('success' => false, 'msg' => 'خطأ بالخادم'));
    exit;
}
$st->bind_param('i', $order_id);
$st->execute();
$order = stmt_get_one($st);
$st->close();
if (!$order) {
    http_response_code(404);
    echo json_encode(array('success' => false, 'msg' => 'الطلب غير موجود'));
    exit;
}


$it = $conn->prepare("SELECT oi.product_id, oi.quantity, oi.price, COALESCE(p.name,'') AS name, COALESCE(p.image,'') AS image FROM order_items oi LEFT JOIN products p ON p.id=oi.product_id WHERE oi.order_id=?");
if (!$it) {
    http_response_code(500);
    error_log('order_details items prepare error: ' . $conn->error);
    echo json_encode(array('success' => false, 'msg' => 'خطأ بجلب عناصر الطلب'));
    exit;
}
$it->bind_param('i', $order_id);
$it->execute();
$rows = stmt_get_all($it);
$it->close();


echo json_encode(array('success' => true, 'data' => array(
    'id' => (int)$order['id'],
    'customer' => array('name' => $order['customer_name'], 'phone' => $order['phone'], 'address' => $order['address']),
    'status' => $order['status'],
    'order_date' => $order['order_date'],
    'notes' => $order['notes'],
    'total' => (float)$order['total'],
    'items' => $rows
)), JSON_UNESCAPED_UNICODE);
