const mongoose = require('mongoose');
const slugify = require('slugify');
//const validator = require('validator');

// define a Schema
/*
  We can pass schema type options to each field, of course if required, 
  otherwise we can keep it simple with just the type.
*/
const tourSchema = mongoose.Schema(
  {
    name: {
      // with scheme type options
      type: String,
      required: [true, 'A tour must have a name'], // error message in case of missing 'name'
      // above is shorthand for this
      /*
      required: {
        values: true, // [true]
        message: 'A tour must have a name',
      }, */
      unique: true, // this field 'name' should be unique
      trim: true, // will trim the string. 'trim' only works for String type
      maxlength: [40, 'A tour name can be maximum 40 characters long'],
      minlength: [10, 'A tour name must have at least 10 characters'],

      // using 3rd party custom validator function reference
      // validate: [validator.isAlpha, 'Tour name must only contain characters'], // isAlpha fails for space :)
      // another way
      /*
      validate: {
        validator: validator.isAlpha,
        message: 'Tour name must only contain characters',
      }, */
    },
    slug: String,
    duration: {
      type: Number,
      required: [true, 'A tour must have a duration'],
    },
    maxGroupSize: {
      type: Number,
      required: [true, 'A tour must have a Group Size'],
    },
    difficulty: {
      type: String,
      required: [true, 'A tour must have a difficulty'],
      //enum: ['easy', 'medium', 'difficult'], // without validation message
      enum: {
        values: ['easy', 'medium', 'difficult'],
        message: 'Difficulty can either be: easy, medium, difficult',
      },
    },
    ratingsAverage: {
      type: Number,
      default: 4.5, // default value for rating
      min: [1, 'Rating must be above or equal to 1.0'],
      max: [5, 'Rating must be below or equal to 5.0'],
      // this function will be run each time that a new value is set for this field.
      // setter receives current value as input
      /* e.g. Say val = 4.6666 
                  val * 10 = 46.666 
                  Math.round(val * 10) = 47 
                  Math.round(val * 10) / 10 = 4.7 */
      set: (val) => Math.round(val * 10) / 10,
    },
    ratingsQuantity: {
      type: Number,
      default: 0, // default value for rating
    },
    price: {
      // with scheme type options
      type: Number,
      required: [true, ' A tour must have a price'], // error message in case of missing 'price'
    },
    priceDiscount: {
      type: Number,
      validate: {
        validator: function (val) {
          // 'this' only points to current doc on NEW document creation. It does NOT work with update
          return val < this.price; // return false if 'priceDiscount' is less than actua 'price'
        },
        message: 'Discount Price ({VALUE}) should be less than Regular Price', // with ({VALUE}), we get access to the user provided value
      },
    },
    summary: {
      type: String,
      required: true,
      trim: true, // will trim the string. 'trim' only works for String type
    },
    description: {
      type: String,
    },
    imageCover: {
      // basically this will simply be the name ff the image,
      // which then later, we will be able to read from the file system.
      // that's a very common practice. Though we could store the entire image as well in a
      // database, but that's usually not a good idea.
      type: String,
      required: [true, ' A tour must have a cover image'],
    },
    images: [String], // array of strings
    createdAt: {
      // should basically be a timestamp that is set by the time that the user gets a new tour.
      type: Date,
      default: Date.now(), // current time
      select: false /* we can exclude fields right from the schema so that they won't be returned in the response.
                      That can be very useful, for example, when we have sensitive data 
                      that should only be used internally. For e.g. passwords */,
    },
    startDates: [Date], // different dates at which a tour starts.
    secretTour: {
      // if this is a secret tour. to be used internally or only for VIP clients
      type: Boolean,
      default: false,
    },
    ////////////// EMBEDDED DOCUMENT
    startLocation: {
      // MongoDB uses a special data format called GeoJSON, in order to specify geospatial data.
      // in order for this object (startLocation) to be recognized as geospatial JSON,
      // we need to provide the type and the coordinates properties.
      type: {
        type: String,
        default: 'Point', // default Geomery is 'Point'.
        enum: ['Point'],
      },
      coordinates: [Number], // array of points with longitude first then latitude
      address: String,
      description: String,
    },
    ////////////// EMBEDDED DOCUMENT
    // by specifying locations basically an array of objects,
    // this will then create brand new documents inside of the parent document (tour),
    locations: [
      {
        type: {
          type: String,
          default: 'Point',
          enum: ['Point'],
        },
        coordinates: [Number],
        address: String,
        description: String,
        day: Number,
      },
    ],
    ////////////// EMBEDDED DOCUMENT
    // guides: Array, // these will be embedded through pre save middleware
    ///////////// CHILD REFERENCING
    guides: [
      {
        // this means that we expect a type of each of the elements in the guides array to be a MongoDB ID.
        type: mongoose.Schema.ObjectId,
        //  this is how we establish references between different data sets in Mongoose.
        ref: 'User', // 'User' is the Model name that we have specified in userModel.js
      },
    ],
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

// INDEXES
// single field index
// tourSchema.index({ price: 1 }); // creating indexed on field 'price' with ascending order

// compound index
/*
  Compound index which we create also works when we query for just one of those fields 
  individually as well as together. So when we create a compound index, 
  we do not have to then create one individual for each of the fields as well.
*/
tourSchema.index({ price: 1, ratingsAverage: -1 }); // price - asc, ratingsAverage - desc
tourSchema.index({ slug: 1 }); // price - asc, ratingsAverage - desc
/*
  For GEOSPATIAL QUERY to work, we need to attribute an index to the field where the geospatial data
  that we're searching for is stored. e.g. here we need to index 'startLocation' field.
  For geospatial data, 
    this index needs to be a 2D sphere index if the data describes real points on the Earth like sphere.
    Or instead, we can also use a 2D index if we're using just fictional points on a simple 2D plane.
  In our case, we are talking about real points on the Earth's surface, so we're going to use 2dsphere.

  With 2dsphere, we're basically telling mongodb that this startLocation should be indexed to a 2D sphere.
  So an Earthlike sphere where all our data are located.
*/
tourSchema.index({ startLocation: '2dsphere' });

// creating virtual property - durationWeeks is not going to be persisted in the database,
// but it's only gonna be there as soon as we get the data.
// Note: we are not using arrow function, rather we are using a regular function.
// This is because we want to access the 'this' keyword which is not available in arrow function
tourSchema.virtual('durationWeeks').get(function () {
  return this.duration / 7; // get 'durationWeeks' from 'duration' property which is in months.
});

// VIRTUAL POPULATE
tourSchema.virtual('reviews', {
  ref: 'Review', // name of the parent referenced model
  foreignField: 'tour', // this is the name of the field in the 'Review' model
  localField: '_id', // where that ID is actually stored in this current Tour model.
});

// DOCUMENT MIDDLEWARE - PRE
// PRE DOCUMENT MIDDLEWARE has access to next method.
// the callback function will be called BEFORE an actual document is saved to the database.
// basically it runs ONLY for .save(), .create() commands (NOT for insertMany(), etc.)
tourSchema.pre('save', function (next) {
  // Since its a 'pre' hook, at this point of time,
  // we can still act on the data before it is then saved to the database.

  // 'this' point to the currently processed middleware (the document being saved)
  // so we can define properties onto it.
  // Make sure the properties are part of schema, otherwise those will be ignored.
  this.slug = slugify(this.name, { lower: true });

  // just like Express middleware, mongoose middleware also receives next() method reference,
  // which we should call at the end, so that it will call next middleware in the stack
  next();
});

// DOCUMENT MIDDLEWARE - POST
// POST DOCUMENT MIDDLEWARE has access to docuement that is saved and the next method.
// the callback function will be called AFTER an actual document is saved to the database.
// basically it runs ONLY for .save(), .create() commands (NOT for insertMany(), etc.)
tourSchema.post('save', function (doc, next) {
  // since post middleware is called after current document is already saved
  // so we dont have access to the 'this' keyword,
  // instead we can access the finished document which is passed to this callaback
  next();
});

// DOCUMENT MIDDLEWARE - PRE
// to embed User guides into the Tour.
// we can have multiple pre 'save' hooks or pre middlewares for 'save' event,
/*
tourSchema.pre('save', async function (next) {
  const guidesPromises = this.guides.map(async (id) => await User.findById(id));
  this.guides = await Promise.all(guidesPromises); // to run array of Promises at the same time
  next();
});*/

/*
// QUERY MIDDLEWARE - PRE 'findOne'
// PRE 'findOne' hook - runs for findOne(), but NOT for find()
tourSchema.pre('findOne', function (next) {
  // 'this' keyword will point to the current query being processed.
  // since 'this' is a Query object, we can add query methods onto it.
  this.find({ secretTour: { $ne: true } });
  next();
});

// QUERY MIDDLEWARE - PRE 'findOne'
// PRE 'find' hook - runs for find(), but NOT for findOne()
tourSchema.pre('find', function (next) {
  // 'this' keyword will point to the current query being processed.
  // since 'this' is a Query object, we can add query methods onto it.
  this.find({ secretTour: { $ne: true } });
  next();
});
*/

// QUERY MIDDLEWARE - PRE hook for methods starting with 'find' keyword
// PRE 'find' hook - runs for document method names starting with 'find'
// runs before the query can be executed
tourSchema.pre(/^find/, function (next) {
  // in JS, regular expression is always between / and /
  // 'this' keyword will point to the current query being processed.
  // since 'this' is a Query object, we can add query methods onto it.
  this.find({ secretTour: { $ne: true } });

  this.start = Date.now(); // to measure time required to run the query
  next();
});

// QUERY MIDDLEWARE - PRE hook for methods starting with 'find' keyword
// PRE 'find' hook - runs for document method names starting with 'find'
// to populate child referenced data e.g. 'guides'
tourSchema.pre(/^find/, function (next) {
  // 'this' keyword will point to the current query being processed.
  this.populate({
    path: 'guides',
    select: '-__v -passwordChangedAt', // to select only specific fields
  });

  next();
});

// QUERY MIDDLEWARE - POST hook for methods starting with 'find' keyword
// POST 'find' hook - runs for document method names starting with 'find'
// runs after the query has executed
/*
tourSchema.post(/^find/, function (docs, next) {
  console.log(`Query took ${Date.now() - this.start} ms.`);
  // 'docs' refers to all the documents that we returned from the query.
  //console.log(docs);
  next();
}); */

// AGGREGATION MIDDLEWARE
// to exclude the secret tour in the aggregation.
/*
tourSchema.pre('aggregate', function (next) {
  // 'this' points to the current aggregation object.
  //console.log(this.pipeline()); // simply an array which is passed to the aggregate function
  // now in order to filter out the secret tours all we have to do is
  // to add another match stage right at the beginning of this pipeline array
  this.pipeline().unshift({ $match: { secretTour: { $ne: true } } }); // unshift just adds element at the start of the array
  next();
});*/

// creating model from schema
// It's convention to always capitalize model names and its variables.
const Tour = mongoose.model('Tour', tourSchema);

module.exports = Tour;
