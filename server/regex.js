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
			throw new ClientError("There was a problem saving the regular expression, perhaps because you're not logged in to the correct account?")
		}
		
		return JSON.stringify({
			success: true
		})
	}
}