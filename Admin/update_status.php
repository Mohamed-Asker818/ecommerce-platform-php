<?php
require_once __DIR__ . '/admin_init.php';

header('Content-Type: application/json; charset=utf-8');

if (!is_admin()) {
    echo json_encode(['success' => false, 'msg' => 'غير مصرح لك بالقيام بهذا الإجراء']);
    exit;
}

$id = isset($_POST['id']) ? (int)$_POST['id'] : 0;
$status = isset($_POST['status']) ? $_POST['status'] : '';

if ($id <= 0 || empty($status)) {
    echo json_encode(['success' => false, 'msg' => 'بيانات غير صالحة']);
    exit;
}

$stmt = $conn->prepare("UPDATE orders SET status = ? WHERE id = ?");
$stmt->bind_param("si", $status, $id);

if ($stmt->execute()) {
   
    echo json_encode(['success' => true, 'msg' => 'تم تحديث حالة الطلب بنجاح']);
} else {
    echo json_encode(['success' => false, 'msg' => 'فشل تحديث حالة الطلب']);
}

$stmt->close();
$conn->close();
?>
