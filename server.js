/**
 * It's a good practice to have everything that is related to express in one file (app.js),
 * and then everything that is related to the server in another main file (server.js).
 *
 * So server.js will actually be our starting file where everything starts,
 * and it's there when we listen to our server.
 * This file will have stuff not related to express, but still related to our application.
 * So stuff like database configurations, or some error handling stuff, or environment variables, etc.
 */
const mongoose = require('mongoose');
const dotenv = require('dotenv');

// global handling for uncaught exceptions - should be at the top only
process.on('uncaughtException', (err) => {
  console.log('Uncaught Exception. Shutting down gracefully...');
  console.error(err.name, err.message);
  process.exit(1); // 0 for success, 1 for uncaught exception
});

dotenv.config({ path: './config.env' });

// app need to be required after dotenv config is set.
// If we require the app file before our environment variables are read from the config file,
// then we won't be able to access the env variables in the app.js file
const app = require('./app');

// get connection string
const connectionString = process.env.DATABASE.replace('<PASSWORD>', process.env.DATABASE_PASSWORD);

// connect to the database
// Note: We need to pass few options to connect method in order to deal with some deprecation warnings.
// If you still get some warnings, based on the error, add that option in the connect() method.
mongoose
  .connect(connectionString, {
    useNewUrlParser: true,
    useCreateIndex: true,
    useFindAndModify: false,
    useUnifiedTopology: true,
  })
  .then(() => {
    //console.log(conn.connections);
    console.log('DB Connection successful!');
  });

// 'env' variable set by Express
//console.log(app.get('env'));

// variables set by Node.js
//console.log(process.env);

// start the server
const port = process.env.PORT || 3000;
const server = app.listen(port, () => {
  console.log(`App running on port ${port}...`);
});

// global handling for unhandled rejections (for errors ourside express)
// kind of safety net :)
process.on('unhandledRejection', (err) => {
  console.log('Unhandled Rejection. Shutting down gracefully...');
  console.error(err.name, err.message);

  // process.exit() will immediately abort all the requests that are currently still running or pending.
  // NOT A GOOD IDEA. So We should shutdown GRACEFULLY.
  // With server.close, we give the server, time to finish all the request
  // that are still pending or being handled at the time.
  server.close(() => {
    process.exit(1); // 0 for success, 1 for uncaught exception
  });
});

/*
  Heroku dynos restart every 24 hours in order to keep your app in a healthy state.
  And the way that Heroku does this is by sending the so-called SIGTERM signal to our node application, 
  and the application will then basically shut down immediately. So we should handleit gracefully.
*/
process.on('SIGTERM', () => {
  console.log('SIGTERM recevied. Shutting down gracefully...');
  // With server.close, we give the server, time to finish all the request
  // that are still pending or being handled at the time.
  server.close(() => {
    console.log('Process terminated!');
    // no need to call process.exit because SIGTERM itself will cause the applicationto shutdown
  });
});
