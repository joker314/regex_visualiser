import mysql from 'mysql'

const DB_TESTING_PASS = 'secretpass'

const DB_HOST = process.env.DB_HOST || 'localhost'
const DB_USER = process.env.DB_USER || 'max'
const DB_PASS = process.env.DB_PASS || DB_TESTING_PASS
const DB_DATABASE = process.env.DB_DATABASE || 'regex_visualiser'

if (process.env.NODE_ENV === 'production' && DB_PASS === DB_TESTING_PASS) {
	throw new Error("Using hard-coded database password in production is insecure")
}

export const MYSQL_COMMON_SETTINGS = {
	host: DB_HOST,
	user: DB_USER,
	password: DB_PASS
}

const connection = mysql.createConnection({
	...MYSQL_COMMON_SETTINGS,
	multipleStatements: true,
	database: DB_DATABASE
})

/**
 * Provides a uniform interface for interacting with the database, even if the type of database
 * changes, or if the library used to interface with the database changes.
 */
class DatabaseEngine {
	constructor (underlyingConnection) {
		this.underlyingConnection = underlyingConnection
	}
	
	// The MySQL library is callback-based, but our interface is Promise-based
	/**
	 * Execute an SQL query. Question marks are replaced with the placeholderValues, in the order
	 * they appear in the query. Returns a promise which:
	 *  - rejects with the error of the underlying database connection if there is an error; or
	 *  - resolves with the data returned from the database if the query was successful
	 */
	run (sqlQuery, ...placeholderValues) {
		return new Promise((resolve, reject) => {
			this.underlyingConnection.query(sqlQuery, placeholderValues, (error, results, fields) => {
				if (error) {
					reject(error)
				} else {
					resolve([results, fields])
				}
			})
		})
	}
}

export const databasePromise = new Promise((resolve, reject) => {
	connection.connect(err => {
		if (err) {
			reject(err)
		} else {
			console.log("Established connection to MySQL database")
			resolve(new DatabaseEngine(connection))
		}
	})
})