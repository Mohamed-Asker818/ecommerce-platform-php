<?php
session_start();
error_reporting(E_ALL);
ini_set('display_errors', 0);
ini_set('log_errors', 1);
$error_message = '';
$success_message = '';

if (empty($_SESSION['csrf_token'])) {
    $_SESSION['csrf_token'] = bin2hex(openssl_random_pseudo_bytes(32));
}
$csrf_token = $_SESSION['csrf_token'];

$login_attempts = isset($_SESSION['login_attempts']) ? (int)$_SESSION['login_attempts'] : 0;
$last_attempt_time = isset($_SESSION['last_attempt_time']) ? (int)$_SESSION['last_attempt_time'] : 0;
$max_attempts = 5;
$lockout_time = 300; 


if (isset($_SESSION['admin'])) {
    header("Location: dashboard.php");
    exit;
}

if ($login_attempts >= $max_attempts) {
    $time_remaining = $lockout_time - (time() - $last_attempt_time);
    if ($time_remaining > 0) {
        $minutes = ceil($time_remaining / 60);
        $error_message = "❌ تم قفل الحساب مؤقتاً. حاول مرة أخرى بعد " . $minutes . " دقيقة.";
    } else {
        $_SESSION['login_attempts'] = 0;
        $_SESSION['last_attempt_time'] = 0;
        $login_attempts = 0; 
    }
}

if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['login']) && empty($error_message)) {

    if (!isset($_POST['csrf_token']) || $_POST['csrf_token'] !== $csrf_token) {
        $error_message = "❌ خطأ أمني: محاولة تزوير طلب عبر المواقع (CSRF).";
    } else {
        $email = isset($_POST['email']) ? trim($_POST['email']) : '';
        $password = isset($_POST['password']) ? $_POST['password'] : '';

        $validation_errors = array();

        if (empty($email)) {
            $validation_errors[] = "البريد الإلكتروني مطلوب.";
        } elseif (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            $validation_errors[] = "صيغة البريد الإلكتروني غير صحيحة.";
        }

        if (empty($password)) {
            $validation_errors[] = "كلمة المرور مطلوبة.";
        }

        if (!empty($validation_errors)) {
            $error_message = "❌ " . implode(" | ", $validation_errors);
        } else {
            if ($email === $admin_email && $password === $admin_password) {

                $_SESSION['admin'] = 'Administrator';
                $_SESSION['admin_email'] = $email;
                $_SESSION['login_time'] = time();
                $_SESSION['login_attempts'] = 0;
                $_SESSION['last_attempt_time'] = 0;

                session_regenerate_id(true);

                header("Location: dashboard.php");
                exit;
            } else {
                $_SESSION['login_attempts'] = $login_attempts + 1;
                $_SESSION['last_attempt_time'] = time();
                $error_message = "❌ بيانات الدخول غير صحيحة.";

                $_SESSION['csrf_token'] = bin2hex(openssl_random_pseudo_bytes(32));
                $csrf_token = $_SESSION['csrf_token'];
            }
        }
    }
}
?>
