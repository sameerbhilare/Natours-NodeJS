const mongoose = require('mongoose');
const Tour = require('../models/tourModel');

// DEFINE SCHEMA
const reviewSchema = new mongoose.Schema(
  {
    review: {
      type: String,
      required: [true, 'Review cannnot be empty.'],
    },
    rating: {
      type: Number,
      min: 1,
      max: 5,
    },
    createdAt: {
      type: Date,
      default: Date.now(),
    },
    tour: {
      type: mongoose.Schema.ObjectId,
      ref: 'Tour',
      required: [true, 'Review must belong to a tour.'],
    },
    user: {
      type: mongoose.Schema.ObjectId,
      ref: 'User',
      required: [true, 'Review must belong to a user.'],
    },
  },
  {
    // using virtual propertie
    // means each time that the data is actually outputted as JSON,
    // we basically want the virtuals to be part of the output.
    toJSON: { virtuals: true },
    // basicall when data gets outputed as an object
    toObject: { virtuals: true },
  }
);

// AVOIDING DUPLICATE REVIEWS
// duplicate review happens when there is a review with the same user and the same tour ID.
// so the combination of user and tour should be always unique.
reviewSchema.index({ tour: 1, user: 1 }, { unique: true });

// QUERY MIDDLEWARE - PRE hook for methods starting with 'find' keyword
// PRE 'find' hook - runs for document method names starting with 'find'
// to populate parent referenced data e.g. 'tour', 'user'
reviewSchema.pre(/^find/, function (next) {
  // 'this' keyword will point to the current query being processed.
  this.populate({
    path: 'user', // 'user' - name matches the name in reviewSchema
    select: 'name photo', // to select only specific fields
  });

  // PROBLEM: Inefficient CHAIN OF POPULATES
  // Note: we are not populating 'tour' because from UI, we are going to get reviews as of of gettting a tour
  // so it does not make sense to populate 'tour' inside a review because its not going to called standalone
  // in other words, reviews will always be part of response to getting a single tour.

  /*
  this.populate({
    path: 'user', // 'user' - name matches the name in reviewSchema
    select: 'name photo', // to select only specific fields
  }).populate({
    path: 'tour', // 'tour' - name matches the name in reviewSchema
    select: 'name',
  }); */

  next();
});

// STATIC FUNCTION
// DOCUMENT MIDDLEWARE
// to calculate Average ratings
// We are using static function because we want to call 'aggregate' function on the model
reviewSchema.statics.calcAverageRatings = async function (tourId) {
  // In a static method, 'this' points to the current Model
  // 1) calculate statistics
  const stats = await this.aggregate([
    {
      $match: { tour: tourId },
    },
    {
      $group: {
        _id: '$tour', // to group by 'tour'
        nRating: { $sum: 1 }, // if there are 5 review documents for the current tour then for each of these documents one will get added.
        avgRating: { $avg: '$rating' },
      },
    },
  ]);

  console.log(stats);

  // 2) save statistics to the corresponding tour
  // It is very handy yo have these properties (ratingsQuantity, ratingsAverage) directly on the tour.
  // This helps a lot as we are calculating the stats when a review is created
  // instead ofdoing the calculations when a tour summary is requested
  if (stats.length > 0) {
    await Tour.findByIdAndUpdate(tourId, {
      ratingsQuantity: stats[0].nRating,
      ratingsAverage: stats[0].avgRating,
    });
  } else {
    // set to default
    await Tour.findByIdAndUpdate(tourId, {
      ratingsQuantity: 0,
      ratingsAverage: 4.5,
    });
  }
};

/********************************************************************************* */
// CALCULATE AVG RATING - in case of UPDATE and DELETE

// 1) GET required DATA from PRE middleware and pass it to POST middleware
// PRE QUERY MIDDLEWARE
// applicable for findOneAndUpdate, findOneAndDelete
//  - since we are using these functions for update and delete resp. (See handlerFactory.js)
reviewSchema.pre(/^findOneAnd/, async function (next) {
  // 'this' points to currently executing query.
  // Remember in query middleware we don't get access to the current document.
  // so we need to soemhow retrieve the document
  // TRICK: current qry will be executed and document will be returned
  this.r = await this.findOne();

  // BIG PROBLEM
  /*
    This is a PRE query middleware, so we don't have access to latest persisted data (since it's pre).
    Also we cannot user POST query middleware, because we will then won't have access 
    to the currently executing query (as it is already executed) and hence won't have access to the 'tour'. 
    But in order to calculate avg rating, we need both the 'tour' and the 'latest persisted data'.
    So how can we do it ?
    The solution is to pass the data ('tour') from 'pre' to 'post' query middleware
    by saving the fetched review ('r') into the 'this' variable.
  */
});

// 1) GET required DATA from PRE middleware and pass it to POST middleware
reviewSchema.post(/^findOneAnd/, async function (next) {
  // this.findOne() does not work here because the query is already executed.
  // We need to call static methods directly on the Model. e.g. Review.calcAverageRatings(this.tour)
  await this.r.constructor.calcAverageRatings(this.r.tour);
});
/********************************************************************************* */

// POST SAVE MIDDLEWARE -
// We will calculate the Average Rating, each time AFTER a new review is created.
reviewSchema.post('save', function () {
  // 'this' points to current review
  /*
    We need to call static methods directly on the Model. e.g. Review.calcAverageRatings(this.tour)
    However here it will NOT work because, 'Review' model is defined AFTER this point, 
    hence Review is not available here. Also we moving this pre save middleware after creating the Review Model
    will NOT work because reviewSchema will then won't have this pre save middleware.
    So solution is to use - this.construtor.
    Since 'this' points to the current review, this.constructor points to Review Model
  */
  this.constructor.calcAverageRatings(this.tour);
});

// CREATE MODEL
const Review = mongoose.model('Review', reviewSchema);

module.exports = Review;
