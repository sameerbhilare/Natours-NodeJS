// It's kind of a convention to have all the Express configuration in app.js file
const path = require('path');
const express = require('express');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');
const hpp = require('hpp');
const cookieParser = require('cookie-parser');
const compression = require('compression');

const tourRouter = require('./routes/tourRoutes');
const userRouter = require('./routes/userRoutes');
const reviewRouter = require('./routes/reviewRoutes');
const bookingRouter = require('./routes/bookingRoutes');
const viewRouter = require('./routes/viewRoutes');
const AppError = require('./utils/appError');
const globalErrorHandler = require('./controllers/errorController');

/****************************************************
 * GLOBAL MIDDLEWARES
 */
// express is a function which upon calling will add a bunch of methods to our app variable.
const app = express();

/*
  request.secure doesn't work in the first place because Heroku acts as a proxy, 
  which kind of redirects and modifies incoming requests.
  So we need to trust the proxies. For this, express has built in support for this kind of situations.
*/
app.enable('trust proxy');

/*
  Express automatically supports the most common engines out of the box, and pug is one of them. 
  So we actually don't even need to install pug, and we also don't need to require it anywhere. 
  All of this happens behind the scenes internally in Express.
*/
app.set('view engine', 'pug');

// to define which folder our views are located
app.set('views', path.join(__dirname, 'views'));

/*************************************************** */
// static files middleware
app.use(express.static(path.join(__dirname, 'public')));
//app.use(express.static(`${__dirname}/public`)); // same as above line

/*************************************************** */
// Setting Security HTTP Headers - Should be used at the top
// helmet
// in app.use, we always need a function, not a function call.
// So here we are calling this function which will then in turn return a function
app.use(helmet());

/*************************************************** */
// adding and using 3rd prty middleware - morgan for logging
console.log(process.env.NODE_ENV);
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

/*************************************************** */
// defining limiter middleware function
/* this also send few headers
    X-RateLimit-Limit => total number of requests allowed
    X-RateLimit-Remaining => total number of requests remaining
    X-RateLimit-Reset => time when limit will be reset */
const limiter = rateLimit({
  // we can basically define how many requests per IP we are going to allow in a certain amount of time.
  // Here we allow 100 requests from the same IP in 1 hour.
  // This totally depends upon the type of application we are building
  max: 100,
  windowMs: 60 * 60 * 1000, // 60 minutes
  // if that limit is then crossed by a certain IP, they will get back an error message.
  // an sets status code as 429 which means too many requests.
  message: 'Too many requests from an IP. Please try again in a hour.',
});
// using limiter middleware for all requests to '/api'
// this will affect all routes under this URI ('/api')
app.use('/api', limiter);

/*************************************************** */
// creating custom middleware and adding it to middleware stack
/*
app.use((req, res, next) => {
  // each middleware receives req, res objects and next function
  console.log('Hello from the middleware. :) ');
  next(); // we must call next() method otherwise request-response cycle will stop
});
*/

/*************************************************** */
// use middleware to get acess to request body data from API call. Body parser
// Also limiting data to 10kb. so body larger than 10kb will not be accepted
app.use(express.json({ limit: '10kb' }));

// to parse data coming from HTML form element.
// with this, the form data (POST) is available in req.body
app.use(express.urlencoded({ extended: true, limit: '10kb' })); // extended true will simply allow us to pass some more complex data

// cookie parser
app.use(cookieParser());

/*************************************************** */
// Data Sanitization
// should be done after Body parser middleware, above.
// Data Sanitization againt NoSQL query injection
/*
  what this middleware does is to look at the request body, the request query string,
  and also at Request.Params, and then it will basically filter out all of the dollar signs and dots,
  because that's how MongoDB operators are written. 
  By removing that, well, these operators are then no longer going to work.
*/
app.use(mongoSanitize()); // mongoSanitize() returns a middleware function

// Data Sanitization againt Cross site Scripting (XSS) attack
/*
  This will then clean any user input from malicious HTML code
  basically by converting all these HTML symbols.
*/
app.use(xss()); // xss() returns a middleware function

/*************************************************** */
// Preventing Paramter Pollution
// should be used at the end because what it does is to clear up the query string
// what is does is, if same query param occurs more than once, last value is used.
// E.g. /api/v1/tours?sort=name&sort=price => here 'name' will be ignored and 'price' is used
app.use(
  hpp({
    //  white list is simply an array of properties for which we actually allow duplicates in the query string.
    whitelist: [
      'duration',
      'ratingsQuantity',
      'ratingsAverage',
      'maxGroupSize',
      'difficulty',
      'price',
    ],
  })
); // hpp() returns a middleware function

// compress all our responses no matter if that's JSON or HTML code.
app.use(compression()); //  return a middleware function which is then again going to compress all the text that is sent to clients.

/*************************************************** */
app.use((req, res, next) => {
  req.requestTime = new Date().toISOString();
  //console.log(req.headers); // to log headers
  //console.log(req.cookies);
  next();
});

// routes
// app.get('/api/v1/tours', getAllTours);
// app.post('/api/v1/tours', createTour);
// app.get('/api/v1/tours/:id', getTour);
// app.patch('/api/v1/tours/:id', updateTour);
// app.delete('/api/v1/tours/:id', deleteTour);

// mounting the view router as the first one
app.use('/', viewRouter);
// mounting the router. so mounting a new router(tourRouter) on a route ('/api/v1/tours')
app.use('/api/v1/tours', tourRouter); // add router middleware to stack. mounting the router
app.use('/api/v1/users', userRouter); // add router middleware to stack. mounting the router
app.use('/api/v1/reviews', reviewRouter); // add router middleware to stack. mounting the router
app.use('/api/v1/bookings', bookingRouter); // add router middleware to stack. mounting the router

// HANDLING UNHANDLED ROUTES
/*
  If code reaches here, that means none of above route handlers matched.
  So in other words, we have an unhandled route.
*/
// .all() takes care of all HTTP methods - GET, POST, DELETE, etc.
// * means all the routes. (obviously those which are not handled above)
// otherwise we would have to add same thing for .get(), .post(), etc., which is unnecessary
app.all('*', (req, res, next) => {
  // 1) WITHOUT GLOBAL EXCEPTION HANDLING
  /*
  res.status(404).json({
    status: 'fail',
    message: `Can't find ${req.originalUrl} on this server!`, // req.originalUrl means requested URL
  }); */
  // 2) USING GLOBAL EXCEPTION HANDLING
  /*
  const error = new Error(`Can't find ${req.originalUrl} on this server!`);
  error.status = 'fail';
  error.statusCode = 404;
  /*
    If the next function receives an argument, no matter what it is, 
    Express will automatically know that there was an error.
    So it will assume that whatever we pass into next is gonna be an error.
    This applies to every next function in every single middleware anywhere in our application.
    
    And it will then skip all the other middlewares in the middleware stack 
    and sends the error that we passed in to our global error handling middleware,
    which will then be executed.
  next(error); 
  */

  // 3) USING GLOBAL EXCEPTION HANDLING - WITH SEPERATE CLASS
  next(new AppError(`Can't find ${req.originalUrl} on this server!`, 404));
});

// GLOBAL ERROR HANDLING
app.use(globalErrorHandler);

// export the express app
module.exports = app;
