// Import libraries necessary to run the web server
// This includes parsing cookies and handling sessions
import express from 'express'
import session from 'express-session'
import createSessionStore from 'express-mysql-session'
import {databasePromise, MYSQL_COMMON_SETTINGS} from './dbEngine.js'

import {User} from './user.js'
import {Institution} from './institution.js'
import {Regex} from './regex.js'

import {ClientError} from './clienterror.js'

// Port to use if no PORT environment variable set (e.g. in dev environments)
const DEFAULT_PORT = 8000

// This secret should never actually be used in production, but is hard coded here just to make
// it easier when developers work on the project locally.
const INSECURE_SECRET = "test secret"

// Set up the app and configure settings related to how all the libraries should run
// This includes specifying the port, whether to assume HTTPS is enabled, and so on.
// Most of these settings are configured through environment variables with some default
// values o be used in development environemnts
const app = express()
const port = process.env.PORT || DEFAULT_PORT
const usingHTTPS = process.env.USE_HTTPS || false // assume we don't use HTTPS in dev environments
const sessionSecret = process.env.SECRET || INSECURE_SECRET

const MySQLStore = createSessionStore(session)
const sessionStore = new MySQLStore({
	...MYSQL_COMMON_SETTINGS,
	database: 'sessions'
})

const connection = await databasePromise

// TODO: consider commenting each parameter?
app.use(session({
	secret: sessionSecret,
	cookie: {secure: usingHTTPS},
	sameSite: true,
	saveUninitialized: false,
	resave: false,
	store: sessionStore
}))

app.use(express.urlencoded({extended: false}))

const UNEXPECTED_SERVER_ERROR = "The server experienced an unexpected error when processing your registration request. Try again later."

/**
 * This is a higher order function which makes sure that sensitive information isn't accidentally
 * disclosed through error messages, while still ensuring helpful errors are passed along to the user.
 */
function errorWrapper (requestHandler, isJSON = false) {
	// Helper function which will convert the error to JSON if
	// the parameter to the outer function requested it.
	function formatError (error) {
		if (isJSON) {
			return JSON.stringify({error})
		} else {
			return error
		}
	}
	
	return async (req, res) => {
		try {
			await requestHandler(req, res)
		} catch (error) {
			if (error.name === 'ClientError') {
				res.status(400).send(formatError(error.message))
			} else {
				console.error(error)
				res.status(500).send(formatError(UNEXPECTED_SERVER_ERROR))
			}
		}
	}
}

/**
 * If we're in production, but for some reason we're not using HTTPS
 * then this is a security issue so we should throw an error and fail
 * to run until someone investigates what's going on. Similarly, if we
 * are using the insecure secret
 */
if (app.get('env') === 'production') {
	if (!usingHTTPS) {
		throw new Error("Not using HTTPS in a production environment is insecure")
	}
	
	if (sessionSecret === INSECURE_SECRET) {
		throw new Error("Using a hard-coded secret in a production environment is insecure")
	}
}

app.use(async (req, res, next) => {
	if (req.session.userID) {
		try {
			req.sessionUser = await User.fromID(connection, req.session.userID)
			console.log("Session user is set")
		} catch (error) {
			req.session.destroy()
			console.error("Cleared the session because trying to fetch the associated user led to an error")
			console.error(error)
		}
	}
	
	console.log("Session middleware has run")
	next()
})

app.get('/info', async (req, res) => {
	console.log("Processing request")
	if (req.sessionUser) {
		if (req.sessionUser.isTeacher) {
			res.send(`You are a teacher. Your preferred name is ${req.sessionUser.preferredName}. Your school is ${req.sessionUser.schoolName}. Your ID is ${req.sessionUser.id}`)
		} else {
			res.send(`You are a student. Your name is ${req.sessionUser.firstName} ${req.sessionUser.lastName}`)
		}
	} else {
		res.send("Logged out")
	}
})

app.get('/api/institutions/search', async (req, res) => {
	console.log("Searching", req.query.query)
	res.send(JSON.stringify(await Institution.search(connection, req.query.query)))
})

app.post('/api/institutions/add', async (req, res) => {
	console.log("The POST body is", req.body)
	console.log("Adding", req.body.name)
	res.send(await Institution.add(connection, req.body.name))
})

app.post('/api/regex/add', errorWrapper(async (req, res) => {
	if (req.sessionUser) {
		res.send(await Regex.add(
			connection,
			req.sessionUser.id,
			req.body.regex,
			req.body.sample_input
		))
	} else {
		throw new ClientError("You are not logged in anymore so cannot save the regular expression to the server.")
	}
}, true))

app.post('/api/regex/edit', errorWrapper(async (req, res) => {
	if (req.sessionUser) {
		res.send(await Regex.edit(
			connection,
			req.sessionUser.id,
			req.body.regex_id,
			req.body.regex,
			req.body.sample_input
		))
	} else {
		throw new ClientError("You are not logged in anymore, so you can't save the new version of the regular expression to the server")
	}
}, true))

app.post('/api/regex/remove', errorWrapper(async (req, res) => {
	if (req.sessionUser) {
		res.send(await Regex.remove(
			connection,
			req.sessionUser.id,
			req.body.regex_id
		))
	} else {
		throw new Error("You need to log in again in order to delete the regular expression")
	}
}, true))

app.post('/accountDelete', async (req, res) => {
	if (req.sessionUser) {
		await req.sessionUser.remove()
		req.session.destroy(() => res.redirect('/info'))
	} else {
		res.redirect('/info')
	}
})

app.get('/my_regexes', async (req, res) => {
	if (req.sessionUser) {
		res.send(await req.sessionUser.renderRegexes())
	} else {
		res.send("Not logged in")
	}
})

app.get('/logout', async (req, res) => {
	// TODO: security!! make this POST with CSRF protection
	// and make all the other POSTs have CSRF protection
	// TODO: check callback params are correct
	req.session.destroy(() => res.send("Logged out"))
})

app.post('/login', errorWrapper(async (req, res) => {
	const signedInUser = await User.fromPassword(
		connection,
		req.body.username,
		req.body.password
	)

	req.session.userID = signedInUser.id
	res.redirect('/info')
}))

app.post('/registerStudent', errorWrapper(async (req, res) => {
	const signedInUser = await User.registerStudent(
		connection,
		req.body.username,
		req.body.password,
		req.body.first_name,
		req.body.last_name,
		true,
		req.body.teacher_id
	)

	req.session.userID = signedInUser.id
	res.send("Nice to meet you " + signedInUser.firstName + " " + signedInUser.lastName)
}))

app.post('/registerTeacher', errorWrapper(async (req, res) => {
	const signedInUser = await User.registerTeacher(
		connection,
		req.body.username,
		req.body.password,
		req.body.name,
		req.body.institution_id
	)
	
	req.session.userID = signedInUser.id
	res.send("Welcome, " + signedInUser.firstName)
}))

app.use(express.static('client'))

app.listen(port, () => {
	console.log(`Running on port ${port}`)
})