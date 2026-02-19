<?php
if (ob_get_level() == 0) ob_start();
ini_set('display_errors', 0);
error_reporting(E_ALL);

session_start();

require_once __DIR__ . '/admin_init.php'; 
require_once __DIR__ . '/../Model/db.php'; 

if (!function_exists('csrf_token')) {
    function csrf_token()
    {
        if (!isset($_SESSION['csrf_token'])) {
            if (function_exists('openssl_random_pseudo_bytes')) {
                $_SESSION['csrf_token'] = bin2hex(openssl_random_pseudo_bytes(32));
            } else {
                $_SESSION['csrf_token'] = bin2hex(md5(uniqid(mt_rand(), true)));
            }
        }
        return $_SESSION['csrf_token'];
    }
}
if (!function_exists('check_csrf')) {
    function check_csrf($t)
    {
        return isset($_SESSION['csrf_token']) && function_exists('hash_equals') ? hash_equals($_SESSION['csrf_token'], (string)$t) : (isset($_SESSION['csrf_token']) && $_SESSION['csrf_token'] === (string)$t);
    }
}

function send_json($status, $msg, $extra = array())
{
    if (ob_get_level()) ob_clean();
    header('Content-Type: application/json; charset=utf-8');
    $payload = array_merge(array('status' => $status, 'msg' => $msg), $extra);
    echo json_encode($payload);
    exit;
}

if (!function_exists('is_admin') || !is_admin()) {
    send_json('error', 'غير مصرح لك بالوصول.', array('redirect' => 'login.php', 'csrf_token' => csrf_token()));
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    send_json('error', 'طريقة الطلب غير صالحة.', array('csrf_token' => csrf_token()));
}

$product_id = isset($_POST['id']) ? (int)$_POST['id'] : 0;
$csrf = isset($_POST['csrf_token']) ? $_POST['csrf_token'] : '';

if (!check_csrf($csrf)) {
    send_json('error', 'فشل التحقق الأمني (CSRF).', array('csrf_token' => csrf_token()));
}

if ($product_id <= 0) {
    send_json('error', 'معرف المنتج غير صالح.', array('csrf_token' => csrf_token()));
}

$stmt = $conn->prepare("SELECT id, image, image_webp, image_thumb_300, image_thumb_800 FROM products WHERE id = ?");
if (!$stmt) {
    send_json('error', 'خطأ في الخادم (prepare).', array('csrf_token' => csrf_token()));
}
$stmt->bind_param('i', $product_id);
if (!$stmt->execute()) {
    $stmt->close();
    send_json('error', 'خطأ في الخادم (execute).', array('csrf_token' => csrf_token()));
}
$stmt->store_result();
if ($stmt->num_rows == 0) {
    $stmt->close();
    send_json('error', 'المنتج غير موجود.', array('csrf_token' => csrf_token()));
}
$stmt->bind_result($pid, $img, $img_webp, $thumb300, $thumb800);
$stmt->fetch();
$stmt->close();

$del = $conn->prepare("DELETE FROM products WHERE id = ?");
if (!$del) {
    send_json('error', 'خطأ في الخادم (prepare delete).', array('csrf_token' => csrf_token()));
}
$del->bind_param('i', $product_id);
if (!$del->execute()) {
    $del->close();
    send_json('error', 'خطأ أثناء حذف المنتج.', array('csrf_token' => csrf_token()));
}
$del->close();

function safe_unlink($path)
{
    if (!$path) return;
    $name = basename($path);
    $cands = array(
        __DIR__ . '/../' . $path,
        __DIR__ . '/assets/images/' . $name,
        __DIR__ . '/../assets/images/' . $name,
        __DIR__ . '/../uploads/products/' . $name,
    );
    foreach ($cands as $f) {
        if ($f && file_exists($f)) {
            @unlink($f);
        }
    }
}
safe_unlink($img);
safe_unlink($img_webp);
safe_unlink($thumb300);
safe_unlink($thumb800);

send_json('success', '✅ تم حذف المنتج بنجاح!', array('csrf_token' => csrf_token()));
