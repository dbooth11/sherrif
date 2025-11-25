<?php
require 'config.php';
$in=readJsonInput();
$sender=(int)($in['sender_id']??0);
$receiver=(int)($in['receiver_id']??0);
$url=trim($in['url']??'');
$title=trim($in['title']??'');

if(!$sender||!$receiver||!$url){ http_response_code(400); echo json_encode(['error'=>'missing fields']); exit; }

$stmt=$pdo->prepare("INSERT INTO links (sender_id,receiver_id,url,title) VALUES (?,?,?,?)");
$stmt->execute([$sender,$receiver,$url,$title]);
echo json_encode(['success'=>true,'id'=>$pdo->lastInsertId()]);
?>