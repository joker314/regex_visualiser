import mysql from 'mysql'

const DB_TESTING_PASS = 'secretpass'

const DB_HOST = process.env.DB_HOST || 'localhost'
const DB_USER = process.env.DB_USER || 'max'
const DB_PASS = process.env.DB_PASS || DB_TESTING_PASS

if (process.env.NODE_ENV === 'production' && DB_PASS === DB_TESTING_PASS) {
	throw new Error("Using hard-coded database password in production is insecure")
}

const connection = mysql.createConnection({
	host: DB_HOST,
	user: DB_USER,
	password: DB_PASS
})

export const databasePromise = new Promise((resolve, reject) => {
	connection.connect(err => {
		if (err) {
			reject(err)
		} else {
			console.log("Established connection to MySQL database")
			resolve(connection)
		}
	})
})