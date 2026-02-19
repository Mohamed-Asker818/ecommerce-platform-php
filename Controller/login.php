<?php
session_start();
require_once '../Vendor/autoload.php';
require_once '../Smarty/libs/Smarty.class.php'; 
require_once '../Model/db.php'; 

if (isset($_SESSION['user_id'])) {
    $redirect = isset($_GET['redirect']) ? $_GET['redirect'] : 'Home.php';
    header('Location: ' . $redirect);
    exit;
}

if (!isset($_SESSION['user_id']) && isset($_COOKIE['remember_token'])) {
    $token = $_COOKIE['remember_token'];
    
    $query = "SELECT u.id, u.name, u.email, u.avatar 
              FROM users u
              JOIN remember_tokens rt ON u.id = rt.user_id
              WHERE rt.token = ? AND rt.expires_at > NOW() 
              LIMIT 1";
    
    $stmt = $conn->prepare($query);
    $stmt->bind_param('s', $token);
    $stmt->execute();
    $result = $stmt->get_result();
    
    if ($row = $result->fetch_assoc()) {
        session_regenerate_id(true);
        $_SESSION['user_id'] = $row['id'];
        $_SESSION['user_name'] = $row['name'];
        $_SESSION['user_email'] = $row['email'];
        $_SESSION['user_avatar'] = $row['avatar'] ?: 'default_avatar.png';
        
        $updateQuery = "UPDATE users SET last_login = NOW() WHERE id = ?";
        $updateStmt = $conn->prepare($updateQuery);
        $updateStmt->bind_param('i', $row['id']);
        $updateStmt->execute();
        
        $redirect = isset($_GET['redirect']) ? $_GET['redirect'] : 'Home.php';
        header('Location: ' . $redirect);
        exit;
    } else {
        setcookie('remember_token', '', time() - 3600, '/', '', true, true);
    }
}

$smarty = new Smarty();
$smarty->setTemplateDir('../Views/');
$smarty->setCompileDir('../Templates_c/');
$smarty->setCacheDir('../Cache/');

$smarty->display('login.html');
?>
