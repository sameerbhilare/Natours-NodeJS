/***************************************
 * ROUTE HANDLERS FOR users
 */
const multer = require('multer');
const sharp = require('sharp');
const User = require('../models/userModel');
const AppError = require('../utils/appError');
const catchAsync = require('../utils/catchAsync');
const factory = require('./handlerFactory');

// 1) CONFIGURING MULTER STORAGE - a complete definition of how we want to store our files, with the destination and the filename.
// here we want to store file into file system
// we could also choose to store the file in memory as a buffer,
// so that we could then use it later by other processes.
// A) WITHOUT IMAGE PROCESSING
/*
const multerStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    // to define the destination, we actually need to call that callback.
    cb(null, 'public/img/users');
  },
  filename: (req, file, cb) => {
    // we need to give files unique file names as they are going to be stored in same folder
    // e.g. user-userid-timestamp.file-extesion => will ensure uniqueness in all conditions
    const ext = file.mimetype.split('/')[1];
    cb(null, `user-${req.user.id}-${Date.now()}.${ext}`);
  },
}); */

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
/*
  upload.single('photo') - is a middleware that expects single uploaded file in the field 'photo'
  so this middleware will then take care of taking the file and basically copying it to the destination that we specified.
  Also, this middleware will put the file or at least some information about the file on the request object
*/
exports.uploadUserPhoto = upload.single('photo'); // 'phot' is html form field name

// IMAGE PROCESSING - RESIZING IMAGE
/*
  everywhere in our user interface we assume that the uploaded images are squares. 
  So that we can then display them as circles on UI. 
  And so this only works when they are squares, but in the real world users are rarely 
  going to be uploading images that are squares. 
  And so our job now is to actually resize images to make them squares.
*/
exports.resizeUserPhoto = catchAsync(async (req, res, next) => {
  // if there is no file upload, return and go to next middleware
  if (!req.file) return next();

  // we need to give files unique file names as they are going to be stored in same folder
  // e.g. user-userid-timestamp.file-extesion => will ensure uniqueness in all conditions
  // saving filename to res.file.filename because with in-memry storage filename is not stored in req.file.filename
  // but we want that for next middlewares
  req.file.filename = `user-${req.user.id}-${Date.now()}.jpeg`; // jpeg bcz below we are alweays converting to jpeg

  // perform image resizing, using sharp package
  /*
    when doing image processing right after uploading a file, 
    then it's always best to not even save the file to the disk, but instead save it to memory.
  */
  // reading in-memory file/image and resize to form a square so height = width - 500
  // returns promise, so we must wait before calling next()
  await sharp(req.file.buffer)
    .resize(500, 500) // default resize emthod is cover which means crop,
    .toFormat('jpeg') // convert to jpeg
    .jpeg({ quality: 90 }) // compress to 90%
    .toFile(`public/img/users/${req.file.filename}`);

  next();
});

// utility function to return field-value pairs from given object with only requested field names
const filterObj = (obj, ...allowedFields) => {
  const newObject = {};
  // Object.keys() is used to loop through the keys/fields in the object
  Object.keys(obj).forEach((el) => {
    // if the current field is one of the allowed fields,
    // then newObj with the field name of the current field should be equal to
    // whatever is in the object at the current element (field name).
    if (allowedFields.includes(el)) {
      newObject[el] = obj[el];
    }
  });

  return newObject;
};

// get logged in user's data
exports.getMe = (req, res, next) => {
  req.params.id = req.user.id;
  next();
};

// Allow user to update his/her own data
exports.updateMe = catchAsync(async (req, res, next) => {
  // 1) create error if user posts password data
  if (req.body.password || req.body.passwordConfirm) {
    return next(
      new AppError('This route is not for password updates. Please use /updateMyPassword', 400)
    );
  }

  // 2) filter out unwanted field names that are not allowed to be updated
  const filteredBody = filterObj(req.body, 'name', 'email');
  // storing 'photo' if present in the request.
  // req.file.filename will have filename as we defined while configuring in multerStorage above
  if (req.file) filteredBody.photo = req.file.filename;

  // 3) update user document
  const updatedUser = await User.findByIdAndUpdate(req.user.id, filteredBody, {
    new: true, // to send back updated user object
    runValidators: true,
  });

  res.status(200).json({
    status: 'success',
    user: updatedUser,
  });
});

// delete user
/*
  when a user decides to delete his account, we actually do not delete that document from the database.
  But instead we actually just set the account to inactive so that the user might at some point in the future 
  reactivate the account and also so that we still can basically access the account in the future.
*/
exports.deleteMe = catchAsync(async (req, res, next) => {
  await User.findByIdAndUpdate(req.user.id, { active: false });
  res.status(204).json({
    status: 'success',
    data: null,
  });
});

exports.createUser = (req, res, next) => {
  res.status(400).json({
    status: 'error',
    message: 'This route is not defined! Please use /signup instead.',
  });
};

// GET ALL USERS
exports.getAllUsers = factory.getAll(User);

// GET USER - Route Handler
exports.getUser = factory.getOne(User); // no populateOptions arg

// UPDATE USER - Route Handler
// Do NOT update PASSWORD with this.
exports.updateUser = factory.updateOne(User);

// DELETE USER - Route Handler
// Only admin can actually delete a user from DB. Normal user deleteMe will only set the active flag to false
exports.deleteUser = factory.deleteOne(User);
