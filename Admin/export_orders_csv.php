<?php
require __DIR__ . '/admin_init.php';
if (!is_admin()) {
    header('HTTP/1.1 403 Forbidden');
    exit;
}

$start = isset($_GET['start']) ? $_GET['start'] : null;
$end   = isset($_GET['end']) ? $_GET['end'] : null;

header('Content-Type: text/csv; charset=UTF-8');
$fn = 'orders_export_' . date('Ymd_His') . '.csv';
header('Content-Disposition: attachment; filename="' . $fn . '"');
echo "\xEF\xBB\xBF";

$out = fopen('php://output', 'w');
fputcsv($out, array('ID', 'اسم العميل', 'الهاتف', 'العنوان', 'الإجمالي', 'الحالة', 'تاريخ الطلب', 'عدد العناصر'));

$sql = "SELECT id, customer_name, phone, address, total, status, order_date FROM orders";
$params = array();
$types = '';
if ($start && $end) {
    $sql .= " WHERE DATE(order_date) BETWEEN ? AND ?";
    $params = array($start, $end);
    $types = 'ss';
} elseif ($start) {
    $sql .= " WHERE DATE(order_date) >= ?";
    $params = array($start);
    $types = 's';
} elseif ($end) {
    $sql .= " WHERE DATE(order_date) <= ?";
    $params = array($end);
    $types = 's';
}
$sql .= " ORDER BY id DESC";

$stmt = $conn->prepare($sql);
if ($stmt === false) {
    error_log("export_orders_csv prepare error: " . $conn->error);
    fclose($out);
    exit;
}
if (!empty($params)) {
    $bind_names = array();
    $bind_names[] = $types;
    for ($i = 0; $i < count($params); $i++) $bind_names[] = &$params[$i];
    call_user_func_array(array($stmt, 'bind_param'), $bind_names);
}
$stmt->execute();

if (method_exists($stmt, 'get_result')) {
    $res = $stmt->get_result();
    while ($row = $res->fetch_assoc()) {
        $rit = $conn->prepare("SELECT SUM(quantity) AS cnt FROM order_items WHERE order_id=?");
        $oid = (int)$row['id'];
        $rit->bind_param('i', $oid);
        $rit->execute();
        $ritRes = $rit->get_result();
        $cnt = $ritRes ? (int)$ritRes->fetch_assoc()['cnt'] : 0;
        $rit->close();

        fputcsv($out, array($row['id'], $row['customer_name'], $row['phone'], $row['address'], number_format((float)$row['total'], 2), $row['status'], $row['order_date'], $cnt));
    }
} else {
    $meta = $stmt->result_metadata();
    $fields = array();
    $row = array();
    $bindNames = array();
    while ($f = $meta->fetch_field()) {
        $fields[] = $f->name;
        $bindNames[] = &$row[$f->name];
    }
    call_user_func_array(array($stmt, 'bind_result'), $bindNames);
    while ($stmt->fetch()) {
        $row_copy = array();
        foreach ($row as $k => $v) $row_copy[$k] = $v;
        $oid = (int)$row_copy['id'];
        $rit = $conn->prepare("SELECT SUM(quantity) AS cnt FROM order_items WHERE order_id=?");
        $rit->bind_param('i', $oid);
        $rit->execute();
        $rres = $rit->get_result();
        $cnt = $rres ? (int)$rres->fetch_assoc()['cnt'] : 0;
        $rit->close();

        fputcsv($out, array($row_copy['id'], $row_copy['customer_name'], $row_copy['phone'], $row_copy['address'], number_format((float)$row_copy['total'], 2), $row_copy['status'], $row_copy['order_date'], $cnt));
    }
}
fclose($out);
exit;
