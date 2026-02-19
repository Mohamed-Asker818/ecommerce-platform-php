<?php
session_start();

if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

header('Content-Type: application/json; charset=utf-8');

if (!isset($_SESSION['compare'])) {
    $_SESSION['compare'] = [];
}

try {
    require_once '../Model/db.php';
    
    if (!$conn) {
        throw new Exception('فشل الاتصال بقاعدة البيانات');
    }
    
    $action = isset($_GET['action']) ? $_GET['action'] : '';
    
    switch ($action) {
        case 'get_data':
            handleGetData($conn);
            break;
            
        case 'remove_item':
            handleRemoveItem();
            break;
            
        case 'clear_all':
            handleClearAll();
            break;
            
        case 'get_columns': 
            handleGetColumns($conn);
            break;
            
        default:
            sendResponse(false, 'طلب غير معروف');
    }
    
} catch (Exception $e) {
    sendResponse(false, 'خطأ في الخادم: ' . $e->getMessage());
}

function handleGetData($conn) {
    if (empty($_SESSION['compare'])) {
        sendResponse(true, [
            'products' => [],
            'count' => 0,
            'max' => 4
        ]);
        return;
    }
    
    $productIds = array_keys($_SESSION['compare']);
    
    if (empty($productIds)) {
        sendResponse(true, [
            'products' => [],
            'count' => 0,
            'max' => 4
        ]);
        return;
    }
    
    $columns = getExistingColumns($conn);
    
    $placeholders = str_repeat('?,', count($productIds) - 1) . '?';
    $columnsList = implode(', ', $columns);
    
    $query = "SELECT $columnsList FROM products WHERE id IN ($placeholders)";
    
    $stmt = $conn->prepare($query);
    if (!$stmt) {
        throw new Exception('خطأ في تحضير الاستعلام: ' . $conn->error);
    }
    
    $types = str_repeat('i', count($productIds));
    $stmt->bind_param($types, ...$productIds);
    
    if (!$stmt->execute()) {
        throw new Exception('خطأ في تنفيذ الاستعلام: ' . $stmt->error);
    }
    
    $result = $stmt->get_result();
    $products = [];
    
    while ($row = $result->fetch_assoc()) {
        $products[] = formatProductData($row);
    }
    
    $stmt->close();
    
    sendResponse(true, [
        'products' => $products,
        'count' => count($products),
        'max' => 4
    ]);
}

function getExistingColumns($conn) {
    $desiredColumns = [
        'id',
        'name', 
        'price',
        'image',
        'stock',
        'description'
    ];
    
    $optionalColumns = [
        'old_price',
        'category',
        'rating', 
        'weight',
        'dimensions',
        'warranty',
        'specifications'
    ];
    
    $existingColumns = [];
    $result = $conn->query("SHOW COLUMNS FROM products");
    
    if ($result) {
        while ($row = $result->fetch_assoc()) {
            $existingColumns[] = $row['Field'];
        }
    }
    
    $selectedColumns = [];
    
    foreach ($desiredColumns as $column) {
        if (in_array($column, $existingColumns)) {
            $selectedColumns[] = $column;
        } else {
            $selectedColumns[] = "' ' as $column";
        }
    }
    
    foreach ($optionalColumns as $column) {
        if (in_array($column, $existingColumns)) {
            $selectedColumns[] = $column;
        }
    }
    
    return $selectedColumns;
}

function formatProductData($row) {
    $defaultValues = [
        'id' => 0,
        'name' => 'منتج غير معروف',
        'price' => 0,
        'old_price' => null,
        'image' => 'default.jpg',
        'stock' => 0,
        'description' => 'لا يوجد وصف',
        'category' => 'غير محدد',
        'rating' => 0,
        'weight' => 'غير محدد',
        'dimensions' => 'غير محدد',
        'warranty' => 'غير محدد'
    ];
    
    $product = [];
    
    foreach ($defaultValues as $key => $defaultValue) {
        if (isset($row[$key])) {
            $value = $row[$key];
            
            switch($key) {
                case 'id':
                    $product[$key] = (int)$value;
                    break;
                case 'price':
                case 'old_price':
                    $product[$key] = (float)$value;
                    break;
                case 'stock':
                    $product[$key] = (int)$value;
                    break;
                case 'rating':
                    $product[$key] = (float)$value;
                    break;
                case 'name':
                case 'description':
                case 'category':
                case 'weight':
                case 'dimensions':
                case 'warranty':
                    $product[$key] = htmlspecialchars($value, ENT_QUOTES, 'UTF-8');
                    break;
                case 'image':
                    $product[$key] = !empty($value) ? $value : 'default.jpg';
                    break;
                default:
                    $product[$key] = $value;
            }
        } else {
            $product[$key] = $defaultValue;
        }
    }
    
    return $product;
}

function handleRemoveItem() {
    $productId = isset($_POST['product_id']) ? (int)$_POST['product_id'] : 0;
    
    if ($productId <= 0) {
        sendResponse(false, 'معرف المنتج غير صالح');
        return;
    }
    
    if (isset($_SESSION['compare'][$productId])) {
        unset($_SESSION['compare'][$productId]);
        
        sendResponse(true, [
            'msg' => 'تمت إزالة المنتج من المقارنة',
            'count' => count($_SESSION['compare'])
        ]);
    } else {
        sendResponse(false, 'المنتج غير موجود في المقارنة');
    }
}

function handleClearAll() {
    $_SESSION['compare'] = [];
    
    sendResponse(true, [
        'msg' => 'تمت إزالة جميع المنتجات من المقارنة',
        'count' => 0
    ]);
}

function handleGetColumns($conn) {
    $result = $conn->query("SHOW COLUMNS FROM products");
    $columns = [];
    
    if ($result) {
        while ($row = $result->fetch_assoc()) {
            $columns[] = $row['Field'];
        }
    }
    
    sendResponse(true, [
        'columns' => $columns,
        'count' => count($columns)
    ]);
}

function sendResponse($success, $data) {
    $response = ['success' => $success];
    
    if ($success) {
        $response = array_merge($response, is_array($data) ? $data : ['data' => $data]);
    } else {
        $response['msg'] = $data;
    }
    
    echo json_encode($response, JSON_UNESCAPED_UNICODE);
    exit;
}
?>
