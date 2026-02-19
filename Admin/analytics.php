<?php
require __DIR__ . '/admin_init.php';
require __DIR__ . '/admin_helpers.php'; 

if (!is_admin()) {
    header("Location: login.php");
    exit;
}


$today = date('Y-m-d');
$defaultStart = date('Y-m-01'); 
$start = isset($_GET['start_date']) && preg_match('/^\d{4}-\d{2}-\d{2}$/', $_GET['start_date']) ? $_GET['start_date'] : $defaultStart;
$end = isset($_GET['end_date']) && preg_match('/^\d{4}-\d{2}-\d{2}$/', $_GET['end_date']) ? $_GET['end_date'] : $today;
if ($start > $end) {
    $tmp = $start;
    $start = $end;
    $end = $tmp;
}
$startEsc = $conn->real_escape_string($start);
$endEsc = $conn->real_escape_string($end);

$categoryData = array();
$catSql = "SELECT COALESCE(c.name, 'غير محدد') AS category_name, COUNT(*) AS cnt
           FROM products p
           LEFT JOIN categories c ON p.category_id = c.id
           GROUP BY COALESCE(c.name, 'غير محدد')
           ORDER BY cnt DESC";
$catRes = $conn->query($catSql);
if ($catRes) {
    while ($r = $catRes->fetch_assoc()) {
        $categoryData[$r['category_name']] = (int)$r['cnt'];
    }
    $catRes->free();
}

$rangeCounts = array(0, 0, 0, 0);
$avgPrice = 0.0;
$totalProducts = 0;
$priceSql = "SELECT
    SUM(price < 100) AS r0,
    SUM(price >= 100 AND price < 500) AS r1,
    SUM(price >= 500 AND price < 1000) AS r2,
    SUM(price >= 1000) AS r3,
    AVG(price) AS avg_price,
    COUNT(*) AS total_products
    FROM products";
$pr = $conn->query($priceSql);
if ($pr) {
    $p = $pr->fetch_assoc();
    $rangeCounts[0] = (int)val($p, 'r0', 0);
    $rangeCounts[1] = (int)val($p, 'r1', 0);
    $rangeCounts[2] = (int)val($p, 'r2', 0);
    $rangeCounts[3] = (int)val($p, 'r3', 0);
    $avgPrice = (float)val($p, 'avg_price', 0.0);
    $totalProducts = (int)val($p, 'total_products', 0);
    $pr->free();
}

$period = new DatePeriod(new DateTime($start), new DateInterval('P1D'), (new DateTime($end))->modify('+1 day'));
$dates = [];
foreach ($period as $dt) {
    $dates[] = $dt->format('Y-m-d');
}

if (empty($dates)) {
    $dates = [$start]; // fallback
}

$mapRange = array();
$stmtRange = $conn->prepare("SELECT DATE(order_date) AS d, IFNULL(SUM(total),0) AS s
      FROM orders
      WHERE status = 'completed' AND DATE(order_date) BETWEEN ? AND ?
      GROUP BY DATE(order_date)");

if ($stmtRange) {
    $stmtRange->bind_param('ss', $start, $end);
    $stmtRange->execute();
    $resRange = stmt_get_all($stmtRange);
    foreach ($resRange as $r) {
        $mapRange[$r['d']] = (float)$r['s'];
    }
    $stmtRange->close();
}
$rangeSales = array();
foreach ($dates as $d) {
    $rangeSales[] = isset($mapRange[$d]) ? $mapRange[$d] : 0.0;
}
$totalRangeSales = array_sum($rangeSales);

$topProducts = [];
$topSql = "SELECT p.id, p.name, SUM(oi.quantity) AS qty, SUM(oi.quantity * oi.price) AS revenue
           FROM order_items oi
           INNER JOIN orders o ON o.id = oi.order_id
           INNER JOIN products p ON p.id = oi.product_id
           WHERE o.status = 'completed' AND DATE(o.order_date) BETWEEN ? AND ?
           GROUP BY p.id
           ORDER BY qty DESC
           LIMIT 10";
$stmtTop = $conn->prepare($topSql);
if ($stmtTop) {
    $stmtTop->bind_param('ss', $start, $end);
    $stmtTop->execute();
    $topProducts = stmt_get_all($stmtTop);
    $stmtTop->close();
}

if (isset($_GET['export']) && in_array($_GET['export'], ['csv', 'pdf'])) {
    $format = $_GET['export'];
    $fnSafe = preg_replace('/[^a-z0-9_\\-]/i', '_', "analytics_{$start}_{$end}");

    if ($format === 'csv') {
        header('Content-Type: text/csv; charset=UTF-8');
        header('Content-Disposition: attachment; filename="' . $fnSafe . '.csv"');
        echo "\xEF\xBB\xBF"; 
        $out = fopen('php://output', 'w');
        fputcsv($out, ['Metric', 'Value']);
        fputcsv($out, ['Start Date', $start]);
        fputcsv($out, ['End Date', $end]);
        fputcsv($out, ['Total Sales (selected range)', number_format($totalRangeSales, 2)]);
        fputcsv($out, ['Total Products', $totalProducts]);
        fputcsv($out, []);
        fputcsv($out, ['Sales by Date']);
        fputcsv($out, ['Date', 'Sales']);
        foreach ($dates as $i => $d) {
            fputcsv($out, [$d, number_format($rangeSales[$i], 2)]);
        }
        fputcsv($out, []);
        fputcsv($out, ['Top Products (qty, revenue)']);
        fputcsv($out, ['ID', 'Name', 'Qty', 'Revenue']);
        foreach ($topProducts as $p) {
            fputcsv($out, [(int)$p['id'], $p['name'], (int)$p['qty'], number_format((float)$p['revenue'], 2)]);
        }
        fclose($out);
        exit;
    }

    if ($format === 'pdf') {
        $html = '<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><style>body{font-family:DejaVu Sans, \"Segoe UI\", Tahoma, Arial;direction:rtl}</style></head><body>';
        $html .= "<h2>تقرير تحليلات المتجر</h2>";
        $html .= "<div>الفترة: <strong>{$start} إلى {$end}</strong></div>";
        $html .= "<h3>الإجماليات</h3><ul>";
        $html .= "<li>إجمالي المبيعات: " . number_format($totalRangeSales, 2) . " ج.م</li>";
        $html .= "<li>إجمالي المنتجات: " . number_format($totalProducts) . "</li>";
        $html .= "</ul>";
        $html .= "<h3>المبيعات حسب التاريخ</h3><table border=1 cellpadding=6 cellspacing=0 style=border-collapse:collapse;width:100%><thead><tr><th>التاريخ</th><th>المبيعات</th></tr></thead><tbody>";
        foreach ($dates as $i => $d) {
            $html .= "<tr><td>{$d}</td><td>" . number_format($rangeSales[$i], 2) . " ج.م</td></tr>";
        }
        $html .= "</tbody></table>";
        $html .= "<h3>أعلى المنتجات</h3><table border=1 cellpadding=6 cellspacing=0 style=border-collapse:collapse;width:100%\"><thead><tr><th>ID</th><th>الاسم</th><th>الكمية</th><th>الإيراد</th></tr></thead><tbody>";
        foreach ($topProducts as $p) {
            $html .= "<tr><td>" . (int)$p['id'] . "</td><td>" . esc($p['name']) . "</td><td>" . (int)$p['qty'] . "</td><td>" . number_format((float)$p['revenue'], 2) . " ج.م</td></tr>";
        }
        $html .= "</tbody></table>";
        $html .= '</body></html>';

        if (class_exists('Dompdf\\Dompdf')) {
            try {
                $dompdf = new Dompdf\Dompdf();
                $dompdf->loadHtml($html);
                $dompdf->setPaper('A4', 'landscape');
                $dompdf->render();
                header('Content-Type: application/pdf');
                header('Content-Disposition: attachment; filename="' . $fnSafe . '.pdf"');
                echo $dompdf->output();
                exit;
            } catch (Exception $e) {
            }
        }

        header('Content-Type: text/html; charset=utf-8');
        header('Content-Disposition: attachment; filename="' . $fnSafe . '.html"');
        echo $html;
        exit;
    }
}
?>
