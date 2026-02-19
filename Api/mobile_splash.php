<?php

ini_set('display_errors', 0);
error_reporting(E_ALL);

if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

require_once __DIR__ . '/../Model/db.php';

if (!isset($smarty) || !($smarty instanceof Smarty)) {
    require_once __DIR__ . '/../Smarty/libs/Smarty.class.php';
    $smarty = new Smarty();
    $smarty->setTemplateDir(__DIR__ . '/../Views/');
    $smarty->setCompileDir(__DIR__ . '/../Controller/templates_c/');
    $smarty->setCacheDir(__DIR__ . '/../Controller/cache/');
    $smarty->setConfigDir(__DIR__ . '/../Controller/configs/');
} else {
    $smarty->addTemplateDir(__DIR__ . '/../Views/');
}

$splashData = [
    'title'              => 'مرحباً بك في متجرنا!',
    'subtitle'           => 'تم تحسين الموقع خصيصاً لتجربة تسوق رائعة على هاتفك',
    'features'           => [
        'واجهة محسّنة للهاتف المحمول',
        'تصفح سريع وسهل للمنتجات',
        'عملية شراء آمنة وموثوقة',
        'دعم العملاء على مدار الساعة'
    ],
    'btn_primary'        => 'ابدأ التسوق الآن',
    'btn_secondary'      => 'عرض نسخة سطح المكتب',
    'checkbox_label'     => 'لا تظهر هذه الرسالة مرة أخرى'
];

$smarty->assign('splash', $splashData);

$format = isset($_GET['format']) ? $_GET['format'] : 'html';

?>

<link rel="stylesheet" href="../Assets/css/mobile_splash.css">
<script src="../Assets/js/mobile_splash.js" defer></script>

<?php
if ($format === 'json') {
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode([
        'success' => true,
        'html'    => $smarty->fetch('mobile_splash.html')
    ], JSON_UNESCAPED_UNICODE);
} else {
    $smarty->display('mobile_splash.html');
}
?>
