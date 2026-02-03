<?php
require 'config.php';
$in=readJsonInput();
$r=(int)($in['receiver_id']??0);
$ids=$in['link_ids']??[];
if(!$r||!is_array($ids)||!$ids){ echo json_encode(['updated'=>0]); exit; }
$ids=array_map('intval',$ids);
$ids=array_filter($ids,fn($x)=>$x>0);
if(!$ids){ echo json_encode(['updated'=>0]); exit; }
$ph=implode(',',array_fill(0,count($ids),'?'));
$params=array_merge([$r],$ids);
$stmt=$pdo->prepare("UPDATE links SET is_read=1 WHERE receiver_id=? AND id IN ($ph)");
$stmt->execute($params);
echo json_encode(['updated'=>$stmt->rowCount()]);
?>