const express = require('express');
const viewsController = require('../controllers/viewsController');
const authController = require('../controllers/authController');
const bookingController = require('../controllers/bookingController');

const router = express.Router();

// ROUTES
// no need to use router.route('/').get(viewsController.getOverview)
// because here for views, we will always be using GET
router.get(
  '/',
  bookingController.createBookingCheckout, // temporary until we have our websites deployed to a server
  authController.isLoggedIn,
  viewsController.getOverview
);
router.get('/tour/:tourSlug', authController.isLoggedIn, viewsController.getTour);
router.get('/login', authController.isLoggedIn, viewsController.getLoginForm);
router.get('/me', authController.protect, viewsController.getAccount);
router.get('/my-tours', authController.protect, viewsController.getMyTours);

// Updating User Data (Name, Email):  Way 1: By submiting form
/*
    Using this way of updating user data, if we get any server side error, 
    we need to handle that error with proper page for error message or a completely new error page.
    But that's a bit terrible, so this way of doing things is actually a bit worse for handling errors, 
    which is one of the reasons why we should prefer to update data using the API that we already created
    in order to update the user data, and in general to do this kind of stuff.
*/
router.post('/submit-user-data', authController.protect, viewsController.updateUserData);

module.exports = router;
