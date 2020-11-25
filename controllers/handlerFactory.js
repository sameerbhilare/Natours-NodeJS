// GOAL of this module is to create controller functions because irrespective of the resources (users, tours, reviews)
// these handler functions are doing exactly the same steps.

const APIFeatures = require('../utils/apiFeatures');
const AppError = require('../utils/appError');
const catchAsync = require('../utils/catchAsync');

// to delete tours, users, reviews, etc.
// This is basically generalization of sepcific functions like deleteTour, deleteUser, deleteReview, etc.
// generic function returning specific function
exports.deleteOne = (Model) =>
  catchAsync(async (req, res, next) => {
    // route handler
    const doc = await Model.findByIdAndDelete(req.params.id);

    if (!doc) {
      // 404 error handling
      return next(new AppError('No document found with that ID', 404));
    }

    // status is 204 which means No content.
    // the data is null, simply to show that the resource that we deleted now no longer exists.
    // It is a common practice not to send back any data to the client when there was a delete operation.
    res.status(204).send({
      status: 'success',
      data: null,
    });
  });

// to update tours, users, reviews, etc.
// This is basically generalization of sepcific functions like updateTour, updateUser, updateReview, etc.
// generic function returning specific function
exports.updateOne = (Model) =>
  catchAsync(async (req, res, next) => {
    const doc = await Model.findByIdAndUpdate(req.params.id, req.body, {
      new: true, // to return newly updated object instead of old object
      runValidators: true, // to run validation to check if to be saved data is valid
    });

    if (!doc) {
      // 404 error handling
      return next(new AppError('No document found with that ID', 404));
    }

    res.status(200).send({
      status: 'success',
      data: {
        data: doc,
      },
    });
  });

// to create tour, user, review, etc.
// This is basically generalization of sepcific functions like createTour, createUser, createReview, etc.
// generic function returning specific function
exports.createOne = (Model) =>
  catchAsync(async (req, res, next) => {
    const doc = await Model.create(req.body); // .create() returns a promise

    res.status(201).json({
      // 201 means Created
      status: 'success',
      data: {
        data: doc,
      },
    });
  });

// to get tour, user, review, etc.
// This is basically generalization of sepcific functions like getTour, getUser, getReview, etc.
// generic function returning specific function
exports.getOne = (Model, populateOptions) =>
  catchAsync(async (req, res, next) => {
    // route handler
    // find by Id
    let query = Model.findById(req.params.id);
    if (populateOptions) query = query.populate(populateOptions);

    const doc = await query;

    if (!doc) {
      // 404 error handling
      return next(new AppError('No document found with that ID', 404));
    }

    res.status(200).send({
      status: 'success',
      data: {
        data: doc, // ES6 shortform for writing 'tours: tours', i.e. when both key and value have same name
      },
    });
  });

// to get all tours, users, reviews, etc.
// This is basically generalization of sepcific functions like getAllTours, getAllUsers, getAllReviews, etc.
// generic function returning specific function
exports.getAll = (Model) =>
  catchAsync(async (req, res, next) => {
    // To allow for nested GET reviews on Tour
    // This is small HACK
    let filter = {};
    if (req.params.tourId) filter = { tour: req.params.tourId };

    // adding next function in arg, bcz catchAsync needs it to wrap err
    // Add API Features like filtering, sorting, projection, pagination
    const features = new APIFeatures(Model.find(filter), req.query)
      .filter()
      .sort()
      .limitFields()
      .paginate();

    // FINALLY execute Query
    //  const docs = await features.dbQuery.explain(); // to get query execution plan
    const docs = await features.dbQuery;

    // send response
    res.status(200).send({
      status: 'success',
      requestedAt: req.requestTime,
      results: docs.length, // so that client can get immediate idea about number of results. (Not part of Jsend).
      data: {
        data: docs, // ES6 shortform for writing 'tours: tours', i.e. when both key and value have same name
      },
    });
  });
