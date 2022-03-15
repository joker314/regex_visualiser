const express = require('express')
const app = express()
const port = 3000

app.set('view engine', 'ejs')

app.use(express.static('static'))

app.get('/', (req, res) => {
	res.render('index.ejs')
})

app.get('/api/getSubmissions', (req, res) => {
	
})

// TODO: use environment variables
app.listen(port, () => {
	console.log(`Running on port ${port}!`)
})
