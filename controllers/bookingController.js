const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const Tour = require('../models/tourModel');
const User = require('../models/userModel');
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

    /************************************************************************************************* */
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
    /*success_url: `${req.protocol}://${req.get('host')}/my-tours/?tour=${req.params.tourId}&user=${
      req.user.id
    }&price=${tour.price}`,*/
    /************************************************************************************************* */
    // url to redirect to as soon as credit card has been successfully charged
    /*
      After a successful booking, we still want to come back to my-tours 
      but without all above query parameters (tour, user, price).
      That's because we no longer need the createBookingCheckout function, 
      but this will be eligently handled by the stripe webhook function createBookingCheckout below
      as createBookingCheckout gets called when Stripe calls our webhook route (/webhook-checkout)
    */
    success_url: `${req.protocol}://${req.get('host')}/my-tours`,

    cancel_url: `${req.protocol}://${req.get('host')}/tour/${tour.slug}`, // if user chose to cancel current payment

    // so that user doesn't need to manually fill out the email
    // that's important because later once the purchase was successful,
    // we will then get access to the session object again.
    // And by then, we want to create a new bookingin our database.
    customer_email: req.user.email,

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
        // Using 'prepared' URL as our website is live at https://natours-sameerb.herokuapp.com
        images: [`${req.protocol}://${req.get('host')}/img/tours/${tour.imageCover}`],
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
/*
exports.createBookingCheckout = catchAsync(async (req, res, next) => {
  // this is only TEMPORARY because it's UNSECURE. Everyone can make bookings without paying.
  const { tour, user, price } = req.query;

  if (!tour && !user && !price) {
    return next(); // next middleware will be '/' bcz that's what our success url is right now
  }

  await Booking.create({ tour, user, price });

  // redirect to homepage by stripping the tour, user and price query params
  res.redirect(req.originalUrl.split('?')[0]);
}); */

// normal function to create booking when stripe webhook is called for Payment Success event
const createBooking = async (session) => {
  // client_reference_id, customer_email and price is what we had passed while starting the session
  // so this informatio is available in the final session data object.
  // check API reference to find out exactly where it is saved in final session
  // or you can see the session obejct at login to stripe ->
  //    Developers-> Web hooks -> open relevant endpoint for this event -> Webhook attempts
  const tour = session.data.client_reference_id; // stored in getCheckoutSession above while starting the session
  const user = (await User.findOne({ email: session.data.customer_email })).id; // stored in getCheckoutSession above while starting the session
  const price = session.data.amount_total / 100; // this is how we have stored above in getCheckoutSession

  await Booking.create({ tour, user, price });
};

// ROUTE HANLDERS for Stripe webhook for Succssful Payment event.
exports.webhookCheckout = (req, res, next) => {
  //  1) first thing that we need to do is to read this Stripe signature out of our headers.
  // Basically when Stripe calls our webhook, it will add a header to that request
  // containing a special signature for our webhook in the 'stripe-signature' header.
  const signature = req.headers['stripe-signature'];

  // 2) create stripe event using RAW body as stream.
  // We need all of bwlo data like the signature and the secret
  // in order to validate the data that comes in the body so that no one can actually manipulate that.
  let event;
  try {
    event = stripe.webhooks.constructEvent(
      req.body, // RAW body as stream
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (error) {
    // In case there is an error, we want to send back an error to Stripe.
    // It is Stripe who will receive this response
    // because it is Stripe who will actually call this webhook URL which will then call this webhook function.
    return res.status(400).send(`Webhook error: ${error.message}`);
  }

  // 3) Since our webhook is tied to the successful payment event, which is 'checkout.session.completed'
  // So if this is that event, we then want to actually use the event to create our booking in our database.
  if (event.type === 'checkout.session.completed') {
    // the event will contain the Session Data which we will use to create booking in our DB
    createBooking(event.data.object);
  }

  // 4) Send response back to Stripe
  res.status(200).json({ received: true });
};

// ROUTE HANLDERS for CRUD operations on Booking
exports.getAllBookings = factory.getAll(Booking);
exports.getBooking = factory.getOne(Booking);
exports.createBooking = factory.createOne(Booking);
exports.updateBooking = factory.updateOne(Booking);
exports.deleteBooking = factory.deleteOne(Booking);
