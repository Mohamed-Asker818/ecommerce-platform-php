<?php
require __DIR__ . '/admin_init.php';
if (!is_admin()) {
    header('Location: login.php');
    exit;
}
include(__DIR__ . '/../Model/db.php');
ini_set('display_errors', 0);
ini_set('display_startup_errors', 0);
error_reporting(E_ALL);

function safe($v)
{
    return htmlspecialchars($v, ENT_QUOTES, 'UTF-8');
}

function generate_csrf_token()
{
    if (!isset($_SESSION)) session_start();
    if (!isset($_SESSION['csrf_token'])) {
        if (function_exists('openssl_random_pseudo_bytes')) {
            $_SESSION['csrf_token'] = bin2hex(openssl_random_pseudo_bytes(32));
        } else {
            $_SESSION['csrf_token'] = bin2hex(md5(uniqid(mt_rand(), true)));
        }
    }
    return $_SESSION['csrf_token'];
}

function rotate_csrf_token()
{
    if (function_exists('openssl_random_pseudo_bytes')) {
        $_SESSION['csrf_token'] = bin2hex(openssl_random_pseudo_bytes(32));
    } else {
        $_SESSION['csrf_token'] = bin2hex(md5(uniqid(mt_rand(), true)));
    }
    return $_SESSION['csrf_token'];
}

function safe_unlink($publicPath)
{
    if (!$publicPath) return;
    $publicPath = ltrim($publicPath, '/');
    $full = __DIR__ . '/assets/images/' . $publicPath;
    if (is_file($full)) {
        @unlink($full);
    }
    $alt = __DIR__ . '/assets/images/products/' . basename($publicPath);
    if (is_file($alt)) {
        @unlink($alt);
    }
}

function create_square_thumbnail($sourceFile, $destFile, $size = 300, $quality = 85)
{
    if (!is_file($sourceFile)) return false;
    $info = @getimagesize($sourceFile);
    if ($info === false) return false;
    $mime = isset($info['mime']) ? $info['mime'] : '';
    
    switch ($mime) {
        case 'image/jpeg':
        case 'image/pjpeg':
            $src = @imagecreatefromjpeg($sourceFile);
            break;
        case 'image/png':
            $src = @imagecreatefrompng($sourceFile);
            break;
        case 'image/gif':
            $src = @imagecreatefromgif($sourceFile);
            break;
        case 'image/webp':
            if (function_exists('imagecreatefromwebp')) {
                $src = @imagecreatefromwebp($sourceFile);
            } else {
                $src = false;
            }
            break;
        default:
            $src = false;
    }
    
    if (!$src) {
        $data = @file_get_contents($sourceFile);
        if ($data !== false) $src = @imagecreatefromstring($data);
        if (!$src) return false;
    }
    
    $w = imagesx($src);
    $h = imagesy($src);
    $crop = min($w, $h);
    $x = floor(($w - $crop) / 2);
    $y = floor(($h - $crop) / 2);
    $dst = imagecreatetruecolor($size, $size);
    $white = imagecolorallocate($dst, 255, 255, 255);
    imagefill($dst, 0, 0, $white);
    imagecopyresampled($dst, $src, 0, 0, $x, $y, $size, $size, $crop, $crop);
    $saved = imagejpeg($dst, $destFile, $quality);
    imagedestroy($src);
    imagedestroy($dst);
    return $saved;
}

$product_id = isset($_GET['id']) ? (int)$_GET['id'] : 0;
if ($product_id <= 0) {
    echo "<script>alert('❌ معرّف المنتج غير صالح'); window.location='dashboard.php';</script>";
    exit;
}

$categories = array();
$catRes = $conn->query("SELECT id, name FROM categories ORDER BY name ASC");
if ($catRes) {
    while ($cr = $catRes->fetch_assoc()) {
        $categories[$cr['id']] = htmlspecialchars($cr['name']);
    }
    $catRes->free();
}

$stmt = $conn->prepare("SELECT id, name, price, image, category_id, stock, description, countdown FROM products WHERE id = ? LIMIT 1");
if (!$stmt) {
    error_log("DB prepare error (select product) in edit_product.php: " . $conn->error);
    echo "<script>alert('خطأ في السيرفر.'); window.location='dashboard.php';</script>";
    exit;
}
$stmt->bind_param("i", $product_id);
$stmt->execute();
$result = $stmt->get_result();
$product = $result->fetch_assoc();
$stmt->close();

if (!$product) {
    echo "<script>alert('❌ المنتج غير موجود'); window.location='dashboard.php';</script>";
    exit;
}

$additional_images = [];
$imgStmt = $conn->prepare("SELECT id, image_path FROM product_images WHERE product_id = ? ORDER BY sort_order ASC");
if ($imgStmt) {
    $imgStmt->bind_param("i", $product_id);
    $imgStmt->execute();
    $imgRes = $imgStmt->get_result();
    while ($row = $imgRes->fetch_assoc()) {
        $additional_images[] = $row;
    }
    $imgStmt->close();
}

$product['name'] = isset($product['name']) ? $product['name'] : '';
$product['price'] = isset($product['price']) ? $product['price'] : 0;
$product['image'] = isset($product['image']) ? $product['image'] : '';
$product['category_id'] = isset($product['category_id']) ? (int)$product['category_id'] : 0;
$product['stock'] = isset($product['stock']) ? (int)$product['stock'] : 0;
$product['description'] = isset($product['description']) ? $product['description'] : '';
$product['countdown'] = isset($product['countdown']) ? $product['countdown'] : '';

$msg = "";
$msgClass = "";
if (isset($_GET['updated']) && $_GET['updated'] == '1') {
    $msg = "✅ تم تحديث المنتج بنجاح.";
    $msgClass = "success";
}

$csrf_token = generate_csrf_token();

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $isAjax = (isset($_POST['ajax']) && $_POST['ajax'] == '1');

    if (!isset($_POST['csrf_token']) || $_POST['csrf_token'] !== $_SESSION['csrf_token']) {
        $err = 'فشل التحقق. حاول إعادة تحميل الصفحة.';
        if ($isAjax) {
            header('Content-Type: application/json; charset=utf-8');
            echo json_encode(array('status' => 'error', 'msg' => $err));
            exit;
        }
        $msg = $err;
        $msgClass = 'danger';
    } else {
        $name = isset($_POST['name']) ? trim($_POST['name']) : '';
        $price = isset($_POST['price']) ? (float)$_POST['price'] : 0;
        $category_id = isset($_POST['category']) ? (int)$_POST['category'] : 0;
        $stock = isset($_POST['stock']) ? max(0, intval($_POST['stock'])) : 0;

        $description = isset($_POST['description']) ? trim($_POST['description']) : '';
        $description = strip_tags($description);
        $description = preg_replace('/(http|https|ftp|ftps )\:\/\/[a-zA-Z0-9\-\.]+\.[a-zA-Z]{2,3}(\/\S*)?/', '', $description);
        
        if (function_exists('mb_strlen') && mb_strlen($description, 'UTF-8') > 500) {
            $description = mb_substr($description, 0, 500, 'UTF-8') . '...';
        } elseif (strlen($description) > 500) {
            $description = substr($description, 0, 500) . '...';
        }
        $description_safe = htmlspecialchars($description, ENT_QUOTES, 'UTF-8');

        $countdown_time = isset($_POST['countdown_time']) ? trim($_POST['countdown_time']) : '';
        $countdown_timestamp = !empty($countdown_time) ? strtotime($countdown_time) * 1000 : null;

        if ($name === '' || $price <= 0 || !array_key_exists($category_id, $categories)) {
            $msg = "❌ الرجاء ملء الحقول الأساسية بشكل صحيح (الاسم، السعر، الفئة).";
            $msgClass = "danger";
            if ($isAjax) {
                header('Content-Type: application/json; charset=utf-8');
                echo json_encode(array('status' => 'error', 'msg' => $msg));
                exit;
            }
        } else {
            $current_image = $product['image'];
            $image_to_save = $current_image;
            $uploadDirServer = __DIR__ . "/assets/images/products/";
            if (!is_dir($uploadDirServer)) @mkdir($uploadDirServer, 0755, true);

            if (isset($_FILES['image']) && isset($_FILES['image']['error']) && $_FILES['image']['error'] === UPLOAD_ERR_OK) {
                $tmpPath = $_FILES['image']['tmp_name'];
                $file_mime = '';
                if (function_exists('finfo_open')) {
                    $finfo = finfo_open(FILEINFO_MIME_TYPE);
                    $file_mime = finfo_file($finfo, $tmpPath);
                    finfo_close($finfo);
                } else {
                    $image_info = @getimagesize($tmpPath);
                    if ($image_info !== false) $file_mime = $image_info['mime'];
                }

                $file_extension = strtolower(pathinfo($_FILES['image']['name'], PATHINFO_EXTENSION));
                $allowed_mimes = array('image/jpeg', 'image/pjpeg', 'image/png', 'image/gif', 'image/webp');
                $allowed_exts = array('jpg', 'jpeg', 'png', 'gif', 'webp');

                if (!in_array($file_mime, $allowed_mimes) && !in_array($file_extension, $allowed_exts)) {
                    $msg = "❌ صيغة الصورة غير مدعومة. استخدم JPG أو PNG أو GIF أو WEBP.";
                    $msgClass = "danger";
                    if ($isAjax) {
                        header('Content-Type: application/json; charset=utf-8');
                        echo json_encode(array('status' => 'error', 'msg' => $msg));
                        exit;
                    }
                } elseif ($_FILES['image']['size'] > 5 * 1024 * 1024) {
                    $msg = "❌ حجم الصورة كبير جدًا. الحد الأقصى 5MB.";
                    $msgClass = "danger";
                    if ($isAjax) {
                        header('Content-Type: application/json; charset=utf-8');
                        echo json_encode(array('status' => 'error', 'msg' => $msg));
                        exit;
                    }
                } else {
                    $safe_basename = uniqid('p_', true);
                    $safe_filename = $safe_basename . '.' . $file_extension;
                    $imagePathServer = $uploadDirServer . $safe_filename;
                    $publicImagePath = 'products/' . $safe_filename;

                    $upload_success = move_uploaded_file($tmpPath, $imagePathServer);

                    if ($upload_success) {
                        $thumb300 = $uploadDirServer . $safe_basename . '_300.jpg';
                        create_square_thumbnail($imagePathServer, $thumb300, 300, 85);

                        $image_to_save = $publicImagePath;

                        if (!empty($current_image)) {
                            safe_unlink($current_image);
                        }
                        @chmod($imagePathServer, 0644);
                        @chmod($thumb300, 0644);
                    } else {
                        error_log("Failed to move uploaded file in edit_product.php for product {$product_id}");
                        $msg = "❌ حدث خطأ أثناء رفع الصورة.";
                        $msgClass = "danger";
                        if ($isAjax) {
                            header('Content-Type: application/json; charset=utf-8');
                            echo json_encode(array('status' => 'error', 'msg' => $msg));
                            exit;
                        }
                    }
                }
            }

            if (isset($_POST['delete_images']) && is_array($_POST['delete_images'])) {
                $delete_ids = array_map('intval', $_POST['delete_images']);
                $delete_ids = array_filter($delete_ids, function($id) { return $id > 0; });

                if (!empty($delete_ids)) {
                    $ids_str = implode(',', $delete_ids);
                    $selectStmt = $conn->prepare("SELECT image_path FROM product_images WHERE id IN ($ids_str) AND product_id = ?");
                    $selectStmt->bind_param("i", $product_id);
                    $selectStmt->execute();
                    $res = $selectStmt->get_result();
                    $paths_to_delete = [];
                    while ($row = $res->fetch_assoc()) {
                        $paths_to_delete[] = $row['image_path'];
                    }
                    $selectStmt->close();

                    $deleteStmt = $conn->prepare("DELETE FROM product_images WHERE id IN ($ids_str) AND product_id = ?");
                    $deleteStmt->bind_param("i", $product_id);
                    $deleteStmt->execute();
                    $deleteStmt->close();

                    // 3. حذف الملفات من الخادم
                    foreach ($paths_to_delete as $path) {
                        safe_unlink($path);
                    }
                }
            }

            if (isset($_FILES['additional_images']) && is_array($_FILES['additional_images']['tmp_name'])) {
                $uploadDirServer = __DIR__ . "/assets/images/products/";
                $allowed_mimes = array('image/jpeg', 'image/pjpeg', 'image/png', 'image/gif', 'image/webp');
                
                $last_image_sort_order = 0;
                $imgStmt = $conn->prepare("SELECT sort_order FROM product_images WHERE product_id = ? ORDER BY sort_order DESC LIMIT 1");
                if ($imgStmt) {
                    $imgStmt->bind_param("i", $product_id);
                    $imgStmt->execute();
                    $imgRes = $imgStmt->get_result();
                    $last_image = $imgRes->fetch_assoc();
                    $imgStmt->close();
                    $last_image_sort_order = $last_image ? (int)$last_image['sort_order'] : 0;
                }
                $sort_order = $last_image_sort_order + 1;

                $insertImageStmt = $conn->prepare("INSERT INTO product_images (product_id, image_path, sort_order) VALUES (?, ?, ?)");

                foreach ($_FILES['additional_images']['tmp_name'] as $key => $tmp_name) {
                    if ($_FILES['additional_images']['error'][$key] === UPLOAD_ERR_OK) {
                        $file_size = $_FILES['additional_images']['size'][$key];
                        $file_name = $_FILES['additional_images']['name'][$key];

                        if ($file_size > 5 * 1024 * 1024) {
                            error_log("Additional image too large: " . $file_name);
                            continue;
                        }

                        $file_mime = '';
                        if (function_exists('finfo_open')) {
                            $finfo = finfo_open(FILEINFO_MIME_TYPE);
                            $file_mime = finfo_file($finfo, $tmp_name);
                            finfo_close($finfo);
                        }

                        if (!in_array($file_mime, $allowed_mimes)) {
                            error_log("Additional image type not allowed: " . $file_name);
                            continue;
                        }

                        $safe_basename = uniqid('p_', true) . '_add_' . $sort_order;
                        $file_extension = strtolower(pathinfo($file_name, PATHINFO_EXTENSION));
                        $imagePathServer = $uploadDirServer . $safe_basename . '.' . $file_extension;
                        $publicImagePath = 'products/' . $safe_basename . '.' . $file_extension;

                        if (move_uploaded_file($tmp_name, $imagePathServer)) {
                            @chmod($imagePathServer, 0644);
                            
                            $insertImageStmt->bind_param("isi", $product_id, $publicImagePath, $sort_order);
                            $insertImageStmt->execute();
                            $sort_order++;
                        } else {
                            error_log("Failed to move uploaded additional file: " . $file_name);
                        }
                    }
                }
                if ($insertImageStmt) $insertImageStmt->close();
            }

            if ($msg === '') {
                $stmt_upd = $conn->prepare("UPDATE products SET name = ?, price = ?, image = ?, category_id = ?, stock = ?, description = ?, countdown = ? WHERE id = ?");
                if (!$stmt_upd) {
                    error_log("DB prepare error (update product) in edit_product.php: " . $conn->error);
                    $msg = "❌ خطأ في الخادم أثناء تجهيز التحديث.";
                    $msgClass = "danger";
                    if ($isAjax) {
                        header('Content-Type: application/json; charset=utf-8');
                        echo json_encode(array('status' => 'error', 'msg' => $msg));
                        exit;
                    }
                } else {
                    $stmt_upd->bind_param("sdsiissi", $name, $price, $image_to_save, $category_id, $stock, $description_safe, $countdown_timestamp, $product_id);
                    if ($stmt_upd->execute()) {
                        $new_csrf = rotate_csrf_token();

                        $stmt = $conn->prepare("SELECT id, name, price, image, category_id, stock, description, countdown FROM products WHERE id = ? LIMIT 1");
                        $stmt->bind_param("i", $product_id);
                        $stmt->execute();
                        $result = $stmt->get_result();
                        $updated_product = $result->fetch_assoc();
                        $stmt->close();

                        $additional_images_updated = [];
                        $imgStmt = $conn->prepare("SELECT id, image_path FROM product_images WHERE product_id = ? ORDER BY sort_order ASC");
                        if ($imgStmt) {
                            $imgStmt->bind_param("i", $product_id);
                            $imgStmt->execute();
                            $imgRes = $imgStmt->get_result();
                            while ($row = $imgRes->fetch_assoc()) {
                                $additional_images_updated[] = $row;
                            }
                            $imgStmt->close();
                        }

                        if ($isAjax) {
                            $p = array(
                                'id' => $product_id,
                                'name' => htmlspecialchars($name, ENT_QUOTES, 'UTF-8'),
                                'price' => number_format((float)$price, 2),
                                'image' => htmlspecialchars($image_to_save, ENT_QUOTES, 'UTF-8'),
                                'image_url' => 'assets/images/' . ltrim($image_to_save, '/'),
                                'category_id' => $category_id,
                                'stock' => intval($stock),
                                'description' => htmlspecialchars($description_safe, ENT_QUOTES, 'UTF-8'),
                                'additional_images' => $additional_images_updated
                            );
                            header('Content-Type: application/json; charset=utf-8');
                            echo json_encode(array('status' => 'success', 'msg' => '✅ تم تحديث المنتج بنجاح.', 'product' => $p, 'csrf_token' => $new_csrf), JSON_UNESCAPED_UNICODE);
                            exit;
                        } else {
                            header("Location: edit_product.php?id={$product_id}&updated=1");
                            exit;
                        }
                    } else {
                        error_log("DB execute error (update product) in edit_product.php: " . $stmt_upd->error);
                        $msg = "❌ فشل التحديث.";
                        $msgClass = "danger";
                        if ($isAjax) {
                            header('Content-Type: application/json; charset=utf-8');
                            echo json_encode(array('status' => 'error', 'msg' => $msg));
                            exit;
                        }
                    }
                    $stmt_upd->close();
                }
            }
        }
    }
}
?>
