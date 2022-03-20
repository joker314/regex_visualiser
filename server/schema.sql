CREATE DATABASE IF NOT EXISTS `regex_visualiser`;
USE `regex_visualiser`;

DROP TABLE IF EXISTS `users`, `institutions`, `teachers`, `students`, `regexes`, `classrooms`, `classroom_memberships`;

CREATE TABLE IF NOT EXISTS `users` (
	`id` INT NOT NULL AUTO_INCREMENT,
	`hashed_password` BINARY(60) NOT NULL,
	`username` VARCHAR(30) NOT NULL,
	`join_date` DATETIME NOT NULL,
	PRIMARY KEY (`id`)
);

-- Justification for this table is that in the future, it might be possible that other parameters
-- of schools, like their websites, might be stored -- and this normalises in advance.
CREATE TABLE IF NOT EXISTS `institutions` (
	`i_id` INT NOT NULL AUTO_INCREMENT,
	`school_name` VARCHAR(100),
	PRIMARY KEY (`i_id`),
	UNIQUE KEY (`school_name`)
);


CREATE TABLE IF NOT EXISTS `teachers` (
	`id` INT NOT NULL, -- not auto increment - foreign key with users.id as parent
	`school_affiliation_id` INT NOT NULL,
	`name` VARCHAR(70), -- teachers might be more flexible with their names, e.g. 'Mr T'
	PRIMARY KEY (`id`),
	FOREIGN KEY (`id`) REFERENCES `users`(`id`),
	FOREIGN KEY (`school_affiliation_id`) REFERENCES `institutions`(`i_id`)
);

CREATE TABLE `students` (
	`id` INT NOT NULL, -- not auto increment - foreign key with users.id as parent
	`first_name` VARCHAR(30) NOT NULL,
	`last_name` VARCHAR(40) NOT NULL,
	`can_change_name` BOOLEAN NOT NULL,
	`teacher_id` INT NOT NULL,
	PRIMARY KEY (`id`),
	FOREIGN KEY (`id`) REFERENCES `users`(`id`),
	FOREIGN KEY (`teacher_id`) REFERENCES `teachers`(`id`) -- don't do ON DELETE CASCADE since students should not disappear when a teacher is removed
);

CREATE TABLE IF NOT EXISTS `regexes` (
	`r_id` INT NOT NULL AUTO_INCREMENT,
	`author_id` INT NOT NULL,
	`regex` VARCHAR(20),
	PRIMARY KEY (`r_id`),
	FOREIGN KEY (`author_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
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

-- Stored procedures
-- XXX: reason for using these is that when I tried to place it inline, it didn't like the use of IF statements
-- and then I read the docs more closely and turns out it's only allowed in stored procedures. Also, having them inline
-- meant they were less searchable (broken over several lines) and syntax highlighting didn't work.
-- Plus, syntax errors were only detectable at runtime and more parsing had to be done by the SQL engine every time the query
-- would run.
DROP PROCEDURE IF EXISTS register_new_user;
DELIMITER //
CREATE PROCEDURE register_new_user (
	IN phash BINARY(60),
	IN uname VARCHAR(30),
	IN fname VARCHAR(30),
	IN lname VARCHAR(40),
	IN name_changeable BOOLEAN,
	IN teacher_account BOOLEAN,
	IN id_of_teacher INT,
	IN jdate DATETIME,
	OUT id_or_error_code INT
) MODIFIES SQL DATA BEGIN
	SELECT COUNT(*) INTO @username_exists FROM users WHERE username = uname;
	IF (@does_username_exist > 0) THEN
		SET id_or_error_code = -1;
	ELSE
		SELECT COUNT(*) INTO @teacher_exists FROM users WHERE `is_teacher` = 1 AND `teacher_id` = id_of_teacher;
		IF @teacher_exists = 0 THEN
			SET id_or_error_code = -2;
		ELSE
			INSERT INTO users (
				hashed_password, username, first_name, last_name, can_change_name, is_teacher, teacher_id, join_date
			) VALUES (
				phash, uname, fname, lname, name_changeable, teacher_account, id_of_teacher, jdate
			);
			SET id_or_error_code = LAST_INSERT_ID();
		END IF;
	END IF;
END //

DELIMITER ;