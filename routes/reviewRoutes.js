const express = require('express');
const reviewController = require('../controllers/reviewController');
const authController = require('../controllers/authController');

// IMP
/*
  With the setup in this file, both below routes will be handled
  POST /reviews   => this could be used by admins
  POST /tours/1234/reviews  => this is really it will be used
*/

// get router
/* 
  by default, each router only have access to the parameters of their specific routes.
  review router by default doesn't get access to tourId parameter.
  to enable this, we need to set mergeParams to true.
  e.g. POST /tours/1234/reviews
  So now with mergeParams: true, we can access the tourId which is 1234 here
*/
const router = express.Router({ mergeParams: true });

/************************************************************************* */
// middleware - which will basically protect all routes coming AFTER THIS POINT
router.use(authController.protect);

// defined routes and their handlers
router
  .route('/')
  .get(reviewController.getAllReviews)
  .post(
    authController.restrictTo('user'),
    reviewController.setTourUserIds,
    reviewController.createReview
  );

router
  .route('/:id')
  .get(reviewController.getReview)
  .patch(authController.restrictTo('user', 'admin'), reviewController.updateReview)
  .delete(authController.restrictTo('user', 'admin'), reviewController.deleteReview);

// export reviews router
module.exports = router;
