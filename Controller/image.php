<?php
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

$tryPaths = [
    __DIR__ . '/../Assets/images',        
    __DIR__ . '/../../Assets/images',     
    __DIR__ . '/../assets/images',       
    __DIR__ . '/../../public/assets/images', 
];

$baseDir = false;
foreach ($tryPaths as $p) {
    $real = realpath($p);
    if ($real && is_dir($real)) { $baseDir = rtrim($real, DIRECTORY_SEPARATOR); break; }
}

if (!$baseDir) {
    http_response_code(500);
    exit('Server error: Base images directory not found. (check path)');
}

$src = isset($_GET['src']) ? trim($_GET['src']) : '';
$src = urldecode($src);
$src = str_replace("\0", '', $src);
$src = str_replace(['../', '..\\'], '', $src);
$src = ltrim($src, '/\\');
$src = str_replace('\\', '/', $src);
$src = preg_replace('#^Assets/images/#i', '', $src);

$allowed_subdirs = ['products','categories'];
$parts = explode('/', $src);
if (count($parts) > 1) {
    if (!in_array($parts[0], $allowed_subdirs)) {
        $src = basename($src);
    } else {
        $src = $parts[0] . '/' . basename(end($parts));
    }
} else {
    $src = basename($src);
}

$srcFull = realpath($baseDir . DIRECTORY_SEPARATOR . $src);
if (!$srcFull || !is_file($srcFull)) {
    $alt = realpath(__DIR__ . '/' . $src);
    if ($alt && is_file($alt)) {
        $srcFull = $alt;
    } else {
        $fallback = $baseDir . DIRECTORY_SEPARATOR . 'default-product.png';
        if (is_file($fallback)) {
            header('Content-Type: image/png');
            header('Cache-Control: public, max-age=2592000');
            readfile($fallback);
            exit;
        }
        http_response_code(404);
        exit('Image not found.');
    }
}

if (strpos($srcFull, $baseDir) !== 0) {
    http_response_code(403);
    exit('Forbidden');
}

$w = isset($_GET['w']) ? (int)$_GET['w'] : 0;
$h = isset($_GET['h']) ? (int)$_GET['h'] : 0;
$q = isset($_GET['q']) ? (int)$_GET['q'] : 90;
$q = max(10, min(100, $q));
$fmt = isset($_GET['fmt']) ? strtolower($_GET['fmt']) : 'auto';

$ext = strtolower(pathinfo($srcFull, PATHINFO_EXTENSION));
$canWebP = (imagetypes() & IMG_WEBP) && function_exists('imagewebp');
$outputFormat = 'jpeg';
if ($fmt === 'webp' && $canWebP) $outputFormat = 'webp';
elseif ($fmt === 'png') $outputFormat = 'png';
elseif ($fmt === 'jpeg') $outputFormat = 'jpeg';
else {
    $accept = $_SERVER['HTTP_ACCEPT'] ?? '';
    $outputFormat = ($canWebP && strpos($accept, 'image/webp') !== false) ? 'webp' : ($ext === 'png' ? 'png' : 'jpeg');
}

if ($w <= 0 && $h <= 0) {
    $mime = mime_content_type($srcFull) ?: 'application/octet-stream';
    header('Content-Type: ' . $mime);
    header('Cache-Control: public, max-age=2592000');
    readfile($srcFull);
    exit;
}

$cacheDir = dirname($baseDir) . DIRECTORY_SEPARATOR . 'Cache';
if (!is_dir($cacheDir)) {
    @mkdir($cacheDir, 0755, true);
}
if (!is_writable($cacheDir)) {
}

$srcRel = ltrim(str_replace($baseDir, '', $srcFull), '/\\');
$hash = md5($srcRel . '|' . filemtime($srcFull) . "|w={$w}|h={$h}|q={$q}|fmt={$outputFormat}");
$extOut = ($outputFormat === 'webp') ? 'webp' : (($outputFormat === 'png') ? 'png' : 'jpg');
$cacheFile = $cacheDir . DIRECTORY_SEPARATOR . $hash . '.' . $extOut;

if (is_file($cacheFile)) {
    $mime = ($outputFormat === 'webp') ? 'image/webp' : (($outputFormat === 'png') ? 'image/png' : 'image/jpeg');
    header('Content-Type: ' . $mime);
    header('Cache-Control: public, max-age=2592000, immutable');
    readfile($cacheFile);
    exit;
}

switch ($ext) {
    case 'jpg': case 'jpeg': $srcImg = @imagecreatefromjpeg($srcFull); break;
    case 'png': $srcImg = @imagecreatefrompng($srcFull); break;
    case 'webp': $srcImg = @imagecreatefromwebp($srcFull); break;
    default: $srcImg = @imagecreatefromstring(@file_get_contents($srcFull)); break;
}

if (!$srcImg) {
    $mime = mime_content_type($srcFull) ?: 'application/octet-stream';
    header('Content-Type: ' . $mime);
    readfile($srcFull);
    exit;
}

$src_w = imagesx($srcImg);
$src_h = imagesy($srcImg);

if (!imageistruecolor($srcImg)) {
    $tmpTrue = imagecreatetruecolor($src_w, $src_h);
    imagealphablending($tmpTrue, false);
    imagesavealpha($tmpTrue, true);
    imagecopy($tmpTrue, $srcImg, 0, 0, 0, 0, $src_w, $src_h);
    imagedestroy($srcImg);
    $srcImg = $tmpTrue;
}

if ($w > 0 && $h > 0) {
    $ratio = min($w / $src_w, $h / $src_h);
    $t_w = max(1, (int)round($src_w * $ratio));
    $t_h = max(1, (int)round($src_h * $ratio));
} elseif ($w > 0) {
    $ratio = $w / $src_w;
    $t_w = $w;
    $t_h = max(1, (int)round($src_h * $ratio));
} else {
    $ratio = $h / $src_h;
    $t_h = $h;
    $t_w = max(1, (int)round($src_w * $ratio));
}

$dest_box_w = ($w > 0) ? $w : $t_w;
$dest_box_h = ($h > 0) ? $h : $t_h;
$dst = imagecreatetruecolor($dest_box_w, $dest_box_h);

if ($outputFormat === 'png' || $outputFormat === 'webp') {
    imagealphablending($dst, false);
    imagesavealpha($dst, true);
    $transparent = imagecolorallocatealpha($dst, 0, 0, 0, 127);
    imagefilledrectangle($dst, 0, 0, $dest_box_w, $dest_box_h, $transparent);
} else {
    imagefill($dst, 0, 0, imagecolorallocate($dst, 255, 255, 255));
}

$dst_x = (int)(($dest_box_w - $t_w) / 2);
$dst_y = (int)(($dest_box_h - $t_h) / 2);

imagecopyresampled($dst, $srcImg, $dst_x, $dst_y, 0, 0, $t_w, $t_h, $src_w, $src_h);

@imageconvolution($dst, [
    [-1, -1, -1],
    [-1, 16, -1],
    [-1, -1, -1]
], 8, 0);

$saveOk = false;
switch ($outputFormat) {
    case 'webp':
        if (function_exists('imagewebp')) $saveOk = @imagewebp($dst, $cacheFile, $q);
        break;
    case 'png':
        $pngLevel = max(0, min(9, (int)round((100 - $q) / 10)));
        $saveOk = @imagepng($dst, $cacheFile, $pngLevel);
        break;
    default:
        $saveOk = @imagejpeg($dst, $cacheFile, $q);
        break;
}

imagedestroy($srcImg);
imagedestroy($dst);

if ($saveOk && is_file($cacheFile)) {
    $mimeOut = ($outputFormat === 'webp') ? 'image/webp' : (($outputFormat === 'png') ? 'image/png' : 'image/jpeg');
    header('Content-Type: ' . $mimeOut);
    header('Cache-Control: public, max-age=2592000, immutable');
    readfile($cacheFile);
    exit;
} else {
    $mime = mime_content_type($srcFull) ?: 'application/octet-stream';
    header('Content-Type: ' . $mime);
    readfile($srcFull);
    exit;
}
