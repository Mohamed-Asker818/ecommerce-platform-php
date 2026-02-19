<?php
require __DIR__ . '/admin_init.php';
require __DIR__ . '/admin_helpers.php';
if (!is_admin()) {
    header("Location: login.php");
    exit;
}

$statsSql = "SELECT
    COUNT(*) AS totalOrders,
    SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS completedOrders,
    SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pendingOrders,
    SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) AS cancelledOrders,
    IFNULL(SUM(CASE WHEN status = 'completed' THEN total ELSE 0 END), 0) AS totalSales
FROM orders";
$statsRes = $conn->query($statsSql);
$stats = $statsRes ? $statsRes->fetch_assoc() : [];
$totalOrders = (int)val($stats, 'totalOrders');
$completedOrders = (int)val($stats, 'completedOrders');
$pendingOrders = (int)val($stats, 'pendingOrders');
$cancelledOrders = (int)val($stats, 'cancelledOrders');
$totalSales = (float)val($stats, 'totalSales');
if ($statsRes) $statsRes->free();

$today = date('Y-m-d');
$salesToday = 0.0;
$stmtToday = $conn->prepare("SELECT IFNULL(SUM(total),0) AS total FROM orders WHERE status='completed' AND DATE(order_date)=?");
if ($stmtToday) {
    $stmtToday->bind_param('s', $today);
    $stmtToday->execute();
    $r = stmt_get_one($stmtToday);
    $salesToday = (float)val($r, 'total');
    $stmtToday->close();
}

$weekDays = [];
$weekSales = [];
$endDate = date('Y-m-d');
$startDate = date('Y-m-d', strtotime('-6 days'));
$mapWeekSales = [];

$stmtWeek = $conn->prepare("SELECT DATE(order_date) AS d, IFNULL(SUM(total),0) AS s FROM orders WHERE status='completed' AND DATE(order_date) BETWEEN ? AND ? GROUP BY DATE(order_date)");
if ($stmtWeek) {
    $stmtWeek->bind_param('ss', $startDate, $endDate);
    $stmtWeek->execute();
    $resWeek = stmt_get_all($stmtWeek);
    foreach ($resWeek as $r) {
        $mapWeekSales[$r['d']] = (float)$r['s'];
    }
    $stmtWeek->close();
}

for ($i = 6; $i >= 0; $i--) {
    $date = date('Y-m-d', strtotime("-{$i} days"));
    $weekDays[] = date('D', strtotime($date));
    $weekSales[] = val($mapWeekSales, $date, 0.0);
}

$monthDays = [];
$monthSales = [];
$daysInMonth = (int)date('t');
$monthStart = date('Y-m-01');
$monthEnd = date('Y-m-t');
$mapMonthSales = [];

$stmtMonth = $conn->prepare("SELECT DATE(order_date) AS d, IFNULL(SUM(total),0) AS s FROM orders WHERE status='completed' AND DATE(order_date) BETWEEN ? AND ? GROUP BY DATE(order_date)");
if ($stmtMonth) {
    $stmtMonth->bind_param('ss', $monthStart, $monthEnd);
    $stmtMonth->execute();
    $resMonth = stmt_get_all($stmtMonth);
    foreach ($resMonth as $r) {
        $mapMonthSales[$r['d']] = (float)$r['s'];
    }
    $stmtMonth->close();
}

for ($d = 1; $d <= $daysInMonth; $d++) {
    $date = date('Y-m-') . str_pad($d, 2, '0', STR_PAD_LEFT);
    $monthDays[] = $d;
    $monthSales[] = val($mapMonthSales, $date, 0.0);
}

$topProducts = [];
$topProductSales = [];
$res = $conn->query("SELECT products.name AS pname, SUM(quantity) AS total_qty FROM order_items INNER JOIN products ON products.id=order_items.product_id GROUP BY product_id ORDER BY total_qty DESC LIMIT 5");
if ($res) {
    while ($r = $res->fetch_assoc()) {
        $topProducts[] = $r['pname'];
        $topProductSales[] = (int)$r['total_qty'];
    }
    $res->free();
}

$prodRes = $conn->query("SELECT id, name, price, image, stock FROM products ORDER BY id DESC LIMIT 200");
$ordersRes = $conn->query("SELECT id, customer_name, phone, total, status, order_date FROM orders ORDER BY id DESC LIMIT 200");

function resolveImageUrl($imgName)
{
    $imgName = ltrim($imgName ?: 'default-product.png', '/');
    $candidates = [
        __DIR__ . '/assets/images/' . $imgName => 'assets/images/' . $imgName,
        __DIR__ . '/../assets/images/' . $imgName => '../assets/images/' . $imgName,
        __DIR__ . '/admin/assets/images/' . $imgName => 'admin/assets/images/' . $imgName,
        __DIR__ . '/../../assets/images/' . $imgName => '../../assets/images/' . $imgName,
    ];
    foreach ($candidates as $file => $url) {
        if (file_exists($file)) {
            return $url;
        }
    }
    return 'assets/images/default-product.png';
}
?>
