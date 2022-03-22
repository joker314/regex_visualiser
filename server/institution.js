export class Institution {
	static async search (dbEngine, query, limit = 10) {
		// Although no SQL injection is possible since we're using prepared statements, it's still possible for the input
		// to become mangled and return the wrong results - which is a regular bug. To avoid this, we need to escape the characters
		// which the LIKE clause treats specially.
		// There are '%', which matches zero or more characters
		// 			 '_', which matches exactly one character
		//			 '\', which is used to escape the other two
		// It's also important to get the replacement order right so that we don't double escape.
		const escapedQuery = query.replaceAll("\\", "\\\\").replaceAll("%", "\\%").replaceAll("_", "\\_")
		
		// Now actually run the query
		const [rows, fields] = await dbEngine.run(
			"SELECT `school_name` FROM `institutions` WHERE `school_name` LIKE ? LIMIT ?;",
			"%" + escapedQuery + "%",
			limit
		)
		
		console.log("The rows are", rows)
		return Array.from(rows).map(row => row.school_name)
	}

	static async add (dbEngine, name) {
		console.log("Trying to add school by the name of", name)
		const [rows, fields] = await dbEngine.run(
			"CALL insert_new_school (?, @returned_id); SELECT @returned_id;",
			name
		)
		
		return JSON.stringify({id: rows[1][0]["@returned_id"]})
	}
}