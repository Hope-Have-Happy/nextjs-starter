"use strict"

// Load environment variables from .env file if present
require('dotenv').load()

// now-logs allows remote debugging if deploying to now.sh
if (process.env.LOGS_SECRET) require('now-logs')(process.env.LOGS_SECRET)

// Default when run with `npm start` is 'production' and default port is '80'
// `npm run dev` defaults mode to 'development' & port to '3000'
process.env.NODE_ENV = process.env.NODE_ENV || "production"
process.env.PORT = process.env.PORT || 80

// Configure a database to store user profiles and email sign in tokens
// Database connection string for ORM (e.g. MongoDB/Amazon Redshift/SQL DB…)
// By default it uses SQL Lite to create a DB in /tmp/nextjs-starter.db
process.env.DB_CONNECTION_STRING = process.env.DB_CONNECTION_STRING || "sqlite:///tmp/nextjs-starter.db"

// Secret used to encrypt session data stored on the server
process.env.SESSION_SECRET = process.env.SESSION_SECRET || "change-me"

const express = require('express')
const next = require('next')
const auth = require('./routes/auth')
const orm = require("orm")

const app = next({
  dir: '.', 
  dev: (process.env.NODE_ENV === 'development') ? true : false
})

const handle = app.getRequestHandler()
let server

app.prepare()
.then(() => {
  // Get instance of Express server
  server = express()

  // Set it up the database (used to store user info and email sign in tokens)
  return new Promise((resolve, reject) => {
    // Before we can set up authentication routes we need to set up a database
    orm.connect(process.env.DB_CONNECTION_STRING, function(err, db) {
      if (err) throw err

      // Define our user object
      // * If adding a new oauth provider, add a field to store account id
      // * Tokens are single use but don't expire & we don't save verified date
      const User = db.define("user", {
        name      : { type: "text" },
        email     : { type: "text", unique: true },
        token     : { type: "text", unique: true },
        verified  : { type: "boolean", defaultValue: false },
        facebook  : { type: "text" },
        google    : { type: "text" },
        twitter   : { type: "text" }
      })

      // Creates require tables/collections on DB
      // Note: If you add fields to am object this won't do that for you, it
      // only creates tables/collections if they are not there - you still need 
      // to handle database schema changes yourself.
      db.sync(function(err) {
        if (err) throw err
        return resolve(db)
      })
    })
  })
})
.then((db) => {
  // Once DB is available, setup sessions and routes for authentication
  auth.configure(app, server, { 
    db: db,
    secret: process.env.SESSION_SECRET
   })
  
  // A simple example of a custom route
  // Says requests to '/route/{anything}' will be handled by 'pages/routing.js'
  // and the {anything} part will be pased to the page in parameters.
  server.get('/route/:id', (req, res) => {
    return app.render(req, res, '/routing', req.params)
  })

  // Default catch-all handler to allow Next.js to handle all other routes
  server.all('*', (req, res) => {
    return handle(req, res)
  })

  // Set vary header (good practice)
  // Note: This overrides any existing "Vary" header but is okay in this app
  server.use(function(req, res, next) {
    res.setHeader('Vary', 'Accept-Encoding')
    next()
  })
  
  server.listen(process.env.PORT, (err) => {
    if (err) throw err
    console.log('> Ready on http://localhost:'+process.env.PORT+" ["+process.env.NODE_ENV+"]")
  })
})