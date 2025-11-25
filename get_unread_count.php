<?php
require 'config.php';
$r=(int)($_GET['receiver_id']??0);
if(!$r){ echo json_encode(['unreadCount'=>0]); exit; }
$stmt=$pdo->prepare("SELECT COUNT(*) c FROM links WHERE receiver_id=? AND is_read=0");
$stmt->execute([$r]);
$row=$stmt->fetch();
echo json_encode(['unreadCount'=>(int)$row['c']]);
?>