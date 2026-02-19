<?php

session_start();

$action = isset($_GET['action']) ? $_GET['action'] : '';
$view = isset($_GET['view']) ? $_GET['view'] : 'mobile';

header('Content-Type: application/json');

try {
    if ($action === 'hide_splash') {
        setcookie('hide_mobile_splash', '1', time() + (30 * 24 * 60 * 60), '/');
        $_SESSION['hide_mobile_splash'] = '1';
        
        echo json_encode(['success' => true, 'message' => 'تم حفظ التفضيل']);
    } elseif ($view === 'desktop') {
        setcookie('preferred_view', 'desktop', time() + (365 * 24 * 60 * 60), '/');
        $_SESSION['preferred_view'] = 'desktop';
        
        echo json_encode(['success' => true, 'message' => 'تم التبديل إلى نسخة سطح المكتب']);
    } elseif ($view === 'mobile') {
        setcookie('preferred_view', 'mobile', time() + (365 * 24 * 60 * 60), '/');
        $_SESSION['preferred_view'] = 'mobile';
        
        echo json_encode(['success' => true, 'message' => 'تم التبديل إلى نسخة الهاتف']);
    } else {
        echo json_encode(['success' => false, 'message' => 'إجراء غير معروف']);
    }
} catch (Exception $e) {
    echo json_encode(['success' => false, 'message' => 'حدث خطأ: ' . $e->getMessage()]);
}
?>
