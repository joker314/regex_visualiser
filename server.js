const express = require('express')
const session = require('express-session')

const DEFAULT_PORT = 8000 // port to use if no environment variable set

const app = express()
const port = process.env.PORT || DEFAULT_PORT

app.use(express.static('client'))

app.listen(port, () => {
	console.log(`Running on port ${port}`)
})