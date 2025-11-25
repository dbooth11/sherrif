<?php
require 'config.php';
$r=(int)($_GET['receiver_id']??0);
$limit=(int)($_GET['limit']??6);
if(!$r){ echo json_encode([]); exit; }
$limit=max(1,min($limit,50));
$stmt=$pdo->prepare("SELECT * FROM links WHERE receiver_id=? ORDER BY created_at DESC LIMIT ?");
$stmt->bindValue(1,$r,PDO::PARAM_INT);
$stmt->bindValue(2,$limit,PDO::PARAM_INT);
$stmt->execute();
echo json_encode($stmt->fetchAll());
?>