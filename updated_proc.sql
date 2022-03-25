USE `regex_visualiser`;

DROP PROCEDURE IF EXISTS remove_existing_regex;
DELIMITER //
CREATE PROCEDURE remove_existing_regex (
	IN u_id INT,
	IN regex_id INT,
	OUT err_code INT
) MODIFIES SQL DATA BEGIN
	START TRANSACTION;
	IF EXISTS (SELECT * FROM `regexes` WHERE `author_id` = u_id AND `r_id` = regex_id) THEN
		-- Behaviour if it's deleting your own regular expression
		DELETE FROM `regexes` WHERE `author_id` = u_id AND `r_id` = regex_id;
		SET err_code = 0;
	ELSEIF EXISTS (SELECT * FROM `regexes` INNER JOIN `students` ON `students`.`id` = `regexes`.`author_id` WHERE `students`.`teacher_id` = u_id AND `regexes`.`r_id` = regex_id) THEN
		-- Behaviour if it's your teacher deleting
		DELETE FROM `regexes` WHERE `r_id` = regex_id;
		SET err_code = 0;
	ELSEIF EXISTS (SELECT * FROM `teachers` WHERE `teachers`.`id` = u_id) THEN
		-- Teacher, but not your teacher
		SET err_code = -1;
	ELSE
		-- Student, but not the one who created the regular expression
		SET err_code = -2;
	END IF;
	COMMIT;
END //
DELIMITER ;