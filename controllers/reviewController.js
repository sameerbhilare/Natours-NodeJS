const Review = require('../models/reviewModel');
//const catchAsync = require('../utils/catchAsync');
//const AppError = require('../utils/appError');
const factory = require('../controllers/handlerFactory');

exports.setTourUserIds = (req, res, next) => {
  // nested routes
  // with this - the user can still specify manually the tour and the user ID.
  if (!req.body.tour) req.body.tour = req.params.tourId;
  if (!req.body.user) req.body.user = req.user.id; // 'req.user' is set in the authController.protect

  next();
};

/************************************************************ */
// ROUTE HANDLER FOR getAllReviews
// with GET /reviews => will return all reviews for all tours
// with GET /tours/1234/reviews => will return all reviews for given tour (1234)
exports.getAllReviews = factory.getAll(Review);

// GET ROUTE HANDLER for Review
exports.getReview = factory.getOne(Review);

// ROUTE HANDLER FOR Creating a Review
exports.createReview = factory.createOne(Review);

// DELETE ROUTE HANDLER - to delete a review
exports.deleteReview = factory.deleteOne(Review);

// UPDATE ROUTE HANDLER - to update a review
exports.updateReview = factory.updateOne(Review);
