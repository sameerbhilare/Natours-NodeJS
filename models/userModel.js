const crypto = require('crypto'); // built in node module
const mongoose = require('mongoose');
const validator = require('validator');
const bcrypt = require('bcryptjs');

// Define Schema for User
const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Please provide your name'],
  },
  email: {
    type: String,
    required: [true, 'Please provide your email'],
    unique: true,
    lowercase: true, // will transform the input into lowercase
    validate: [validator.isEmail, 'Please provide valid email.'], // validate email using 3rd party validator
  },
  // if the user wants to upload a photo, that will be stored somewhere in our file system
  // and the path to that photo will then be stored into this photo field.
  photo: {
    type: String,
    // when we create a new user, they will not have any photo in the beginning,
    // so for that we have a default image.
    default: 'default.jpg',
  },
  role: {
    type: String,
    enum: ['user', 'guide', 'lead-guide', 'admin'], // allowed values
    default: 'user',
  },
  password: {
    type: String,
    required: [true, 'Please provide your password'],
    minlength: [8, 'Please provide password at least 8 characters long'],
    select: false, // password should never be returned to the client even if it may be encrypted
  },
  passwordConfirm: {
    // this field is not saved in the database
    type: String,
    // required simply means that it's a required input,not that it's required to actually be persisted to the database.
    required: [true, 'Please provide your password'],
    validate: {
      // This only works on SAVE and CREATE
      validator: function (val) {
        // we cant use arrow function here, bcz we need to use 'this' keyword
        return val === this.password;
      },
      message: 'Password and Confirm Password are not the same',
    },
  },
  passwordChangedAt: Date, // to track password changed date
  passwordResetToken: String,
  passwordResetExpires: Date,
  active: {
    type: Boolean,
    default: true,
    select: false,
  },
});

// PASSWORD ENCRYPTION / HASHING
/*
    We will use PRE save middleware to do that.
    Now we actually only want to encrypt the password if the password field has actually been updated.
    So basically only when really the password is changed or also when it's created new.
    Because imagine the user is only updating the email. Then in that case, we do not want to encrypt the password again.
*/
userSchema.pre('save', async function (next) {
  // async bcz bcrypt.hash returns promise
  // 'this' refers to the current document
  // check if password is NOT modified, then simply return and call next middleware.
  if (!this.isModified('password')) return next();

  // Else encrypt the password, i.e. only if the password was modified.
  /*
    Now we are gonna do this encryption, or hashing, 
    using a very well-known and well-studied and very popular hashing algorithm called 'bcrypt'.
    This algorithm will first salt then hash our password in order to make it really strong 
    to protect it against bruteforce attacks. 
    Because bruteforce attacks could try to guess a certain passwords if it's not really strong encrypted.
  */
  // hash the password with the cost of 12
  // cost=12 => the higher this cost here, the more CPU intensive the process will be
  // and the better the password will be encrypted.
  this.password = await bcrypt.hash(this.password, 12);

  // delete 'passwordConfirm' bcz we only needed it for confirmation. It should not be saved in DB
  this.passwordConfirm = undefined;

  next();
});

// PRE save middleware
// We are using this middleware to save passwordChangedAt
// because this field should be saved automatically
userSchema.pre('save', function (next) {
  // is password is not changed or if this document is newly created, then do not save passwordChangedAt
  if (!this.isModified('password') || this.isNew) return next();

  /* IMPORTANT
     sometimes it happens that this token is created a bit before the changed password timestamp
     has actually been created. In such case, changedPasswordAfter instance method will fail.
     So for safer side subtract 1 second from current time while saving to passwordChangedAt.
     So putting this passwordChanged 1 second in the past, 
     will ensure that the token is always created after the password has been changed.
  */
  this.passwordChangedAt = Date.now() - 1000;
  next();
});

// QUERY MIDDLEWARE to filter out inactive/deleted users
userSchema.pre(/^find/, function (next) {
  // 'this' points to current query
  // active: { $ne: false } because active field is not set for all documents.
  this.find({ active: { $ne: false } });
  next();
});

// INSTANCE METHOD
// Instance method is a method that is going to be available on all documents of a certain collection.
userSchema.methods.correctPassword = async function (
  candidatePassword, // original password incoming in the request from user
  userPassword // encrypted pass. we have to pass this bcz we cannot use this.password as it is not returned bcz of 'select':false
) {
  // 'this' points to current document
  return await bcrypt.compare(candidatePassword, userPassword);
};

// INSTANCE METHOD
userSchema.methods.changedPasswordAfter = function (jwtTimestamp) {
  /*
        If passwordChangedAt exists, then we should compare.
        If passwordChangedAt does not exist, 
        then that means that the user has never actually changed the password.
    */
  if (this.passwordChangedAt) {
    // convert 'passwordChangedAt' Date into Timestamp
    const changedTimestamp = parseInt(this.passwordChangedAt.getTime() / 1000, 10); // base 10
    //console.log(changedTimestamp, jwtTimestamp);

    return jwtTimestamp < changedTimestamp;
  }

  // false means password not changed.
  return false;
};

// INSTANCE METHOD
userSchema.methods.createPasswordResetToken = function () {
  /*
     The password reset token should basically be a random string
     but at the same time, it doesn't need to be as cryptographically strong as the password hash.
     We can user built-in crypt module to generate random bytes
    */
  // create hex token
  const resetToken = crypto.randomBytes(32).toString('hex');
  // encrypt the token and store in database
  this.passwordResetToken = crypto.createHash('sha256').update(resetToken).digest('hex');
  // token valid for 10 mins
  this.passwordResetExpires = Date.now() + 10 * 60 * 1000;

  /* return the plain text token because that's the one that we will send through the email.
     We need to send the unencrypted reset token 
     because otherwise it wouldn't make much sense to encrypt it at all.
     If the token that was in the database was the exact same that we could use to actually change the password,
     then that wouldn't be any encryption at all. */
  return resetToken;
};

// Create Model from Schema. Model name should be Capitalized.
const User = mongoose.model('User', userSchema);

module.exports = User;
