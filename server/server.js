// Import libraries necessary to run the web server
// This includes parsing cookies and handling sessions
import express from 'express'
import session from 'express-session'
import {databasePromise} from './dbEngine.js'

import {User} from './user.js'

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

const connection = await databasePromise

// TODO: consider commenting each parameter?
app.use(session({
	secret: sessionSecret,
	cookie: {secure: usingHTTPS},
	sameSite: true,
	saveUninitialized: false,
	resave: false
}))

app.use(express.urlencoded({extended: false}))

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

app.use((req, res, next) => {
	if (req.session.userID) {
		req.sesionUser = User.fromID(connection, req.session.usedID)
		console.log("Session user is set")
	}
	
	next()
})

app.get('/info', async (req, res) => {
	if (req.sessionUser) {
		if (req.sessionUser.isTeacher) {
			res.send(`You are a teacher. Your preferred name is ${req.sessionUser.preferredName}`)
		} else {
			res.send(`You are a student. Your name is ${req.sessionUser.firstName} ${req.sessionUser.lastName}`)
		}
	}
	
	res.send("Logged out")
})

app.get('/logout', async (req, res) => {
	// TODO: security!! make this POST with CSRF protection
	// and make all the other POSTs have CSRF protection
	// TODO: check callback params are correct
	req.session.destroy(() => res.send("Logged out"))
})

app.post('/login', async (req, res) => {
	try {
		const signedInUser = await User.fromPassword(
			connection,
			req.body.username,
			req.body.password
		)
		
		res.send("Nice to meet you " + signedInUser.firstName)
	} catch (error) {
		if (error.name === 'ClientError') {
			res.status(400).send("Client error: " + error.message)
		} else {
			console.error(error)
			res.status(500).send("The server experienced an unexpected error when processing your registration request. Try again later.")
		}
	}
})

app.post('/registerStudent', async (req, res) => {
	try {
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
	} catch (error) {
		if (error.name === 'ClientError') {
			res.status(400).send("Client error: " + error.message)
		} else {
			console.error(error)
			res.status(500).send("The server experienced an unexpected error when processing your registration request. Try again later.")
		}
	}
})

app.post('/registerTeacher', async (req, res) => {
	try {
		const signedInUser = await User.registerTeacher(
			connection,
			req.body.username,
			req.body.password,
			req.body.name
		)
		
		req.session.userID = signedInUser.id
		res.send("Welcome, " + signedInUser.firstName)
	} catch (error) {
		// TODO: make factory function for this error checking and abstract it away
		if (error.name === 'ClientError') {
			res.status(400).send("Client error: " + error.message)
		} else {
			console.error(error)
			res.status(500).send("The server experienced an unexpected error when processing your registration request. Try again later")
		}
	}
})

app.use(express.static('client'))

app.listen(port, () => {
	console.log(`Running on port ${port}`)
})