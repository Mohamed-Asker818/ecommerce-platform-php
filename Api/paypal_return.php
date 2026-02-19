<?php
session_start();
include __DIR__ . '/db.php';
$cfg = include __DIR__ . '/config.php';

if (!file_exists(__DIR__ . '/vendor/autoload.php')) {
    error_log("Missing composer autoload at vendor/autoload.php");
    die("خطاء داخلي: مكتبات PayPal غير مثبتة.");
}
require_once __DIR__ . '/vendor/autoload.php';

use PayPalCheckoutSdk\Core\PayPalHttpClient;
use PayPalCheckoutSdk\Core\SandboxEnvironment;
use PayPalCheckoutSdk\Core\ProductionEnvironment;
use PayPalCheckoutSdk\Orders\OrdersCaptureRequest;

$PAYPAL_CLIENT_ID = $cfg->PAYPAL_CLIENT_ID ?? '';
$PAYPAL_SECRET = $cfg->PAYPAL_SECRET ?? '';
$SITE_URL = rtrim($cfg->SITE_URL ?? '', '/');

$isSandbox = ($cfg->PAYPAL_ENV ?? 'sandbox') === 'sandbox';
$environment = $isSandbox
    ? new SandboxEnvironment($PAYPAL_CLIENT_ID, $PAYPAL_SECRET)
    : new ProductionEnvironment($PAYPAL_CLIENT_ID, $PAYPAL_SECRET);
$client = new PayPalHttpClient($environment);

$order_id = isset($_GET['order_id']) ? intval($_GET['order_id']) : 0;
$token = isset($_GET['token']) ? $_GET['token'] : ''; 
$expected_currency = isset($_GET['currency']) ? strtoupper($_GET['currency']) : null;
$expected_amount = isset($_GET['amount']) ? (float)$_GET['amount'] : null;

$log = function($msg){
    $path = __DIR__ . '/logs';
    if (!is_dir($path)) @mkdir($path, 0755, true);
    @file_put_contents($path . '/paypal_return.log', "[".date('Y-m-d H:i:s')."] " . $msg . PHP_EOL, FILE_APPEND);
};

if (!$order_id || !$token) {
    $log("Invalid return parameters. order_id={$order_id} token=" . ($token ? 'yes' : 'no'));
    die("Invalid return parameters.");
}

$stmt = $conn->prepare("SELECT id, total, currency, payment_status, user_id FROM orders WHERE id = ?");
if (!$stmt) {
    $log("DB prepare failed: " . $conn->error);
    die("خطأ داخلي في قاعدة البيانات.");
}
$stmt->bind_param("i", $order_id);
$stmt->execute();
$res = $stmt->get_result();
$orderRow = $res->fetch_assoc();
$stmt->close();

if (!$orderRow) {
    $log("Order not found: id={$order_id}");
    die("الطلب غير موجود.");
}

$ref_amount = $expected_amount !== null ? (float)$expected_amount : (float)$orderRow['total'];
$ref_currency = $expected_currency !== null ? strtoupper($expected_currency) : strtoupper($orderRow['currency']);

try {
    $request = new OrdersCaptureRequest($token);
    $request->prefer('return=representation');
    $response = $client->execute($request);

    $rawResponse = json_encode($response, JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES);
    $log("Capture response for order {$order_id}: " . substr($rawResponse, 0, 2000));

    $status = $response->result->status ?? null;
    $captureId = null;
    $capturedAmount = null;
    $capturedCurrency = null;

    if (!empty($response->result->purchase_units) && is_array($response->result->purchase_units)) {
        foreach ($response->result->purchase_units as $pu) {
            if (!empty($pu->payments->captures) && is_array($pu->payments->captures)) {
                foreach ($pu->payments->captures as $cap) {
                    $captureId = $cap->id ?? $captureId;
                    if (!empty($cap->amount)) {
                        $capturedAmount = $cap->amount->value ?? $capturedAmount;
                        $capturedCurrency = strtoupper($cap->amount->currency_code ?? $capturedCurrency);
                    }
                    break 2;
                }
            }
        }
    }

    if ($capturedAmount === null && !empty($response->result->purchase_units[0]->amount)) {
        $capturedAmount = $response->result->purchase_units[0]->amount->value ?? $capturedAmount;
        $capturedCurrency = strtoupper($response->result->purchase_units[0]->amount->currency_code ?? $capturedCurrency);
    }

    $capturedAmount = $capturedAmount !== null ? (float)$capturedAmount : null;

    if (strtoupper($status) === 'COMPLETED' || strtoupper($status) === 'APPROVED') {
        $conn->begin_transaction();
        try {
            $lockStmt = $conn->prepare("SELECT payment_status, user_id FROM orders WHERE id = ? FOR UPDATE");
            $lockStmt->bind_param("i", $order_id);
            $lockStmt->execute();
            $lockStmt->bind_result($current_payment_status, $user_id_locked);
            $lockStmt->fetch();
            $lockStmt->close();

            if ($current_payment_status === 'paid') {
                $conn->commit();
                header("Location: order_success.php?id=" . urlencode($order_id));
                exit;
            }

            $ok_amount = true;
            if ($capturedAmount !== null) {
                $diff = abs($capturedAmount - (float)$ref_amount);
                if ($diff > 0.50) { 
                    $ok_amount = false;
                }
            }
            if ($capturedCurrency !== null && strtoupper($capturedCurrency) !== strtoupper($ref_currency)) {
                $log("Currency mismatch for order {$order_id}. expected={$ref_currency} got={$capturedCurrency}");
            }

            $upd = $conn->prepare("UPDATE orders SET payment_status = 'paid', status = 'processing', provider_txn_id = ?, payment_provider_response = ? WHERE id = ? AND payment_status != 'paid'");
            if ($upd) {
                $upd->bind_param("ssi", $captureIdParam, $rawRespParam, $order_id);
                $captureIdParam = $captureId ?? '';
                $rawRespParam = $rawResponse;
                $upd->execute();
                $upd->close();
            } else {
                $log("Prepare failed updating order: " . $conn->error);
                $conn->query("UPDATE orders SET payment_status = 'paid', status = 'processing' WHERE id = " . intval($order_id));
            }

            $si = $conn->prepare("SELECT product_id, quantity FROM order_items WHERE order_id = ?");
            $si->bind_param("i", $order_id);
            $si->execute();
            $resItems = $si->get_result();

            $updP = $conn->prepare("UPDATE products SET stock = GREATEST(0, stock - ?) WHERE id = ?");
            while ($r = $resItems->fetch_assoc()) {
                $pid = (int)$r['product_id'];
                $qty = (int)$r['quantity'];
                if ($pid > 0 && $qty > 0) {
                    $updP->bind_param("ii", $qty, $pid);
                    $updP->execute();
                }
            }
            $updP->close();
            $si->close();

            if (!empty($user_id_locked)) {
                $del = $conn->prepare("DELETE FROM user_cart WHERE user_id = ?");
                $del->bind_param("i", $user_id_locked);
                $del->execute();
                $del->close();

                if (isset($_SESSION['user_id']) && intval($_SESSION['user_id']) === intval($user_id_locked)) {
                    unset($_SESSION['cart']);
                }
            }

            $conn->commit();
            header("Location: order_success.php?id=" . urlencode($order_id));
            exit;

        } catch (Exception $dbEx) {
            $conn->rollback();
            $log("DB exception while processing order {$order_id}: " . $dbEx->getMessage());
            echo "حدث خطأ أثناء معالجة الطلب. تم تسجيل الخطأ لدى النظام.";
            exit;
        }
    } else {
        $log("PayPal capture status not completed for order {$order_id}. status=" . ($status ?? 'null'));
        echo "لم تكتمل عملية الدفع عبر PayPal. الحالة: " . htmlspecialchars($status ?? 'unknown');
    }

} catch (Exception $e) {
    $log("Exception capturing order {$order_id}: " . $e->getMessage());
    echo "خطأ أثناء التقاط طلب PayPal: " . htmlspecialchars($e->getMessage());
}
