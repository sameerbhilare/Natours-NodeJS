const express = require('express');
const tourController = require('../controllers/tourController');
const authController = require('../controllers/authController');
const reviewRouter = require('../routes/reviewRoutes');
const { route } = require('../routes/reviewRoutes');

const router = express.Router(); // kind of sub-application

// NESTED ROUTES
// tour router should use the review router in case it ever encounters a route like this.
router.use('/:tourId/reviews', reviewRouter); // mounting a router

/*
param middleware is middleware that only runs for certain parameters, so basically,
when we have a certain parameter in our URL.
In a param middleware function, we actually get access to a fourth argument 
and that one is the value of the parameter in question.
The philosophy of express, where we should always work with the middleware stack,
so with this pipeline as much as we can, 
*/
//router.param('id', tourController.checkID);

// ALIASING
/* Aliasing an API is to provide an alias route to a request that might be very popular, 
   so it might be requested all the time. 
   e.g. we might want to provide a route specifically for the five best cheap tours.
   so user would use an URL something like this - /api/v1/tours/top-5-cheap
   Solution => 
   Now we as a developer know that to get top 5 cheap and best tours, 
   we would need these query params -> limit=5 AND sort=price,-ratingsAverage
   So we should write a middleware for this new route (top-5-cheap) which would add limit and sort
*/
router.route('/top-5-cheap').get(tourController.aliasTopCheapTours, tourController.getAllTours);

// aggregation route to get tours statistics
router.route('/tours-stats').get(tourController.getToursStats);

// aggregation route to get tours statistics grouped by field difficulty
router.route('/tours-stats-by-difficulty').get(tourController.getToursStatsGroupedByDifficulty);

// aggregation route to get monthly plan for given year
router
  .route('/monthly-plan/:year')
  .get(
    authController.protect,
    authController.restrictTo('admin', 'lead-guide', 'guide'),
    tourController.getMonthlyPlan
  );

/*
    E.g. /tours-within/250/center/34.055604,-118.249883/unit/mi
    This means we want to find of tours within 250 miles of current point (34.055604,-118.249883)
*/
router
  .route('/tours-within/:distance/center/:latlng/unit/:unit')
  .get(tourController.getToursWithin);

// Get distances to all the tours from a certain point.
router.route('/distances/:latlng/unit/:unit').get(tourController.getDistances);

router
  .route('/')
  .get(tourController.getAllTours) // no auth, bcz this API should be exposed to all
  //.post(tourController.checkBody, tourController.createTour);
  .post(
    authController.protect,
    authController.restrictTo('admin', 'lead-guide'), // only authorized users can CREATE, UPDATE, DELETE
    tourController.createTour
  );
router
  .route('/:id')
  .get(tourController.getTour)
  .patch(
    authController.protect,
    authController.restrictTo('admin', 'lead-guide'),
    tourController.uploadTourImages, // upload tour images middleware
    tourController.resizeTourImages, // resize tour images middleware
    tourController.updateTour
  )
  .delete(
    authController.protect,
    authController.restrictTo('admin', 'lead-guide'),
    tourController.deleteTour
  );

// export single object - router
module.exports = router;
