<?php
$conn = new mysqli("localhost", "root", "", "ecommerce_db");
if ($conn->connect_error) {
  die("فشل الاتصال: " . $conn->connect_error);
}
$conn->set_charset("utf8");
