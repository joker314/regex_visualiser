CREATE DATABASE IF NOT EXISTS `sessions`; -- library will populate this database itself
CREATE DATABASE IF NOT EXISTS `regex_visualiser`;
USE `regex_visualiser`;

DROP TABLE IF EXISTS `users`, `institutions`, `teachers`, `students`, `regexes`, `classrooms`, `classroom_memberships`;
CREATE TABLE IF NOT EXISTS `users` (
	`id` INT NOT NULL AUTO_INCREMENT,
	`hashed_password` VARCHAR(60) NOT NULL,
	`username` VARCHAR(60) NOT NULL,
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
	`school_affiliation_id` INT, -- a teacher doesn't have to immediately specify their school, so the 'NOT NULL' constraint is omitted
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
	IN phash VARCHAR(60),
	IN uname VARCHAR(60),
	IN fname VARCHAR(30),
	IN lname VARCHAR(40),
	IN name_changeable BOOLEAN,
	IN id_of_teacher INT,
	IN jdate DATETIME,
	OUT id_or_error_code INT
) MODIFIES SQL DATA BEGIN
	START TRANSACTION READ WRITE;
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
				id_or_error_code, fname, lname, name_changeable, id_of_teacher
			);
		END IF;
	END IF;
	COMMIT;
END //
DELIMITER ;

DROP PROCEDURE IF EXISTS register_new_teacher;
DELIMITER //
CREATE PROCEDURE register_new_teacher (
	IN phash VARCHAR(60),
	IN uname VARCHAR(60),
	IN preferred_name VARCHAR(70),
	IN institution_id INT,
	IN jdate DATETIME,
	OUT id_or_error_code INT
) MODIFIES SQL DATA BEGIN
	START TRANSACTION;
	IF EXISTS (SELECT * FROM `users` WHERE `username` = uname) THEN
		SET id_or_error_code = -1;
	ELSE IF NOT EXISTS (SELECT * FROM `institutions` WHERE `i_id` = institution_id) THEN
		SET id_or_error_code = -2;
	ELSE
		INSERT INTO users (
			`hashed_password`, `username`, `join_date`
		) VALUES (
			phash, uname, jdate
		);
		
		SET id_or_error_code = LAST_INSERT_ID();
		INSERT INTO teachers (`id`, `name`, `school_affiliation_id`) VALUES (id_or_error_code, preferred_name, institution_id);
	END IF;
	COMMIT;
END //
DELIMITER ;

DROP PROCEDURE IF EXISTS fetch_password_hash;
DELIMITER //
CREATE PROCEDURE fetch_password_hash (
	IN uname VARCHAR(60),
	OUT r_hash VARCHAR(60),
	OUT r_id INT
) READS SQL DATA BEGIN
	START TRANSACTION;
	IF EXISTS (SELECT * FROM `users` WHERE `username` = uname) THEN
		SELECT `hashed_password`, `id` INTO r_hash, r_id FROM `users` WHERE username = uname LIMIT 1;
	ELSE
		SET r_id = -1; -- negative value signals an error
		SET r_hash = NULL;
	END IF;
	COMMIT;
END //
DELIMITER ;

DROP PROCEDURE IF EXISTS fetch_user_from_id;
DELIMITER //
CREATE PROCEDURE fetch_user_from_id (
	IN u_id INT,
	OUT r_is_teacher BOOLEAN,
	OUT r_uname VARCHAR(60),
	-- student outputs
	OUT r_fname VARCHAR(30),
	OUT r_lname VARCHAR(40),
	OUT r_can_change_name BOOLEAN,
	OUT r_teacher_id INT,
	-- teacher outputs
	OUT r_name VARCHAR(70),
	OUT r_school_name VARCHAR(100)
) READS SQL DATA BEGIN
	START TRANSACTION;
	SELECT `first_name`, `last_name`, `can_change_name`, `teacher_id`
	INTO r_fname, r_lname, r_can_change_name, r_teacher_id
	FROM `students` WHERE `id` = u_id;
	
	SELECT `name`, `school_name` INTO r_name, r_school_name FROM `teachers` INNER JOIN `institutions` ON
		   `teachers`.`school_affiliation_id` = `institutions`.`i_id` WHERE `id` = u_id;
	
	SELECT `username` INTO r_uname FROM `users` WHERE `id` = u_id;
	SET r_is_teacher = EXISTS (SELECT * FROM `teachers` WHERE `id` = u_id);
	COMMIT;
END //
DELIMITER ;

DROP PROCEDURE IF EXISTS insert_new_school;
DELIMITER //
CREATE PROCEDURE insert_new_school (
	IN sch_name VARCHAR(100),
	OUT r_id INT
) READS SQL DATA BEGIN
	START TRANSACTION;
	IF NOT EXISTS (SELECT * FROM `institutions` WHERE `school_name` = sch_name) THEN
		INSERT INTO `institutions` (
			`school_name`
		) VALUES (
			sch_name
		);
	END IF;
	
	SELECT `i_id` INTO r_id FROM `institutions` WHERE `school_name` = sch_name;
	COMMIT;
END //
DELIMITER ;