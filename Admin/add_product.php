<?php
declare(strict_types=1);

session_start();

require_once '../../Model/db.php';

if (!isset($_SESSION['admin'])) {
    header("Location: login.php");
    exit;
}

if (empty($_SESSION['csrf_token'])) {
    $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
}

$msg = "";
$msgClass = "alert-danger";
$newProduct = null;

$categories = [];
$res = $conn->query("SELECT id, name FROM categories ORDER BY name ASC");
if ($res) {
    while ($row = $res->fetch_assoc()) {
        $categories[$row['id']] = $row['name'];
    }
}


function create_image_from_path(string $sourcePath, string $mime): GdImage|false
{
    $img = match ($mime) {
        'image/jpeg', 'image/pjpeg' => @imagecreatefromjpeg($sourcePath),
        'image/png' => @imagecreatefrompng($sourcePath),
        'image/gif' => @imagecreatefromgif($sourcePath),
        'image/webp' => @imagecreatefromwebp($sourcePath),
        default => false,
    };

    if (!$img) {
        $data = @file_get_contents($sourcePath);
        if ($data !== false) {
            $img = @imagecreatefromstring($data);
        }
    }

    if ($img) {
        imagepalettetotruecolor($img);
        imagealphablending($img, true);
        imagesavealpha($img, true);
    }

    return $img;
}

function save_resized_jpeg(GdImage $srcImg, string $destPath, int $maxWidth, int $jpegQuality = 85): bool
{
    $w = imagesx($srcImg);
    $h = imagesy($srcImg);

    $new_w = ($w > $maxWidth) ? $maxWidth : $w;
    $new_h = (int) round(($new_w / $w) * $h);

    $dst = imagecreatetruecolor($new_w, $new_h);
    $white = imagecolorallocate($dst, 255, 255, 255);
    imagefill($dst, 0, 0, $white);

    imagecopyresampled($dst, $srcImg, 0, 0, 0, 0, $new_w, $new_h, $w, $h);

    $saved = imagejpeg($dst, $destPath, $jpegQuality);
    imagedestroy($dst);

    return $saved;
}

function save_resized_webp(GdImage $srcImg, string $destPath, int $maxWidth, int $webpQuality = 85): bool
{
    $w = imagesx($srcImg);
    $h = imagesy($srcImg);

    $new_w = ($w > $maxWidth) ? $maxWidth : $w;
    $new_h = (int) round(($new_w / $w) * $h);

    $dst = imagecreatetruecolor($new_w, $new_h);
    imagealphablending($dst, false);
    imagesavealpha($dst, true);

    imagecopyresampled($dst, $srcImg, 0, 0, 0, 0, $new_w, $new_h, $w, $h);

    $saved = imagewebp($dst, $destPath, $webpQuality);
    imagedestroy($dst);

    return $saved;
}

function save_square_thumbnail(GdImage $srcImg, string $destPath, int $size, int $jpegQuality = 85): bool
{
    $w = imagesx($srcImg);
    $h = imagesy($srcImg);

    $crop_size = min($w, $h);
    $x = (int) (($w - $crop_size) / 2);
    $y = (int) (($h - $crop_size) / 2);

    $dst = imagecreatetruecolor($size, $size);
    $white = imagecolorallocate($dst, 255, 255, 255);
    imagefill($dst, 0, 0, $white);

    imagecopyresampled($dst, $srcImg, 0, 0, $x, $y, $size, $size, $crop_size, $crop_size);

    $saved = imagejpeg($dst, $destPath, $jpegQuality);
    imagedestroy($dst);

    return $saved;
}


if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $isAjax = ($_POST['ajax'] ?? '0') === '1';

    if (!hash_equals($_SESSION['csrf_token'], $_POST['csrf_token'] ?? '')) {
        $msg = "فشل التحقق من الأمان. حاول إعادة تحميل الصفحة.";
        if ($isAjax) {
            header('Content-Type: application/json; charset=utf-8');
            http_response_code(403);
            echo json_encode(['status' => 'error', 'msg' => $msg]);
            exit;
        }
    }

    $name = trim($_POST['name'] ?? '');
    $price = (float) ($_POST['price'] ?? 0.0);
    $category_id = (int) ($_POST['category'] ?? 0);
    $stock = max(0, (int) ($_POST['stock'] ?? 0));
    $description = trim(strip_tags($_POST['description'] ?? ''));
    $description = preg_replace('/(http|https|ftp|ftps )\:\/\/[a-zA-Z0-9\-\.]+\.[a-zA-Z]{2,3}(\/\S*)?/', '', $description);
    
    $countdown_time = trim($_POST['countdown_time'] ?? '');
    $countdown_timestamp = !empty($countdown_time) ? strtotime($countdown_time) * 1000 : null;

    $max_desc_length = 500;
    if (mb_strlen($description, 'UTF-8') > $max_desc_length) {
        $description = mb_substr($description, 0, $max_desc_length, 'UTF-8') . '...';
    }

    if (empty($name) || $price <= 0 || !array_key_exists($category_id, $categories)) {
        $msg = "الرجاء إدخال اسم صحيح، سعر أكبر من صفر، واختيار فئة.";
    } elseif (empty($_FILES['image']) || $_FILES['image']['error'] !== UPLOAD_ERR_OK) {
        $msg = "الرجاء اختيار صورة المنتج الرئيسية.";
    }

    if ($msg === '') {
        $uploadDirServer = __DIR__ . '/assets/images/products/';
        if (!is_dir($uploadDirServer)) {
            mkdir($uploadDirServer, 0755, true);
        }

        $tmpPath = $_FILES['image']['tmp_name'];
        
        if ($_FILES['image']['size'] > 5 * 1024 * 1024) {
            $msg = "حجم الصورة كبير جدًا. الحد الأقصى 5MB.";
        } else {
            $finfo = finfo_open(FILEINFO_MIME_TYPE);
            $mime = finfo_file($finfo, $tmpPath);
            finfo_close($finfo);

            $allowed_mimes = ['image/jpeg', 'image/pjpeg', 'image/png', 'image/gif', 'image/webp'];
            $ext = strtolower(pathinfo($_FILES['image']['name'], PATHINFO_EXTENSION));

            if (!in_array($mime, $allowed_mimes) && !($mime === 'application/octet-stream' && in_array($ext, ['jpg', 'jpeg', 'png', 'gif', 'webp']))) {
                $msg = "صيغة الصورة غير مدعومة أو الملف تالف. (MIME: " . htmlspecialchars($mime) . "). تأكد من أن الملف بصيغة صالحة.";
            }
        }

        if ($msg === '') {
            $srcImg = create_image_from_path($tmpPath, $mime);

            if (!$srcImg) {
                $msg = "فشل معالجة الصورة. تأكد من أن الملف غير تالف وأن امتدادات GD مفعلة بشكل كامل على الخادم.";
            } else {
                $safe_filename = uniqid('p_', true);
                
                $mainImagePathServer = $uploadDirServer . $safe_filename . '.jpg';
                $webpPathServer = $uploadDirServer . $safe_filename . '.webp';
                $thumb300PathServer = $uploadDirServer . $safe_filename . '_300x300.jpg';
                $thumb800PathServer = $uploadDirServer . $safe_filename . '_800x800.jpg';

                $converted_jpg = save_resized_jpeg($srcImg, $mainImagePathServer, 1200, 90);
                
                $converted_webp = save_resized_webp($srcImg, $webpPathServer, 1200, 90);

                if (!$converted_jpg) {
                    $msg = "حدث خطأ أثناء تحويل الصورة إلى JPG.";
                } else {
                    save_square_thumbnail($srcImg, $thumb300PathServer, 300, 85);
                    save_square_thumbnail($srcImg, $thumb800PathServer, 800, 85);

                    imagedestroy($srcImg);

                    $publicImagePath = 'products/' . basename($mainImagePathServer);
                    $publicImageWebpPath = $converted_webp ? 'products/' . basename($webpPathServer) : '';
                    $publicImageThumb300Path = 'products/' . basename($thumb300PathServer);
                    $publicImageThumb800Path = 'products/' . basename($thumb800PathServer);

                    $stmt = $conn->prepare("INSERT INTO products (name, price, image, image_webp, image_thumb_300, image_thumb_800, category_id, stock, description, countdown) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");

                    if (!$stmt) {
                        error_log("DB prepare error: " . $conn->error);
                        $msg = "حدث خطأ في الخادم. يرجى المحاولة مرة أخرى.";
                    } else {
                        $stmt->bind_param("sdssssiiss", $name, $price, $publicImagePath, $publicImageWebpPath, $publicImageThumb300Path, $publicImageThumb800Path, $category_id, $stock, $description, $countdown_timestamp);

                        if ($stmt->execute()) {
                            $insertId = $stmt->insert_id;
                            $stmt->close();

                            if (isset($_FILES['additional_images']) && is_array($_FILES['additional_images']['tmp_name'])) {
                                $sort_order = 1;
                                $insertImageStmt = $conn->prepare("INSERT INTO product_images (product_id, image_path, sort_order) VALUES (?, ?, ?)");

                                foreach ($_FILES['additional_images']['tmp_name'] as $key => $tmp_name) {
                                    if ($_FILES['additional_images']['error'][$key] === UPLOAD_ERR_OK) {
                                        $file_name = $_FILES['additional_images']['name'][$key];
                                        $file_size = $_FILES['additional_images']['size'][$key];

                                        if ($file_size > 5 * 1024 * 1024) {
                                            error_log("Additional image too large: " . $file_name);
                                            continue;
                                        }

                                        $finfo = finfo_open(FILEINFO_MIME_TYPE);
                                        $mime = finfo_file($finfo, $tmp_name);
                                        finfo_close($finfo);

                                        if (!in_array($mime, $allowed_mimes)) {
                                            error_log("Additional image type not allowed: " . $file_name);
                                            continue;
                                        }

                                        $srcImgAdd = create_image_from_path($tmp_name, $mime);
                                        if ($srcImgAdd) {
                                            $safe_filename_add = uniqid('p_', true) . '_add_' . $sort_order;
                                            $mainImagePathServerAdd = $uploadDirServer . $safe_filename_add . '.jpg';

                                            // حفظ الصورة الإضافية كـ JPG
                                            if (save_resized_jpeg($srcImgAdd, $mainImagePathServerAdd, 1200, 90)) {
                                                $publicImagePathAdd = 'products/' . basename($mainImagePathServerAdd);
                                                
                                                // إدراج في جدول الصور الإضافية
                                                $insertImageStmt->bind_param("isi", $insertId, $publicImagePathAdd, $sort_order);
                                                $insertImageStmt->execute();
                                                $sort_order++;
                                            }
                                            imagedestroy($srcImgAdd);
                                        }
                                    }
                                }
                                if ($insertImageStmt) $insertImageStmt->close();
                            }

                            $gstmt = $conn->prepare("SELECT * FROM products WHERE id = ?");
                            $gstmt->bind_param("i", $insertId);
                            $gstmt->execute();
                            $result = $gstmt->get_result();
                            $newProduct = $result->fetch_assoc();
                            $gstmt->close();

                            if ($newProduct) {
                                $newProduct['name'] = htmlspecialchars($newProduct['name']);
                                $newProduct['price'] = number_format((float)$newProduct['price'], 2);
                                $newProduct['image_url'] = 'assets/images/' . ltrim($newProduct['image_thumb_300'], '/');
                                $newProduct['stock'] = (int)$newProduct['stock'];
                                $newProduct['description'] = htmlspecialchars($newProduct['description']);
                            }

                            $msg = "تم إضافة المنتج بنجاح.";
                            $msgClass = "alert-success";

                            if ($isAjax) {
                                header('Content-Type: application/json; charset=utf-8');
                                echo json_encode(['status' => 'success', 'msg' => $msg, 'product' => $newProduct]);
                                exit;
                            }
                        } else {
                            error_log("DB execute error: " . $stmt->error);
                            $msg = "خطأ في قاعدة البيانات أثناء حفظ المنتج.";
                            $stmt->close();
                        }
                    }
                }
                if ($msgClass === 'alert-danger') {
                    array_map('unlink', glob($uploadDirServer . $safe_filename . "*"));
                }
            }
        }
    }
    if ($isAjax && $msgClass === 'alert-danger') {
        header('Content-Type: application/json; charset=utf-8');
        http_response_code(422);
        echo json_encode(['status' => 'error', 'msg' => $msg]);
        exit;
    }
}
