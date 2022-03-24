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
}