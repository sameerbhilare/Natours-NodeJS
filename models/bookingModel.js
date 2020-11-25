const mongoose = require('mongoose');

// schema for booking
const bookingSchema = new mongoose.Schema({
  // parent referencing
  tour: {
    type: mongoose.Schema.ObjectId,
    ref: 'Tour',
    required: [true, 'Booking must belong to a Tour!'],
  },
  // parent referencing
  user: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: [true, 'Booking must belong to a User!'],
  },
  // bcz price might change in the future
  price: {
    type: Number,
    required: [true, 'Booking must have a price'],
  },
  createdAt: {
    type: Date,
    default: Date.now(),
  },
  // could be used by admin to mark some of the cash payments as 'paid'
  paid: {
    type: Boolean,
    default: true,
  },
});

// QUERY MIDDLEWARE
// populate the tour and the user automatically whenever there is a query
bookingSchema.pre(/^find/, function (next) {
  this.populate('user').populate({
    path: 'tour',
    select: 'name',
  });

  next(); // imp
});

// create model
const Booking = mongoose.model('Booking', bookingSchema);

module.exports = Booking;
