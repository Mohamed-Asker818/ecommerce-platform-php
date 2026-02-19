<?php
session_start();
header('Content-Type: application/json');
$id = isset($_GET['id']) ? intval($_GET['id']) : 0;
$action = isset($_GET['action']) ? $_GET['action'] : 'toggle';
if ($action === 'clear') {
  $_SESSION['compare'] = [];
  echo json_encode(['success' => true, 'msg' => 'تم مسح قائمة المقارنة', 'count' => 0]);
  exit;
}

if ($id <= 0) {
  echo json_encode(['success' => false, 'msg' => 'Id invalid']);
  exit;
}
if (!isset($_SESSION['compare'])) $_SESSION['compare'] = [];

if ($action === 'toggle') {
  if (isset($_SESSION['compare'][$id])) {
    unset($_SESSION['compare'][$id]);
    echo json_encode(['success' => true, 'status' => 'removed', 'msg' => 'أزيل من المقارنة', 'count' => count($_SESSION['compare'])]);
    exit;
  } else {
    if (count($_SESSION['compare']) >= 4) {
      echo json_encode(['success' => false, 'msg' => 'الحد الأقصى للمقارنة هو 4']);
      exit;
    }
    $_SESSION['compare'][$id] = true;
    echo json_encode(['success' => true, 'status' => 'added', 'msg' => 'أضيف للمقارنة', 'count' => count($_SESSION['compare'])]);
    exit;
  }
}
