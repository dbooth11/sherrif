<?php
$DB_HOST='mysql.dbooth.net';
$DB_NAME='link_sender';
$DB_USER='dbooth11';
$DB_PASS='Maytheforce#33';

header('Content-Type: application/json; charset=utf-8');
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: *");
header("Referrer-Policy: *");

try {
  $pdo=new PDO("mysql:host=$DB_HOST;dbname=$DB_NAME;charset=utf8mb4",$DB_USER,$DB_PASS,[
    PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC
  ]);
} catch(Exception $e){ http_response_code(500); echo json_encode(['error'=>'DB fail']); exit; }

function readJsonInput(){
  $raw=file_get_contents('php://input');
  $data=json_decode($raw,true);
  return is_array($data)?$data:[];
}
?>