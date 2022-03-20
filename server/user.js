import bcrypt from 'bcrypt'

export class User {
	static FIRST_NAME_LENGTH_LIMIT = 30
	static LAST_NAME_LENGTH_LIMIT = 40
	static USERNAME_LENGTH_LIMIT = 30
	
	static BCRYPT_SALT_ROUNDS = 10
	
	constructor (dbEngine, id, username, firstName, lastName, canChangeName, isTeacher, teacherID, joinDate = new Date()) {
		this.dbEngine = dbEngine
		this.id = id
		this.firstName = firstName
		this.lastName = lastName
		this.canChangeName = canChangeName
		this.isTeacher = isTeacher
		this.teacherID = teacherID
		this.joinDate = joinDate
	}
	
	async insertIntoDb () {
		// Check if there is an associated entry in the database with this user
		// If there isn't, we should create it
		if (this.id === null) {
			await this.dbEngine.run(
				"INSERT INTO users (`first_name`, `last_name`, `can_change_name`, `join_date`) VALUES (?, ?, ?, ?);",
				this.firstName,
				this.lastName,
				this.canChangeName,
				this.joinDate
			)
		} else {
			throw new Error("Object already appears to have been inserted into the database, because it has an ID")
		}
	}
	
	async deleteFromDb () {
		if (this.id === null) {
			throw new Error("Can't delete object from the database because it hasn't been inserted into the database yet")
		}
		
		await this.dbEngine.run(
			"DELETE FROM `users` WHERE `id` = ?;",
			this.id
		)
	}
	
	async setName (nameChanger, newFirstName, newLastName) {
		// AUTHENTICTAION
		// We're going to be comparing IDs to test if two people are the same. These sorts of checks
		// could go wrong if the IDs haven't specified yet, so we should defend against this security
		// risk by exiting out early if this happens
		if (nameChanger.id === null || this.id === null) {
			throw new Error("No databse ID: Run insertIntoDb() first")
		}
		
		if (this.isTeacher) {
			// If this is a teacher account, they can change their own name but nobody else can
			if (nameChanger.id !== this.id) {
				throw new Error("You don't have authorisation to change this person's name because they're a teacher")
			}
		} else {
			// If this is instead a student account, their teacher can always change their name. Also,
			// a student can change their own name, but only if a teacher has given them permission to do so.
			if (nameChanger.isTeacher && nameChanger.id !== this.teacherID) {
				throw new Error("You don't have authorisation to change this person's name because you're not their teacher")
			}
			
			// We show a different error message to the name changer if they're a student other than the student
			// whose name is being changed
			if (!nameChanger.isTeacher && nameChanger.id !== this.id) {
				throw new Error("You don't have authorisation to change this person's name because you're a student")
			}
			
			// Finally, we should make sure the student's ability to change their own name hasn't been
			// disabled by their teacher
			if (!this.canChangeName) {
				throw new Error("Changing your name has been disabled by your teacher, contact them to change your name instead")
			}
		}
		
		// VALIDATION
		// Make sure the names aren't empty, and if they are return a descriptive error
		if (newFirstName === "" || newLastName === "") {
			throw new Error("First and last names can't be empty")
		}
		
		// Now check to make sure the names will fit into the database records
		if (newFirstName.length > User.FIRST_NAME_LENGTH_LIMIT) {
			throw new Error("First name too long, maximimum length is " + FIRST_NAME_LENGTH_LIMIT)
		}
		
		if (newLastName.length > User.LAST_NAME_LENGTH_LIMIT) {
			throw new Error("Last name too long, maximum length is " + LAST_NAME_LENGTH_LIMIT)
		}
		
		
		// Finally, actually issue the SQL command needed for updating the name
		await this.dbEngine.run(
			"UPDATE `users` SET `first_name` = ?, `last_name` = ? WHERE `id` = ?;",
			newFirstName,
			newLastName,
			this.id
		)
	}
	
	static async fromPassword (dbEngine, username, password) {
		const matchingPasswords = await dbEngine.run(
			"SELECT `hashed_password`, `id`, `username`, `first_name`, `last_name`, `can_change_name`, `is_teacher`, `teacher_id`, `join_date` FROM `users` " +
			"WHERE username = ? LIMIT 1;",
			username
		)
		
		if (matchingPasswords.length === 0) {
			throw new ClientError("Nobody with that username found")
		}
		
		const [passwordHash, ...otherData] = matchingPasswords[0]
		
		if (await bcrypt.compare(password, passwordHash)) {
			return new User(...otherData)
		} else {
			throw new ClientError("Password is wrong")
		}
	}
}