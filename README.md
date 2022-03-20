# Local Installation

1. Make sure you have `node` and `npm` installed (https://nodejs.org)
2. Run `npm install` to install all the dependencies for hosting the server
3. If you're using a local database for testing, install `mysql-server` and set up a database
4. Set the environment variables:
	- PORT - the port over which to host, default is 8000
	- USE_HTTPS - whether or not to enforce HTTPS-only cookies for the session, default is false
	- SECRET - the secret used by the session store manager, default is 'test secret'
	- DB_HOST - the database hostname, default is 'localhost'
	- DB_USER - the username for accessing the database, default is 'max'
	- DB_PASS - the password for accessing the database, default is 'secretpass'
	- DB_DATABASE - the name of the database to use, default is 'regex_visualiser'
5. Create a database `regex_visualiser` and run `./schema.sql` to set up the correct tables
6. Run `npm start` to launch the web server
