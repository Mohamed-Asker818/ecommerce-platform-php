<?php
session_start();
require_once '../Model/db.php';

header('Content-Type: application/json; charset=utf-8');

header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, GET, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

class RegisterAPI {
    private $conn;

    public function __construct($conn) {
        $this->conn = $conn;
    }

    public function handleRequest() {
        $method = $_SERVER['REQUEST_METHOD'];

        if ($method === 'POST') {
            $action = isset($_GET['action']) ? $_GET['action'] : '';

            switch ($action) {
                case 'check_field':
                    return $this->checkField();
                case 'suggest':
                    return $this->suggest();
                case 'register':
                    return $this->registerUser();
                default:
                    return $this->errorResponse('Invalid request');
            }
        }

        return $this->errorResponse('Method not allowed');
    }

    private function getInput() {
        $input = json_decode(file_get_contents('php://input'), true);
        if (!$input) {
            $input = $_POST;
        }
        return $input;
    }

    private function checkField() {
        $input = $this->getInput();

        $field = isset($input['field']) ? $input['field'] : '';
        $value = isset($input['value']) ? trim($input['value']) : '';

        if (empty($field)) {
            return $this->errorResponse('Field is required');
        }

        $response = ['success' => true, 'valid' => true];

        switch ($field) {
            case 'name':
                if (strlen($value) < 2) {
                    $response['valid'] = false;
                    $response['message'] = 'Name must be at least 2 characters';
                } elseif (!preg_match('/^[\p{L}\p{N}\s\-\']+$/u', $value)) {
                    $response['valid'] = false;
                    $response['message'] = 'Name can only contain letters, numbers, spaces, apostrophes, and hyphens';
                } else {
                    if (!$this->isUnique('name', $value)) {
                        $response['valid'] = false;
                        $response['message'] = 'This name is already taken';
                        $response['suggestions'] = $this->generateNameSuggestions($value);
                    }
                }
                break;

            case 'email':
                if (!filter_var($value, FILTER_VALIDATE_EMAIL)) {
                    $response['valid'] = false;
                    $response['message'] = 'Invalid email format';
                } else {
                    if (!$this->isUnique('email', $value)) {
                        $response['valid'] = false;
                        $response['message'] = 'This email is already registered';
                        $response['suggestions'] = $this->generateEmailSuggestions($value);
                    }
                }
                break;

            case 'password':
                if (strlen($value) < 6) {
                    $response['valid'] = false;
                    $response['message'] = 'Password must be at least 6 characters';
                } elseif (!preg_match('/[a-zA-Z]/', $value)) {
                    $response['valid'] = false;
                    $response['message'] = 'Password must contain at least one letter';
                }
                break;

            case 'confirm_password':
                $password = isset($input['password']) ? $input['password'] : '';
                if ($value !== $password) {
                    $response['valid'] = false;
                    $response['message'] = 'Passwords do not match';
                }
                break;

            default:
                break;
        }

        return $response;
    }

    private function isUnique($field, $value) {
        if (!$this->conn) {
            error_log("isUnique: no DB connection");
            return false;
        }

        $allowed = ['name', 'email'];
        if (!in_array($field, $allowed)) {
            error_log("isUnique: invalid field requested: $field");
            return false;
        }

        try {
            $query = "SELECT id FROM users WHERE `$field` = ? LIMIT 1";
            $stmt = $this->conn->prepare($query);
            if (!$stmt) {
                error_log("isUnique - prepare failed: " . $this->conn->error);
                return false;
            }

            $stmt->bind_param('s', $value);
            $stmt->execute();

            $stmt->store_result();
            $exists = $stmt->num_rows > 0;

            $stmt->close();
            return !$exists;
        } catch (Throwable $t) {
            error_log("Database error in isUnique: " . $t->getMessage());
            return false;
        }
    }

    private function generateNameSuggestions($baseName) {
        $suggestions = [];
        $cleanName = trim($baseName);
        $patterns = [
            $cleanName . rand(1, 99),
            $cleanName . rand(100, 999),
            $cleanName . '_' . rand(1, 99),
            $this->randomNameCombo() . rand(1,99),
            substr($cleanName, 0, 1) . rand(100, 999),
            $cleanName . date('y')
        ];

        foreach ($patterns as $pattern) {
            if (count($suggestions) >= 5) break;
            if ($this->isUnique('name', $pattern) && !in_array($pattern, $suggestions)) {
                $suggestions[] = $pattern;
            }
        }

        while (count($suggestions) < 3) {
            $suggestion = $cleanName . rand(1000, 99999);
            if (!in_array($suggestion, $suggestions)) {
                $suggestions[] = $suggestion;
            }
        }

        return array_slice($suggestions, 0, 5);
    }

    private function generateEmailSuggestions($email) {
        $suggestions = [];
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            return $suggestions;
        }
        list($localPart, $domain) = explode('@', $email);
        $cleanLocal = preg_replace('/[^a-zA-Z0-9]/', '', $localPart);

        $patterns = [
            $cleanLocal . rand(1, 99) . '@' . $domain,
            $cleanLocal . '_' . rand(1, 99) . '@' . $domain,
            strtolower($this->randomFirst()) . strtolower($this->randomLast()) . rand(1,99) . '@' . $domain,
            $cleanLocal . rand(10,99) . '@' . $this->randomDomain()
        ];

        foreach ($patterns as $pattern) {
            if (count($suggestions) >= 5) break;
            if (filter_var($pattern, FILTER_VALIDATE_EMAIL) && $this->isUnique('email', $pattern) && !in_array($pattern, $suggestions)) {
                $suggestions[] = $pattern;
            }
        }

        while (count($suggestions) < 3) {
            $suggestion = $cleanLocal . rand(10000, 99999) . '@' . $domain;
            if (!in_array($suggestion, $suggestions)) {
                $suggestions[] = $suggestion;
            }
        }

        return array_slice($suggestions, 0, 5);
    }

    private function randomFirst() {
        $arr = ['ahmed','mohamed','ali','omar','khaled'];
        return $arr[array_rand($arr)];
    }
    private function randomLast() {
        $arr = ['ali','hassan','mahmoud','ibrahim','khalil'];
        return $arr[array_rand($arr)];
    }
    private function randomDomain() {
        $arr = ['gmail.com','yahoo.com','outlook.com'];
        return $arr[array_rand($arr)];
    }
    private function randomNameCombo() {
        return $this->randomFirst() . ucfirst($this->randomLast());
    }

    private function suggest() {
        $input = $this->getInput();
        $type = isset($input['type']) ? $input['type'] : '';
        $value = isset($input['value']) ? trim($input['value']) : '';

        if (empty($type) || empty($value)) {
            return $this->errorResponse('Type and value are required');
        }

        if ($type === 'name') {
            $suggestions = $this->generateNameSuggestions($value);
        } elseif ($type === 'email') {
            $suggestions = $this->generateEmailSuggestions($value);
        } else {
            return $this->errorResponse('Invalid type');
        }

        return [
            'success' => true,
            'suggestions' => $suggestions
        ];
    }

    private function registerUser() {
        $input = $this->getInput();

        if (!$input) {
            return $this->errorResponse('Invalid input');
        }

        $required = ['name', 'email', 'password', 'confirm_password'];
        foreach ($required as $field) {
            if (!isset($input[$field]) || trim($input[$field]) === '') {
                return $this->errorResponse("Please fill in: " . $field);
            }
        }

        $name = trim($input['name']);
        $email = trim($input['email']);
        $password = $input['password'];
        $confirmPassword = $input['confirm_password'];
        $phone = isset($input['phone']) ? trim($input['phone']) : '';

        if (strlen($name) < 2) return $this->errorResponse('Name must be at least 2 characters');
        if (!preg_match('/^[\p{L}\p{N}\s\-\']+$/u', $name)) return $this->errorResponse('Name can only contain letters, numbers, spaces, apostrophes, and hyphens');
        if (!$this->isUnique('name', $name)) return $this->errorResponse('This name is already taken');
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) return $this->errorResponse('Invalid email format');
        if (!$this->isUnique('email', $email)) return $this->errorResponse('This email is already registered');
        if (strlen($password) < 6) return $this->errorResponse('Password must be at least 6 characters');
        if (!preg_match('/[a-zA-Z]/', $password)) return $this->errorResponse('Password must contain at least one letter');
        if ($password !== $confirmPassword) return $this->errorResponse('Passwords do not match');

        try {
            $hashedPassword = password_hash($password, PASSWORD_DEFAULT);

            $query = "INSERT INTO users (name, email, password, phone, created_at) VALUES (?, ?, ?, ?, NOW())";
            $stmt = $this->conn->prepare($query);
            if (!$stmt) {
                error_log("Register prepare failed: " . $this->conn->error);
                return $this->errorResponse('Database error. Please try again later.');
            }

            $stmt->bind_param('ssss', $name, $email, $hashedPassword, $phone);

            if (!$stmt->execute()) {
                error_log("Register execute failed: " . $stmt->error);
                $stmt->close();
                return $this->errorResponse('Failed to create account. Please try again.');
            }

            $userId = $stmt->insert_id;
            $stmt->close();

            $_SESSION['user_id'] = $userId;
            $_SESSION['user_name'] = $name;
            $_SESSION['user_email'] = $email;
            $_SESSION['logged_in'] = true;
            session_regenerate_id(true);

            return $this->successResponse('Account created successfully!', [
                'user_id' => $userId,
                'user_name' => $name,
                'redirect' => 'Home.php'
            ]);
        } catch (Throwable $t) {
            error_log("Registration error: " . $t->getMessage());
            return $this->errorResponse('Unexpected server error. Please try again later.');
        }
    }

    private function successResponse($message, $data = []) {
        return array_merge([
            'success' => true,
            'msg' => $message
        ], $data);
    }

    private function errorResponse($message) {
        return [
            'success' => false,
            'msg' => $message
        ];
    }
}

try {
    if (!isset($conn) || !$conn) {
        throw new Exception("Database connection failed");
    }

    $registerAPI = new RegisterAPI($conn);
    $response = $registerAPI->handleRequest();

    echo json_encode($response, JSON_UNESCAPED_UNICODE);
} catch (Throwable $e) {
    error_log("API Error: " . $e->getMessage());
    echo json_encode([
        'success' => false,
        'msg' => 'Server error occurred. Please try again later.'
    ], JSON_UNESCAPED_UNICODE);
} finally {
    if (isset($conn) && $conn) {
        $conn->close();
    }
}
