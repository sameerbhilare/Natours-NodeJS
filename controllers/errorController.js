/*
    Adding Error handler.
    Handler in MVC means a Controller. 
*/

const AppError = require('../utils/appError');

// send error function for development env
const sendErrorDev = (err, req, res) => {
  /*
    If error is from /api/...., then send json error response.
    Otherwise send rendered response
  */
  // entire URL but not with the host.
  if (req.originalUrl.startsWith('/api')) {
    // A) API
    return res.status(err.statusCode).json({
      status: err.status,
      message: err.message, // we should pass the message from the error origin
      error: err,
      stack: err.stack,
    });
  }

  // B) RENDERED WEBSITE
  console.error('ERROR', err);
  return res.status(err.statusCode).render('error', {
    title: 'Something went wrong!',
    msg: err.message,
  });
};

// send error function for production env
const sendErrorProd = (err, req, res) => {
  /*
    If error is from /api/...., then send json error response.
    Otherwise send rendered response
  */
  // entire URL but not with the host.
  if (req.originalUrl.startsWith('/api')) {
    // A) API
    // a) for operational errors - trusted error: send message to client
    if (err.isOperational) {
      return res.status(err.statusCode).json({
        status: err.status,
        message: err.message, // we should pass the message from the error origin
      });
    }

    // b) for programming or other unknown errors: don't want to leak details to the client
    // 1) log the error so that we will know the details about this unknown error
    console.error('ERROR', err);

    // 2) send generic message to the client
    return res.status(500).json({
      status: 'error',
      message: 'Something went wrong!',
    });
  }

  // B) RENDERED WEBSITE
  // a) for operational errors - trusted error: send message to client
  if (err.isOperational) {
    return res.status(err.statusCode).render('error', {
      title: 'Something went wrong!',
      msg: err.message,
    });
  }
  // b) for programming or other unknown errors: don't want to leak details to the client
  // 1) log the error so that we will know the details about this unknown error
  console.error('ERROR', err);

  // 2) send generic message to the client
  return res.status(err.statusCode).render('error', {
    title: 'Something went wrong!',
    msg: 'Please try again later!',
  });
};

/*
  "error": {
        "stringValue": "\"5fa4db1fb4c1441ab86b559\"",
        "kind": "ObjectId",
        "value": "5fa4db1fb4c1441ab86b559", // value that we passed in
        "path": "_id",    // name of the field
        "reason": {},
        "statusCode": 500,
        "status": "error"
    }
*/
const handleCastErrorDB = (err) => {
  // conveting mongoose error into a nice operational error
  const message = `Invalid ${err.path}: ${err.value}`;
  return new AppError(message, 400);
};

/*
  "error": {
        "driver": true,
        "name": "MongoError",
        "index": 0,
        "code": 11000,      // this is the mongodb error code for duplicate
        "keyPattern": {
            "name": 1
        },
        "keyValue": {
            "name": "The Forest Hiker"  // we want this value to show
        },
        "statusCode": 500,
        "status": "error"
    },
*/
// Hnalding for duplicate input
const handleDuplicateFieldsDB = (err) => {
  // conveting mongoose error into a nice operational error
  const message = `Duplicate field value: ${JSON.stringify(
    err.keyValue
  )}. Please use another value`;
  return new AppError(message, 400);
};

/*
  "error": {
        "errors": {
            "difficulty": {
                "name": "ValidatorError",
                "message": "Difficulty can either be: easy, medium, difficult",
                "properties": {
                    "message": "Difficulty can either be: easy, medium, difficult",
                    "type": "enum",
                    "enumValues": [
                        "easy",
                        "medium",
                        "difficult"
                    ],
                    "path": "difficulty",
                    "value": "asasa"
                },
                "kind": "enum",
                "path": "difficulty",
                "value": "asasa"
            }
            // + there could be many others
        },
*/
// Handling validation error
const handleValidationErrorDB = (err) => {
  // conveting mongoose error into a nice operational error
  const errors = Object.values(err.errors) // to get all values of err.errors
    .map((el) => el.message);

  const message = `Invalid Input Data. ${errors.join('. ')}`;
  return new AppError(message, 400);
};

// Handler for JWT error
const handleJWTInvalidError = () => new AppError('Invalid token. Please login again!', 401);

// Handler for JWT token expiratio error
/*
  "error": {
        "name": "TokenExpiredError",
        "message": "jwt expired",
        "expiredAt": "2020-11-12T04:18:39.000Z",
        "statusCode": 500,
        "status": "error"
    },
*/
const handleJWTExpiredError = () =>
  new AppError('Your token has expired. Please login again!', 401);

// GLOBAL ERROR HANDLING
/*
  To define an error handling middleware, all we need to do is 
  to give the middleware function four arguments 
  and Express will then automatically recognize it as an error handling middleware.
  And therefore, only call it when there is an error.
*/
module.exports = (err, req, res, next) => {
  // console.log(err.stack); // to log stacktrace for this error

  // statusCode will be defined on the err object. Default is 500.
  err.statusCode = err.statusCode || 500;
  err.status = err.status || 'error';

  if (process.env.NODE_ENV === 'development') {
    sendErrorDev(err, req, res);
  } else if (process.env.NODE_ENV === 'production') {
    // handling mongoose/mongodb errors -
    // Here we want to create meaningful 'operational' error messages for mongodb errors
    let error = { ...err }; // creating deep copy
    error.message = err.message; // Quick fix for above line. message is not getting copied with above line

    //if (error.name === 'CastError') error = handleCastErrorDB(error);
    if (error.kind === 'ObjectId') error = handleCastErrorDB(error); // invalid input (id)
    if (error.code === 11000) error = handleDuplicateFieldsDB(error); // duplicate value
    // validation errors
    if (err.errors) error = handleValidationErrorDB(error);

    if (error.name === 'JsonWebTokenError') error = handleJWTInvalidError();
    if (error.name === 'TokenExpiredError') error = handleJWTExpiredError();

    // response for prod env
    sendErrorProd(error, req, res);
  }
};
