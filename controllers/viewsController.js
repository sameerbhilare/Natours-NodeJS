const Tour = require('../models/tourModel');
const User = require('../models/userModel');
const Booking = require('../models/bookingModel');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');

exports.alerts = (req, res, next) => {
  const { alert } = req.query;

  if (alert === 'booking') {
    // 'booking' is passed from stripe success url in bookingController
    /*
      Stripe does very specifically say in their documentation that 
      sometimes the webhook is called a little bit after the success URL is called.
      In that case, that success URL would then show all of the current tours, but only after that,
      the webhook would be called and the tour would be created in our database. 
      Therefore, the new booking would not show up right away on the My Bookings page.
      But of course, everything still worked well in that case. 
      And so, I simply reload, but later we'll fix that problem.
    */
    res.locals.alert =
      "Your booking was successful! Please check your email for confirmation. If your booking doesn't show up immediately, pelase come back later.";

    next();
  }
};

exports.getOverview = catchAsync(async (req, res, next) => {
  // 1) Get all tours data from our collection
  const tours = await Tour.find();

  // 2) Build template - created overview.pug
  // 3) Render the template from the tour data step 1
  // 'overview' is the name of the pug template file ./views/overview.pug
  res.status(200).render('overview', {
    title: 'All Tours',
    tours,
  });
});

exports.getTour = catchAsync(async (req, res, next) => {
  // 1) Get the data for the requested tour (including reviews and guides);
  const tour = await Tour.findOne({ slug: req.params.tourSlug }).populate({
    path: 'reviews',
    fields: 'review rating user',
  });

  if (!tour) {
    return next(new AppError('There is no tour with that name', 404));
  }

  // 2) Build the template
  // 3) Render the template from the tour data step 1
  // 'tour' is the name of the pug template file ./views/tour.pug
  res.status(200).render('tour', {
    title: `${tour.name} Tour`,
    tour,
  });
});

// ROUTE HANDLER FOR LOGIN
exports.getLoginForm = (req, res) => {
  // 2) Build template
  // 3) Render the template
  res.status(200).render('login', {
    title: 'Log into your account',
  });
};

// ROUTE HANDLER FOR ACCOUNTS
exports.getAccount = (req, res) => {
  // just render the user page, We don't even need to query for the current user
  // because that has already been done in the protect middleware
  res.status(200).render('account', {
    title: 'Your Account',
  });
};

// ROUTE HANDLER FOR getting bookings
exports.getMyTours = catchAsync(async (req, res, next) => {
  // 1) find all bookings for current user
  const bookings = await Booking.find({ user: req.user.id });

  // 2) find tours for bookings
  const tourIds = bookings.map((el) => el.tour);
  const tours = await Tour.find({ _id: { $in: tourIds } }); // in operator return multiple results

  // using existing 'overview' template to show only user's tours
  res.status(200).render('overview', {
    title: 'My Tours',
    tours,
  });
});

// ROUTE HANDLER FOR Updating user data
// Updating User Data (Name, Email):  Way 1: By submiting form
exports.updateUserData = catchAsync(async (req, res, next) => {
  const updatedUser = await User.findByIdAndUpdate(
    req.user.id,
    {
      // to update only name and email
      name: req.body.name,
      email: req.body.email,
    },
    {
      new: true,
      runValidators: true,
    }
  );

  res.status(200).render('account', {
    title: 'Your Account',
    user: updatedUser, // we need to pass updated user, otherwise the one from protect middleware will be used, which in this case has old data
  });
});
