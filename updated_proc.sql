USE `regex_visualiser`;

DROP PROCEDURE IF EXISTS update_existing_regex;
DELIMITER //
CREATE PROCEDURE update_existing_regex (
	IN regex_id INT,
	IN u_id INT,
	IN new_regex VARCHAR(100),
	IN new_sample_input VARCHAR(100),
	OUT did_err BOOLEAN
) MODIFIES SQL DATA BEGIN
	START TRANSACTION;
	IF NOT EXISTS (SELECT * FROM regexes WHERE `author_id` = u_id AND `r_id` = regex_id) THEN
		SET did_err = TRUE;
	ELSE
		SET did_err = FALSE;
		-- XXX: in writeup explain how i wrote r_id instead of regex_id and it overwrote all rows in testing and so
		-- maybe i should add LIMIT clauses everywhere?
		UPDATE `regexes` SET `sample_input` = new_sample_input, `regex` = new_regex WHERE `r_id` = regex_id;
	END IF;
	COMMIT;
END //
DELIMITER ;
