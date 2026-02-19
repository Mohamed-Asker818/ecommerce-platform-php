<?php

function is_mobile_user() {
    $user_agent = isset($_SERVER['HTTP_USER_AGENT']) ? $_SERVER['HTTP_USER_AGENT'] : '';
    
    $mobile_pattern = '/Mobile|Android|iPhone|iPad|iPod|Opera Mini|IEMobile|Windows Phone|BlackBerry|Kindle|Silk|webOS|Tablet/i';
    
    return preg_match($mobile_pattern, $user_agent) ? true : false;
}


function is_bot() {
    $user_agent = isset($_SERVER['HTTP_USER_AGENT']) ? $_SERVER['HTTP_USER_AGENT'] : '';
    
    $bot_pattern = '/Googlebot|Bingbot|Slurp|DuckDuckBot|Baiduspider|YandexBot|Crawler|Spider|Robot|Scraper/i';
    
    return preg_match($bot_pattern, $user_agent) ? true : false;
}

function should_show_mobile_ui() {
    if (is_bot()) {
        return false;
    }
    
    if (!is_mobile_user()) {
        return false;
    }
    
    if (isset($_COOKIE['preferred_view']) && $_COOKIE['preferred_view'] === 'desktop') {
        return false;
    }
    
    if (isset($_SESSION['preferred_view']) && $_SESSION['preferred_view'] === 'desktop') {
        return false;
    }
    
    if (isset($_COOKIE['hide_mobile_splash']) && $_COOKIE['hide_mobile_splash'] === '1') {
        return false;
    }
    
    return true;
}


function set_view_preference($preference = 'mobile') {
    setcookie('preferred_view', $preference, time() + (365 * 24 * 60 * 60), '/');
    
    $_SESSION['preferred_view'] = $preference;
}


function dismiss_mobile_splash() {
    setcookie('hide_mobile_splash', '1', time() + (30 * 24 * 60 * 60), '/');
}
?>
