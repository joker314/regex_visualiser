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
}