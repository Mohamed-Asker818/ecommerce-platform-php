<?php
session_start();
include 'db.php';
$cfg = include __DIR__ . '/config.php';
require_once __DIR__ . '/vendor/autoload.php';
\Stripe\Stripe::setApiKey($cfg->STRIPE_SECRET);

$order_id = isset($_GET['order_id']) ? intval($_GET['order_id']) : 0;
$session_id = isset($_GET['session_id']) ? trim($_GET['session_id']) : '';

if ($order_id && $session_id) {
  try {
    $session = \Stripe\Checkout\Session::retrieve($session_id);
    if ($session && ($session->payment_status === 'paid' || $session->status === 'complete')) {
      $conn->begin_transaction();
      try {
          $stmt = $conn->prepare("SELECT payment_status, user_id FROM orders WHERE id = ? FOR UPDATE");
          $stmt->bind_param("i", $order_id);
          $stmt->execute();
          $stmt->bind_result($current_payment_status, $user_id);
          $stmt->fetch();
          $stmt->close();

          if ($current_payment_status === 'paid') {
              $conn->commit();
              header("Location: order_success.php?id=" . urlencode($order_id));
              exit;
          }

          $upd = $conn->prepare("UPDATE orders SET payment_status = 'paid', status = 'processing' WHERE id = ? AND payment_status != 'paid'");
          $upd->bind_param("i", $order_id);
          $upd->execute();
          $upd->close();

          $si = $conn->prepare("SELECT product_id, quantity FROM order_items WHERE order_id = ?");
          $si->bind_param("i", $order_id);
          $si->execute();
          $res = $si->get_result();

          $updP = $conn->prepare("UPDATE products SET stock = stock - ? WHERE id = ?");
          while ($r = $res->fetch_assoc()) {
              $pid = (int)$r['product_id'];
              $qty = (int)$r['quantity'];
              if ($pid > 0 && $qty > 0) {
                  $updP->bind_param("ii", $qty, $pid);
                  $updP->execute();
              }
          }
          $updP->close();
          $si->close();

          if (!empty($user_id)) {
              $del = $conn->prepare("DELETE FROM user_cart WHERE user_id = ?");
              $del->bind_param("i", $user_id);
              $del->execute();
              $del->close();
              if (isset($_SESSION['user_id']) && intval($_SESSION['user_id']) === intval($user_id)) {
                  unset($_SESSION['cart']);
              }
          }

          $conn->commit();
          header("Location: order_success.php?id=" . urlencode($order_id));
          exit;
      } catch (Exception $dbEx) {
          $conn->rollback();
          throw $dbEx;
      }
    } else {
      echo "<h2>لم يتم تأكيد الدفع بعد. انتظر لحظة أو راجع Webhook.</h2>";
    }
  } catch (Exception $e) {
    echo "خطأ في التحقق من جلسة الدفع: " . htmlspecialchars($e->getMessage());
  }
} else {
  die("معلومات غير كافية.");
}
