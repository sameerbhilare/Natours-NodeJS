const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const Tour = require('../models/tourModel');
const Booking = require('../models/bookingModel');
const catchAsync = require('../utils/catchAsync');
const factory = require('./handlerFactory');

// ROUTE HANDLER for checkout session
exports.getCheckoutSession = catchAsync(async (req, res, next) => {
  // 1) Get currently booked store
  // so that we can then store a bunch of details about the tour in the stripe session.
  // e.g. tour name, summary, also the price, images.
  // So all that stuff that we want to show up on the checkout page, but also in our stripe dashboard.
  const tour = await Tour.findById(req.params.tourId);

  // 2) Create Checkout session
  const session = await stripe.checkout.sessions.create({
    /* 1) INFO ABOUT SESSION */
    payment_method_types: ['card'], // 'card' for credit card

    // url to redirect to as soon as credit card has been successfully charged
    /* 
      basically we want to create a new booking in our DB whenever this url here is accessed.
      Now we could now create a new route for this success, but then we would have to create a whole new page
      and that's not really worth it in this case. And that's because it is only a temporary solution anyway 
      because it's not really secure. And when a website is actually deployed on a server,
      we will get access to the session object once the purchase is completed using Stripe Webhooks.
      And so these webhooks will then be perfect for us to create a new booking. 
      But for now (in development), since we can't do that yet, let's use a work around,
      which is simply to put the data that we need to create a new booking right into this url as a query string.
      And we need to create a query string because Stripe will just make a GET request to this url, 
      and so we cannot really send a body or any data with it except for the query string.
      So we need tour, user and price as query string as those are required for booking model.
      This is of course not secure at all because right now anyone who knows below url structure 
      could simply call it without going through the checkout process. 
      And so anyone really could just book a tour without having to pay. :(
    */
    success_url: `${req.protocol}://${req.get('host')}/?tour=${req.params.tourId}&user=${
      req.user.id
    }&price=${tour.price}`,
    cancel_url: `${req.protocol}://${req.get('host')}/tour/${tour.slug}`, // if user chose to cancel current payment
    customer_email: req.user.email, // so that user doesn't need to manually fill out the email

    // this field allows us to pass in some data about the session that we are currently creating.
    // that's important because later once the purchase was successful,
    // we will then get access to the session object again.
    // And by then, we want to create a new bookingin our database.
    client_reference_id: req.params.tourId,

    /* 2) INFO ABOUT PRODUCT that the user is about to purchase. */
    // details about the product itself (tour)
    line_items: [
      {
        name: `${tour.name} Tour`,
        description: tour.summary,
        // these images need to be live images (images hosted on internet)
        // because Stripe will actually upload this image to their own server.
        // this is another of the things that we can only really do once the website is deployed.
        images: [`https://www.natours.dev/img/tours/${tour.imageCover}`],
        amount: tour.price * 100, // price of the product in 'cents'
        currency: 'usd', // 'eur', etc.
        quantity: 1, // quantity of the product being purchased
      },
    ],
  });

  // 3) Create Session as response
  res.status(200).json({
    status: 'success',
    session,
  });
});

// function which will create booking in the DB
// name: createBookingBheckout because later on we will also have create booking, which will then be accessible from our bookings API.
// This middleware need to be added in '/' route bcz that's what our success url is right now
exports.createBookingCheckout = catchAsync(async (req, res, next) => {
  // this is only TEMPORARY because it's UNSECURE. Everyone can make bookings without paying.
  const { tour, user, price } = req.query;

  if (!tour && !user && !price) {
    return next(); // next middleware will be '/' bcz that's what our success url is right now
  }

  await Booking.create({ tour, user, price });

  // redirect to homepage by stripping the tour, user and price query params
  res.redirect(req.originalUrl.split('?')[0]);
});

// ROUTE HANLDERS for CRUD operations on Booking
exports.getAllBookings = factory.getAll(Booking);
exports.getBooking = factory.getOne(Booking);
exports.createBooking = factory.createOne(Booking);
exports.updateBooking = factory.updateOne(Booking);
exports.deleteBooking = factory.deleteOne(Booking);
