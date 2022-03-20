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

DROP PROCEDURE IF EXISTS register_new_student;
DELIMITER //
CREATE PROCEDURE register_new_student (
	IN phash BINARY(60),
	IN uname VARCHAR(30),
	IN fname VARCHAR(30),
	IN lname VARCHAR(40),
	IN name_changeable BOOLEAN,
	IN id_of_teacher INT,
	IN jdate DATETIME,
	OUT id_or_error_code INT
) MODIFIES SQL DATA BEGIN
	SELECT COUNT(*) INTO @username_exists FROM users WHERE username = uname;
	IF (@does_username_exist > 0) THEN
		SET id_or_error_code = -1; -- error: username already exists
	ELSE
		SELECT COUNT(*) INTO @teacher_exists FROM `teachers` WHERE `id` = id_of_teacher;
		IF @teacher_exists = 0 THEN
			SET id_or_error_code = -2; -- error: provided teacher doesn't exist
		ELSE
			INSERT INTO users (
				`hashed_password`, `username`, `join_date`
			) VALUES (
				phash, uname, jdate
			);
			
			-- there have been no errors, so set the id_or_error_code to the ID,
			-- both so it can be returned later and also referenced in the next INSERT
			-- statement
			SET id_or_error_code = LAST_INSERT_ID();
			
			INSERT INTO students (
				`id`, `first_name`, `last_name`, `can_change_name`, `teacher_id`
			) VALUES (
				@id_or_error_code, fname, lname, name_changeable, id_of_teacher
			);
		END IF;
	END IF;
END //
DELIMITER ;