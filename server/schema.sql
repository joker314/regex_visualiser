CREATE DATABASE IF NOT EXISTS `regex_visualiser`;
USE `regex_visualiser`;

DROP TABLE IF EXISTS `users`;
DROP TABLE IF EXISTS `classrooms`;
DROP TABLE IF EXISTS `classroom_memberships`;

CREATE TABLE IF NOT EXISTS `users` (
	`id` INT NOT NULL AUTO_INCREMENT,
	`hashed_password` BINARY(60) NOT NULL,
	`username` VARCHAR(30) NOT NULL,
	`first_name` VARCHAR(30) NOT NULL,
	`last_name` VARCHAR(40) NOT NULL,
	`can_change_name` BOOLEAN NOT NULL,
	`is_teacher` BOOLEAN NOT NULL,
	`teacher_id` BOOLEAN NOT NULL,
	`join_date` DATETIME NOT NULL,
	PRIMARY KEY (`id`)
);

CREATE TABLE IF NOT EXISTS `classrooms` (
	`id` int NOT NULL AUTO_INCREMENT,
	`name` VARCHAR(60),
	`created_at` DATETIME NOT NULL,
	PRIMARY KEY (`id`)
);

CREATE TABLE IF NOT EXISTS `classroom_memberships` (
	`user_id` INT NOT NULL,
	`class_id` INT NOT NULL,
	PRIMARY KEY (`user_id`, `class_id`)
);