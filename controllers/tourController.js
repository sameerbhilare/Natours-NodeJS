const multer = require('multer');
const sharp = require('sharp');
const Tour = require('../models/tourModel');
//const APIFeatures = require('../utils/apiFeatures');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const factory = require('./handlerFactory');

// B) WITH IMAGE PROCESSING
// in memory multer storage, with this the file/image will be stored as a buffer (req.file.buffer)
const multerStorage = multer.memoryStorage();

// 2) CREATING MULTER FILTER
const multerFilter = (req, file, cb) => {
  /* 
    The goal is basically to test if the uploaded file is an image.
    And if it is so, then we pass true into the callback function,
    and if it's not we pass false into the callback function,along with an error.
    Because again, we do not want to allow files to be uploaded that are not images.
  */
  if (file.mimetype.startsWith('image')) {
    cb(null, true);
  } else {
    cb(new AppError('Not an image. Please upload only images', 400), false);
  }
};

// 3) configure multer, with the storage and filter
// Side Note:
// images are not directly uploaded into the database, we just upload them into our file system
// and then in the database, we put a link basically to that image.
const upload = multer({
  storage: multerStorage,
  fileFilter: multerFilter,
});

// 4) FILE UPLOAD MIDDLEWARE
// a) when we have only one field 'photo' with single file
//upload.single('photo'); // file available at req.file

// b) when we had only 'images' so only one field with multiple files
//upload.array('images', 3); // files available at req.files

// c) when we have mix of single and multiple files, files available at req.files
exports.uploadTourImages = upload.fields([
  { name: 'imageCover', maxCount: 1 }, //for imagecover, we need only one image
  { name: 'images', maxCount: 3 }, // for tour images, we can add at max 3 images
]);

// if we have multiple files, those are available at req.files
exports.resizeTourImages = catchAsync(async (req, res, next) => {
  // console.log(req.files);

  // if no images, then go to next middleware
  if (!req.files || !req.files.imageCover || !req.files.images) return next();

  // 1) process cover image
  // put the image cover file name on body, as the updateTour middleware saves evrything from req.body
  req.body.imageCover = `tour-${req.params.id}-${Date.now()}-cover.jpeg`;

  // reading in-memory file/image and resize in 2:3 ratio
  // returns promise, so we must wait before calling next()
  await sharp(req.files.imageCover[0].buffer)
    .resize(2000, 1333) // default resize emthod is cover which means crop, 2:3 ratio
    .toFormat('jpeg') // convert to jpeg
    .jpeg({ quality: 90 }) // compress to 90%
    .toFile(`public/img/tours/${req.body.imageCover}`);

  // 2) process tour images in loop
  // put the image file names on body, as the updateTour middleware saves evrything from req.body
  req.body.images = [];
  /*
    IMPORTANT PROBLEM
    We cannot use req.files.images.forEach() here bcz of below problem - 
    with forEach, we're actually not using async await correctly in this case,
    And that's because this async await inside forEach is only inside of one callback function 
    of the foreach loop. And so that will actually not stop the code from moving right next to next line 
    where we then call the next() middleware.
    So again, right now we are actually not awaiting, because async await happens inside of the 
    callback function of one of these loop methods. 

    SOLUTION:
    But there is fortunately a solution for this, because since we have an async callback function,
    it will return a new promise. And so if we do a map, 
    we can then actually save an array of all of these promises. 
    And then if we have an array we can use promise.all to await all of them.
    And so with that we will then actually await until all the callback code (until all the image processing) is done,
    and only then move on to the next line, which is calling the next middleware to really update the tour documents.
    And if we didn't do that in this case, it would really not work at all, 
    because without this pushing here, the request.body.images would still be empty when we call next().
  */
  await Promise.all(
    req.files.images.map(async (file, i) => {
      const filename = `tour-${req.params.id}-${Date.now()}-${i + 1}.jpeg`;
      // reading in-memory file/image and resize in 2:3 ratio
      // returns promise, so we must wait before calling next()
      await sharp(file.buffer)
        .resize(2000, 1333) // default resize emthod is cover which means crop, 2:3 ratio
        .toFormat('jpeg') // convert to jpeg
        .jpeg({ quality: 90 }) // compress to 90%
        .toFile(`public/img/tours/${filename}`);

      req.body.images.push(filename);
    })
  );

  //console.log(req.body);

  next();
});

// we can use synchronous version because this code is top level code, runs outside event loop.
// used for testing with json file as a source of data
// const tours = JSON.parse(
//   fs.readFileSync(`${__dirname}/../dev-data/data/tours-simple.json`, 'utf-8')
// );

// param middleware for 'id' param for tours
// exports.checkID = (req, res, next, val) => {
//   console.log(`Received ID as ${val}`);
//   const id = req.params.id * 1; // trick to convert string to a number
//   const tour = tours.find((el) => el.id === id);
//   if (!tour) {
//     return res.status(404).json({
//       status: 'fail',
//       message: 'Invalid ID',
//     });
//   }
//   next(); // imp
// };

// middleware function to check if body contains name and price
// exports.checkBody = (req, res, next) => {
//   if (!req.body.name || !req.body.price) {
//     return res.status(400).json({
//       status: 'fail',
//       message: 'Missing Name or Price',
//     });
//   }
//   next(); // imp
// };

// middleware to be used to fill in request query parameters in case of aliasing routes
/*
  Now we as a developer know that to get top 5 cheap and best tours, 
  we would need these query params -> limit=5 AND sort=price,-ratingsAverage
  This middleware does extactly that. It will add limit and sort to the query params.
*/
exports.aliasTopCheapTours = (req, res, next) => {
  req.query.limit = '5';
  req.query.sort = 'price,-ratingsAverage';
  req.query.fields = 'name,price,ratingsAverage,difficulty,summary';
  next();
};

/****************************************************
 * ROUTE HANDLERS
 */
// routing means basically to determine how an application responds
// to a certain client request, to a certain URL and also the http method.

/******************************************
 * API Version 1: GET Tours
 * Using JSend standard (using status and data).
 */
exports.getAllTours = factory.getAll(Tour);

/******************************************
 * API Version 1: GET a Single Tour
 * Using JSend standard (using status and data).
 *
 * To pass paramters to our URL, we need to use ':<param_name>' in the url.
 * All such paramters mentioned in the URL are mandatory and if not received in the incoming request,
 * then this route will NOT be matched.
 * We can mark a parameter as optional by putting a question mark for that parameter. e.g. :variable?
 * Also we can pass multiple parameters in an URL.
 * e.g. /api/v1/tours/:id/:x/:y?
 * Here id and x parameters are mandatory, y parameter is optional
 */
exports.getTour = factory.getOne(Tour, { path: 'reviews' });

/* OLD
exports.getTour = catchAsync(async (req, res, next) => {
  // route handler
  // find by Id
  const tour = await Tour.findById(req.params.id).populate('reviews');

  // find by Id and populate child references
  // const tour = await Tour.findById(req.params.id).populate({
  //   path: 'guides',
  //   select: '-__v -passwordChangedAt', // to select only specific fields
  // });

  // Tour.findOne({ _id: req.params.id });

  if (!tour) {
    // 404 error handling
    return next(new AppError('No tour found with that ID', 404));
  }

  res.status(200).send({
    status: 'success',
    data: {
      tour, // ES6 shortform for writing 'tours: tours', i.e. when both key and value have same name
    },
  });
}); */

// API Version 1: POST Create a New Tour
// Using JSend standard (using status and data).
exports.createTour = factory.createOne(Tour);

// API Version 1: PATCH: Update a Single Tour
exports.updateTour = factory.updateOne(Tour);

// DELETE: Delting a Single Tour
exports.deleteTour = factory.deleteOne(Tour);

// AGGREGATIONS - get OVERALL (for all tours) stats
exports.getToursStats = catchAsync(async (req, res, next) => {
  // Aggregation pipeline
  const stats = await Tour.aggregate([
    {
      // match pipeline
      $match: { _id: { $ne: null } }, // matches all tours so that aggregate will be calculated on all data
    },
    {
      // grouping pipeline
      $group: {
        // first arg is always '_id' which specifies what we want to group by.
        // 'null' because we want to have everything in one group so that we can calculate the statistics for all of the tours together
        _id: null,
        // basically for each of the document that's gonna go through this pipeline, one will be added to this num counter.
        numTours: { $sum: 1 },
        numRatings: { $sum: '$ratingsQuantity' },
        avgRating: { $avg: '$ratingsAverage' },
        avgPrice: { $avg: '$price' },
        minPrice: { $min: '$price' },
        maxPrice: { $max: '$price' },
      },
    },
    {
      // sort pipeline
      $sort: { avgPrice: 1 },
    },
  ]);

  // send response
  res.status(200).send({
    status: 'success',
    data: {
      stats,
    },
  });
});

// AGGREGATIONS - get tours stats grouped by difficulty
exports.getToursStatsGroupedByDifficulty = catchAsync(async (req, res, next) => {
  // Aggregation pipeline
  const stats = await Tour.aggregate([
    {
      // match pipeline
      $match: { _id: { $ne: null } }, // matches all tours so that aggregate will be calculated on all data
    },
    {
      // grouping pipeline
      $group: {
        // first arg is always '_id' which specifies what we want to group by.
        // 'null' because we want to have everything in one group so that we can calculate the statistics for all of the tours together
        _id: { $toUpper: '$difficulty' },
        // basically for each of the document that's gonna go through this pipeline, one will be added to this num counter.
        numTours: { $sum: 1 },
        numRatings: { $sum: '$ratingsQuantity' },
        avgRating: { $avg: '$ratingsAverage' },
        avgPrice: { $avg: '$price' },
        minPrice: { $min: '$price' },
        maxPrice: { $max: '$price' },
      },
    },
    {
      // sort pipeline
      $sort: { avgPrice: 1 },
    },
    // we can add multiple stages, also we can repeat stages
    // {
    //   $match: { _id: { $ne: 'EASY' } },
    // },
  ]);

  // send response
  res.status(200).send({
    status: 'success',
    data: {
      stats,
    },
  });
});

// AGGREGATION PIPELINE
/* to implement a function to calculate the busiest month of a given year.
   So basically by calculating how many tours start in each of the month of the given year. */
exports.getMonthlyPlan = catchAsync(async (req, res, next) => {
  const year = req.params.year * 1;

  // Aggregation pipeline
  /*
      if you want to add all of this together the easiest way would basically be 
      to have one tour for each of these dates in 'startDates'.
      And we can actually do that using the aggregation pipeline. 
      There is a stage for doing exactly that, called unwind.

      TEST RESULTS BY REMOVING EACH STAGE TO SEE HOW IT WORKS
    */
  const plan = await Tour.aggregate([
    {
      // unwind - basically deconstructs an array field from the input documents
      // and then outputs one document for each element of the array.
      // i.e. basically we want to have one tour for each of these dates in the array.
      // There are total 9 tours and each tour has 3 dates in the startDates array.
      // so with unwind operator, we will get 9 * 3 = 27 results
      $unwind: '$startDates',
    },
    {
      // add input filtering criteria
      $match: {
        startDates: {
          // basically we want to get dates for given year e.g. between 01.01.2021 to 31.12.2021
          $gte: new Date(`${year}-01-01`), // yyyy-mm-dd format
          $lte: new Date(`${year}-12-31`), // yyyy-mm-dd format
        },
      },
    },
    {
      $group: {
        // we need to specify the ID field basically to say what we want to use to group our documents.
        _id: { $month: '$startDates' }, // group by month; special 'Aggregation Pipeline Operator' to get month from given date
        numToursStart: { $sum: 1 }, // to get number of tours in each month. so adding 1
        tours: { $push: '$name' }, // to get tour namesm so an array; $push gives that array
      },
    },
    {
      $addFields: { month: '$_id' },
    },
    {
      $project: {
        _id: 0,
      },
    },
    {
      $sort: { numToursStart: -1 }, // descending by busiest month of the year
    },
    // {
    //   // limit stage
    //   $limit: 12, // to have only 12 documents
    // },
  ]);

  // send response
  res.status(200).send({
    status: 'success',
    data: {
      plan,
    },
  });
});

// HANDLER FOR GEOSPATIAL SEARCH
/*
    E.g. /tours-within/250/center/34.055604,-118.249883/unit/mi
    This means we want to find of tours within 250 miles of current point (-40, 45)
*/
exports.getToursWithin = catchAsync(async (req, res, next) => {
  const { distance, latlng, unit } = req.params; // destructuring
  const [lat, lng] = latlng.split(','); // destructuring
  //console.log({ distance, latlng, unit, lat, lng });

  // to get the radius in unit radians, we need to divide our distance by the radius of the earth.
  // Radius of earth in miles => 3963.2 miles
  // Radius of earth in kms => 6378.1 kms
  const radius = unit === 'mi' ? distance / 3963.2 : distance / 6378.1;

  if (!lat || !lng) {
    return next(new AppError('Please provide latitude and longitude in the format  lag,lng', 400));
  }

  // GEOSPATIAL QUERY
  // $geowithin => it finds documents within a certain geometry.
  // And that geometry is what we need to define as a next step
  // generally it's the sphere that starts at the defined point within the defined radius.
  // mongodb expects the radius in a special unit called radian
  // Also we need to attribute an index to the field where the geospatial data
  // that we're searching for is stored. e.g. here we need to index 'startLocation' field.
  const tours = await Tour.find({
    startLocation: { $geoWithin: { $centerSphere: [[lng, lat], radius] } },
  });

  res.status(200).json({
    status: 'success',
    results: tours.length,
    data: {
      data: tours,
    },
  });
});

//use geospatial aggregation, in order to calculate distances to all the tours from a certain point.
exports.getDistances = catchAsync(async (req, res, next) => {
  const { latlng, unit } = req.params; // destructuring
  const [lat, lng] = latlng.split(','); // destructuring
  //console.log({ distance, latlng, unit, lat, lng });

  // if miles, multiplier is for getting miles, else for kms
  const multiplier = unit === 'mi' ? 0.000621371 : 0.001;

  if (!lat || !lng) {
    return next(new AppError('Please provide latitude and longitude in the format  lag,lng', 400));
  }

  // in order to do calculations we always use the aggregation pipeline.
  // for geospatial aggregation, there's actually only one single stage called geoNear
  const distances = await Tour.aggregate([
    {
      /* geoNear always needs to be the first stage.
         geoNear requires that at least one of our fields contains a geospatial index.
         If there's only one field with a geospatial index. 
         then geoNear stage will automatically use that index in order to perform the calculation.
         But if you have multiple fields with geospatial indexes, 
         then you need to use the keys parameter in order to define the field that you want to use for calculations.
      */
      $geoNear: {
        // near is the point from which to calculate the distances.
        // since we have only one geospatial index (on startLocation), calculations will be made on startLocation
        near: {
          // GeoJSON
          type: 'Point',
          coordinates: [lng * 1, lat * 1], // multiple by 1 to convert them into Numbers
        },
        // distanceField is the name of the field that will be created and where all the calculated distances will be stored.
        distanceField: 'distance', // gets distance in meters by default
        distanceMultiplier: multiplier, // converting the distance from meters to kms
      },
    },
    {
      $project: {
        distance: 1,
        name: 1,
      },
    },
  ]);

  res.status(200).json({
    status: 'success',
    data: {
      data: distances,
    },
  });
});
