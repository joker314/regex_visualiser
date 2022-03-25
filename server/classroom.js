import {ClientError} from './clienterror.js'

export class Homework {
	static NAME_MAX_LENGTH = 60
	
	constructor (dbEngine, id) {
		this.dbEngine = dbEngine
		this.id = id
	}
	
	static async create (dbEngine, userID, assignmentName) {
		const createdAt = new Date()
		
		const [results, fields] = await dbEngine.run(
			"CALL create_new_homework(?, ?, ?, @id_or_error_code); SELECT @id_or_error_code;",
			userID,
			assignmentName,
			createdAt
		)
		
		const idOrErrorCode = results[1][0]["@id_or_error_code"]
		
		if (idOrErrorCode === -1) {
			throw new ClientError("Only teachers can set homeworks")
		}
		
		return JSON.stringify({
			id: idOrErrorCode
		})
	}
	
	async submitRegex (userID, regexID) {
		const [results, fields] = await this.dbEngine.run(
			"CALL submit_homework(?, ?, ?, @err_code); SELECT @err_code;",
			userID,
			regexID,
			this.id
		)
		
		const errorCode = results[1][0]["@err_code"];
		
		if (errorCode === -1) {
			throw new ClientError("You can't submit to this homework because it's not owned by your teacher")
		}
		
		if (errorCode === -2) {
			throw new ClientError("You can't submit somebody else's regular expression for homework")
		}
		
		return JSON.stringify({
			success: true
		})
	}
	
	async remove (userID) {
		const [results, fields] = await this.dbEngine.run(
			"CALL remove_homework(?, ?, @did_err); SELECT @did_err;",
			userID,
			this.id
		)
		
		const didError = results[1][0]["@did_err"];
		
		if (didErr) {
			throw new ClientError("You aren't logged in as the owner of the homework and so can't delete it")
		}
		
		return JSON.stringify({
			success: true
		})
	}
	
	async unsubmitRegex (userID, regexID) {
		const [results, fields] = await this.dbEngine.run(
			"CALL unsubmit_homework(?, ?, ?, @err_code); SELECT @err_code;",
			userID,
			regexID,
			this.id
		)
		
		const errorCode = results[1][0]["@err_code"];
		
		if (errorCode === -1) {
			throw new ClientError("Only the author of the regular expression can remove their homework submission") 
		}
		
		return JSON.stringify({
			success: true
		})
	}	
	
	async searchForStudent (name) {
		// Split the name into a first name and a last name
		// TODO: make it illegal to set a name which contains a space
		const [firstName, ...lastNameParts] = name.split(" ")
		const lastName = lastNameParts.join(" ")
		
		const SELECT_USERS = 
		
		const studentRows = await dbEngine.run(`
			SELECT users.id, users.first_name, users.last_name FROM users, classroom_memberships WHERE 
			classroom_memberships.user_id = user.id AND -- this causes an inner join on the user ID
			classroom_memberships.classroom_id = ? AND -- this restricts results to those relating to this classroom
			(
				users.first_name LIKE CONCAT('%', ?, '%') AND
				users.last_name LIKE CONCAT('%', ?, '%')
			) OR ( -- make sure results still show up if first name and surname have been swapped over
				users.last_name LIKE CONCAT('%', ?, '%') AND
				users.first_name LIKE CONCAT('%', ?, '%')
			) ORDER BY users.last_name, users.first_name;
			`,
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