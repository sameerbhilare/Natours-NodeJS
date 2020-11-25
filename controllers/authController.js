/*
    This controller is for all the functions relating to User authentication.
    e.g. signup, login, reset password, etc.
*/
const util = require('util'); // node built in package
const crypto = require('crypto'); // node built in package
const jwt = require('jsonwebtoken');
const User = require('../models/userModel');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const Email = require('../utils/email');

// utility method to sign the token
const signToken = (id) => {
  return jwt.sign(
    { id: id }, // payload. We are only using 'id'
    process.env.JWT_SECRET, // secret key to be used for signing up and verification
    {
      expiresIn: process.env.JWT_EXPIRES_IN, // JWT token expiration period
    }
  );
};

// util function for create and send JWT token
const createSendJWT = (user, statusCode, res) => {
  // 1) CREATE the JWT TOKEN
  const token = signToken(user._id);

  // Define and send the cookie
  // Sending a cookie is basically attaching it to the response object.
  const cookieOptions = {
    expires: new Date(Date.now() + process.env.JWT_COOKIE_EXPIRES_IN * 24 * 60 * 60 * 1000), // coverting 90 days to ms
    secure: true, // the cookie will only be sent on an encrypted connection, basically HTTPS
    httpOnly: true, // so that the browser can only receive and send the cookie but cannot access or modify it in any way.
  };
  if (process.env.NODE_ENV === 'development') cookieOptions.secure = false; // because in dev we use http not https

  res.cookie('jwt', token, cookieOptions);

  // remove the password field from the output
  user.password = undefined;

  res.status(statusCode).json({
    status: 'success',
    // 2) SEND THE TOKEN TO THE CLIENT
    // Now the user's client should send this token in subsequent requests
    token,
    data: {
      user: user,
    },
  });
};

// HANDLER FOR SIGNUP
exports.signup = catchAsync(async (req, res, next) => {
  // Below line of code is a Security flaw. With this any user can tamper the input and pass 'role' as admin.
  // const newUser = await User.create(req.body);

  // We can fix the security flaw mentioned above with below piece of code.
  // But with this we can no longer create an admin user. But for that, we can open Compass and admin role manually
  const newUser = await User.create({
    name: req.body.name,
    email: req.body.email,
    password: req.body.password,
    passwordConfirm: req.body.passwordConfirm,
    role: req.body.role,
  });

  const url = `${req.protocol}://${req.get('host')}/me`; // e.g. http://localhost:3000/me

  // send welcome email
  await new Email(newUser, url).sendWelcome();

  // as soon as user is signed up, we usually login that user.
  createSendJWT(newUser, 201, res);
});

// HANDLER FOR LOGIN
exports.login = catchAsync(async (req, res, next) => {
  // const email = req.body.email;
  // const password = req.body.password;
  // below stmt is same as above 2 lines, but it also uses object destructuring to avoid mutation
  const { email, password } = req.body;

  // 1) check if email and password exists
  if (!email || !password) {
    return next(new AppError('Please provide email and password', 400));
  }
  // 2) check if user exists and password is valid
  // by default, 'password' is not fetched because we have set 'select= false' in the schema
  const user = await User.findOne({ email }).select('+password');

  // correctPassword is instance method defined in the userModel.js, so it is available to all documents of type User
  if (!user || !(await user.correctPassword(password, user.password))) {
    return next(new AppError('Incorrect Email or Password', 401));
  }

  // 3) If everything is ok, generate and send the JWT to client
  // This token will be passed by the user in subsequent requests.
  createSendJWT(user, 200, res);
});

/*
  Remember, we are using HTTP Only cookie, this means that we can not manipulate the cookie 
  in the browser in any way. Not even destroy/delete it.
  So if we want to keep using this super secure way of storing cookies,
  then how are we going to be able to actually log out users on our website?
  Because usually with JWT authentication we just delete the cookie or the token from local storage.
  But again, that's not possible when using it this way (HTTP Only => Super Secure Cookie). 

  And so what we're gonna do instead is to create a very simple log out route 
  that will simply send back a new cookie with the exact same name but without the token. 
  And so that will then override the current cookie that we have in the browser 
  with one that has the same name but no token. And so when that cookie is then sent along with the next request, 
  then we will not be able to identify the user as being logged in. 
  And so this will effectively then log out the user.
  And also were gonna give this cookie a very short expiration time. 
  And so this will effectively be a little bit like deleting the cookie but with a very clever workaround.
*/
// This is only needed if we are using HTTP Only cookie (Super Secure cookie)
exports.logout = (req, res) => {
  // use same name as token
  res.cookie('jwt', 'loggedout', {
    // 'loggedout' - dummy text for jwt token
    expires: new Date(Date.now() + 10 * 1000), // exipred in 10 seconds from now
    httpOnly: true,
    // no need to set 'secure' to true, bcz there is no sensitive data here
  });

  // send the response
  res.status(200).json({ status: 'success' });
};

// PROTECT ROUTES MIDDLEWARE
// complete route-protecting algorithm
// If user is not authenticated, we send an error. Othewise we grant access to the requested resource
// authenticating users based on tokens sent via cookies or via the authorization header.
exports.protect = catchAsync(async (req, res, next) => {
  // 1) get token and check if it exists
  // e.g. Autherization Header=> authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
  let token;
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  } else if (req.cookies.jwt) {
    // 2) if there was no token in the authorization header, then take a look at the cookies.
    token = req.cookies.jwt;
  }

  if (!token) {
    return next(new AppError('You are not logged in! Please login to get access.', 401));
  }

  // 2) Verification of the token - token expired? or token manipulated?
  // jwt.verify(token, process.env.JWT_SECRET);
  // promisifying the jwt.verify function in order to consistantly use our global error handling.
  // Otherwise we would have to use callback function provided by jwt.verify() method
  // if the verification is successful, we will get 'decoded' value,
  // else it will throw an error which will be caught in our global error handler
  const decoded = await util.promisify(jwt.verify)(token, process.env.JWT_SECRET);

  // 3) Check if user still exists
  // To handle cases for - what is user is deleted?
  const currentUser = await User.findById(decoded.id);
  if (!currentUser) {
    return next(new AppError('The user belonging to the token no longer exist.', 401));
  }

  // 4) Check if user changed password after token was issued.
  // To handle cases for - what if the user has changed password after the token was issued?
  if (currentUser.changedPasswordAfter(decoded.iat)) {
    // iat => issues at
    return next(new AppError('The user recently changed password! Please login again.', 401));
  }

  // 5) If all goes well above, then GRANT access to the protected route

  /*
    Set currentUser in the request so that we can then use this user in a next middleware function.
    Because remember, this request object is the one that travels from middleware to middleware.
    And so, if we want to pass data from one middleware to the next one, 
    then we can simply put some stuff on the request object, 
    and then that data will be available at a later point.
  */
  req.user = currentUser;
  // Now make that user accessible to the html template
  // when we add a variable to res.locals, we can directly use that in the pug template bcz pug has access to res.locals
  res.locals.user = currentUser; // this is used for /me route
  next();
});

// MIDDLEWARE to check if user is logged in.
// similar to protect middleware in this controller.
// This middleware is really only for rendered pages so there will never be an error in this middleware.
// if there is logged in user, we put the user in the response.locals so that it can be accessed in template
exports.isLoggedIn = async (req, res, next) => {
  let token;
  // For rendered pages, the jwt token will only be in cookie.
  // authorization header is only for the api, not for rendered pages.
  if (req.cookies.jwt) {
    token = req.cookies.jwt;

    try {
      // 1) Verification of the token - token expired? or token manipulated?
      // jwt.verify(token, process.env.JWT_SECRET);
      // promisifying the jwt.verify function in order to consistantly use our global error handling.
      // Otherwise we would have to use callback function provided by jwt.verify() method
      // if the verification is successful, we will get 'decoded' value,
      // else it will throw an error which will be caught in our global error handler
      const decoded = await util.promisify(jwt.verify)(token, process.env.JWT_SECRET);

      // 2) Check if user still exists
      // To handle cases for - what is user is deleted?
      const currentUser = await User.findById(decoded.id);
      if (!currentUser) {
        return next(); // no error since its from rendered page
      }

      // 3) Check if user changed password after token was issued.
      // To handle cases for - what if the user has changed password after the token was issued?
      if (currentUser.changedPasswordAfter(decoded.iat)) {
        // iat => issues at
        return next(); // no error since its from rendered page
      }

      // 4) If all goes well above, means there is a logged in user
      // Now make that user accessible to the html template
      // when we add a variable to res.locals, we can directly use that in the pug template bcz pug has access to res.locals
      res.locals.user = currentUser;
      return next();
    } catch (error) {
      // just catch, dont throw
      return next();
    }
  }
  return next();
};

// Authorization
/* 
    middleware to allow authorized access to perform certain actions
    e.g. only admin or lead-guide can delete a tour.
    This is kind of a different middleware because for this middleware we need to pass arguments.
    However we know that a middleware only accepts req, res and next arguments.
    So we have create a wrapper function by passing the arguments which we want (in this case roles)
    and return a normal middleware function. 
    The normal middleware function will have access to the 'roles' arg due to 'closure'.
*/
exports.restrictTo = (...roles) => {
  // roles is an array
  return (req, res, next) => {
    // 'roles' is an array and is accessible inside this function because of closure
    // in 'protect' middleware above, we store the authenticated user in 'req.user'
    if (!roles.includes(req.user.role)) {
      return next(new AppError('You do not have permission to perform this action!', 403));
    }

    next();
  };
};

// STEP 1: Forgot Password
// only receives the email and issues token (normal token, not jwt)
exports.forgotPassword = catchAsync(async (req, res, next) => {
  // 1) get user based on posted email
  const user = await User.findOne({ email: req.body.email });
  if (!user) {
    return next(new AppError('There is no user with that email address.', 404));
  }

  // 2) generate random token
  const resetToken = user.createPasswordResetToken();
  // save because we modified 2 fields in createPasswordResetToken fn, which must be saved in DB
  // validateBeforeSave: false, will deactivate all the validaters that we specified in our schema.
  await user.save({ validateBeforeSave: false });

  // 3) send it to user as email
  try {
    const resetURL = `${req.protocol}://${req.get(
      'host'
    )}/api/v1/users/resetPassword/${resetToken}`;
    // we are not using global error handling here because we have to do more stuff than just catching err
    await new Email(user, resetURL).sendPasswordReset();

    res.status(200).json({
      status: 'success',
      message: 'Token sent to your email!',
    });
  } catch (error) {
    console.log(error);
    // delete token and token expires time from database
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save({ validateBeforeSave: false });
    return next(new AppError('There was an error sending the email. Try again later!', 500));
  }
});

// STEP 2: Reset Password
// receives the email and the token
exports.resetPassword = catchAsync(async (req, res, next) => {
  // 1) get user based on the token
  // encrypt incoming token
  const hashedToken = crypto.createHash('sha256').update(req.params.token).digest('hex');
  const user = await User.findOne({
    passwordResetToken: hashedToken,
    passwordResetExpires: { $gt: Date.now() }, // passwordResetExpires should be valid
  });

  // 2) If the token has not expired and there is a user, set the new password
  if (!user) {
    return next(new AppError('Token is invalid or has expired!', 400));
  }
  user.password = req.body.password;
  user.passwordConfirm = req.body.passwordConfirm;
  user.passwordResetToken = undefined;
  user.passwordResetExpires = undefined;
  /*
    IMPORTANT:
    for everything related to passwords and to the user, we always use save, 
    because we always want to run all the validators
  */
  await user.save(); // with validation

  // 3) update the changedPasswordAt property for the current user.
  // 4) log the user in, send JWT
  createSendJWT(user, 200, res);
});

// To allow currently logged in user to change the password. (Not forget password)
exports.updatePassword = catchAsync(async (req, res, next) => {
  // as a security measure, we always need to ask for the current password before updating it.

  // 1) Get user from collection
  // user id will be present in the req.user, as we have stored it on authentication in this controller
  const user = await User.findById(req.user.id).select('+password');

  // 2) Check if posted password is correct
  if (!(await user.correctPassword(req.body.passwordCurrent, user.password))) {
    return next(new AppError('Your current password is wrong', 401));
  }

  // 3) If password is correct, update the password
  user.password = req.body.password;
  user.passwordConfirm = req.body.passwordConfirm;
  await user.save(); // with validation
  // here we cannot use User.findByIdAndRemove() bcz with that our password-passwordConfirm validation would not work.
  // And that's basically because 'this.password' used in passwordConfirm validation is not defined when we update using findByIdAndRemove,
  // because internally, behind the scenes, Mongoose does not really keep the current object in memory.
  // it's really important to keep in mind not to use update for anything related to passwords.

  // 4) log the user in, send jwt
  createSendJWT(user, 200, res);
});
