// Import libraries necessary to run the web server
// This includes parsing cookies and handling sessions
import express from 'express'
import session from 'express-session'

const session = require('express-session')

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

// TODO: consider commenting each parameter?
app.use(session({
	secret: sessionSecret,
	cookie: {secure: usingHTTPS},
	sameSite: true,
	saveUninitialized: false,
	resave: false
}))

app.use(express.urlencoded())

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

app.post('/login', async (req, res) => {
	try {
		const signedInUser = await User.fromPassword(
			req.body.username,
			req.body.password
		)
	catch (e) {
		if (e.name === 'ClientError') {
			res.statusCode(400)
			res.send("Client error: " + e.message)
		} else {
			// Reraise the exception
			throw e;
		}
	}
})

app.use(express.static('client'))

app.listen(port, () => {
	console.log(`Running on port ${port}`)
})