<?php
session_start();
require_once '../Model/db.php';

if (isset($_COOKIE['remember_token'])) {
    $token = $_COOKIE['remember_token'];
    
    $deleteTokenQuery = "DELETE FROM remember_tokens WHERE token = ?";
    $deleteStmt = $conn->prepare($deleteTokenQuery);
    $deleteStmt->bind_param('s', $token);
    $deleteStmt->execute();
    
    setcookie('remember_token', '', time() - 3600, '/', '', true, true);
    unset($_COOKIE['remember_token']);
}

if (isset($_SESSION['user_id'])) {
    $userId = $_SESSION['user_id'];
    
    $deleteAllTokensQuery = "DELETE FROM remember_tokens WHERE user_id = ?";
    $deleteAllStmt = $conn->prepare($deleteAllTokensQuery);
    $deleteAllStmt->bind_param('i', $userId);
    $deleteAllStmt->execute();
}

unset($_SESSION["user_id"]);
unset($_SESSION["user_name"]);
unset($_SESSION["user_email"]);
unset($_SESSION["user_avatar"]);
unset($_SESSION["cart"]);
unset($_SESSION["wishlist"]);
unset($_SESSION["compare"]);

$_SESSION = array();
if (ini_get("session.use_cookies")) {
    $params = session_get_cookie_params();
    setcookie(
        session_name(),
        '',
        time() - 42000,
        $params["path"],
        $params["domain"],
        $params["secure"],
        $params["httponly"]
    );
}
session_destroy();

header("Location: Home.php");
exit;
?>
