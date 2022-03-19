class Classroom {
	constructor (dbEngine, id, name, createdAt = new Date()) {
		this.dbEngine = dbEngine
		this.id = id
		this.name = name
		this.createdAt = createdAt
	}
	
	async searchForStudent (name) {
		// Split the name into a first name and a last name
		// TODO: make it illegal to set a name which contains a space
		const [firstName, ...lastNameParts] = name.split(" ")
		const lastName = lastNameParts.join(" ")
		
		const SELECT_USERS = 
		
		const studentRows = await dbEngine.run(
			"SELECT users.id, users.first_name, users.last_name FROM users, classroom_memberships WHERE " +
			"classroom_memberships.user_id = user.id AND " + // this causes an inner join on the user ID
			"classroom_memberships.classroom_id = ? AND " + // this restricts results to those relating to this classroom
			"(" +
				"users.first_name LIKE CONCAT('%', ?, '%') AND " +
				"users.last_name LIKE CONCAT('%', ?, '%')" +
			") OR (" + // make sure results still show up if first name and surname have been swapped over
				"users.last_name LIKE CONCAT('%', ?, '%') AND " +
				"users.first_name LIKE CONCAT('%', ?, '%')" +
			") ORDER BY users.last_name, users.first_name;",
			firstName,
			lastName,
			firstName,
			lastName
		)
		
		// Convert the students into objects so that other parts of the code
		// can use it more easily
		return studentRows.map(row => {
			const [id, firstName, lastName] = row
			return new User(dbEngine, id, firstName)
		})
	}
}