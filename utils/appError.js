/**
 * AppError class to be used for handling all the (operational) errors in our app.
 */
class AppError extends Error {
  constructor(message, statusCode) {
    super(message); // call parent constructor. 'Error' class constructor accepts message, will set this.message = message

    this.statusCode = statusCode;
    // using template string to convert number to string
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';

    // all the errors that we create ourselves will basically be operational errors.
    // In fact, it's only these operational errors
    // for which we want to send the error message down to the client.
    this.isOperational = true; // will be used in errorController.js

    // this way when a new object is created, and a constructor function is called,
    // then that function call is not gonna appear in the stack trace, and will not pollute it.
    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = AppError;
