import {ClientError} from './clienterror.js'

export class Regex {
	constructor (dbEngine, userID, regexID) {
		this.dbEngine = dbEngine
		this.userID = userID
		this.regexID = regexID
	}
	
	static async add (dbEngine, userID, regex, sampleInput) {
		const [results, fields] = await dbEngine.run(
			"CALL insert_new_regex(?, ?, ?, @id); SELECT @id;",
			userID,
			regex,
			sampleInput
		)
		
		const idOrErrorCode = results[1][0]["@id"]
		
		if (idOrErrorCode === -1) {
			throw new ClientError("You are not authorised to save a new regular expression. Maybe your login expired?")
		}
		
		return JSON.stringify({
			id: idOrErrorCode 
		})
	}
	
	static async edit (dbEngine, userID, regexID, newRegex, newSampleInput) {
		const [results, fields] = await dbEngine.run(
			"CALL update_existing_regex(?, ?, ?, ?, @did_error); SELECT @did_error;",
			regexID,
			userID,
			newRegex,
			newSampleInput
		)
		
		const didError = results[1][0]["@did_error"]
		
		if (didError) {
			throw new ClientError("There was a problem saving the regular expression. You might have become logged out, or the regular expression has been deleted. Try creating a copy instead?")
		}
		
		return JSON.stringify({
			success: true
		})
	}
	
	static async remove (dbEngine, userID, regexID) {
		const [results, fields] = await dbEngine.run(
			"CALL remove_existing_regex(?, ?, @err_code); SELECT @err_code;",
			userID,
			regexID
		)
		
		const errorCode = results[1][0]["@err_code"]
		
		if (errorCode === -1) {
			throw new ClientError("The author of this regular expression is not your student, so you're not allowed to delete it")
		}
		
		if (errorCode === -2) {
			throw new ClientError("You can't delete somebody else's regular expression since you're a student")
		}
		
		return JSON.stringify({
			success: true
		})
	}
}