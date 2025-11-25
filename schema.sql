CREATE DATABASE IF NOT EXISTS link_sender;
USE link_sender;

CREATE TABLE users (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  name VARCHAR(100),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE links (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  sender_id INT UNSIGNED NOT NULL,
  receiver_id INT UNSIGNED NOT NULL,
  url TEXT NOT NULL,
  title VARCHAR(255),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  is_read TINYINT(1) DEFAULT 0,
  INDEX (receiver_id, created_at),
  INDEX (receiver_id, is_read)
);

INSERT INTO users (email,name) VALUES
  ('dbooth11@gmail.com','Don'),
  ('kevinzahm.com','Kev');

INSERT INTO links (sender_id,receiver_id,url,title,is_read) VALUES
  (1,2,'https://example.com/page1','Example Page 1',0),
  (1,2,'https://example.com/page2','Example Page 2',1),
  (2,1,'https://mozilla.org','Mozilla',0),
  (2,1,'https://chrome.com','Chrome',0);
