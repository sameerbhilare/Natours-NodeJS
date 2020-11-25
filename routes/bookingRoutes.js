const express = require('express');
const bookingController = require('../controllers/bookingController');
const authController = require('../controllers/authController');

const router = express.Router();

// all below routes are for authenticated users only
router.use(authController.protect);

// route for creating 'stripe session'
// e.g. /api/v1/bookings/checkout-session/5c88fa8cf4afda39709c2955
router.get('/checkout-session/:tourId', bookingController.getCheckoutSession);

// all below routes are for Admin and Lead Guides only
// for a lead guide to basically know which tourists have been booked,
// and for an admin to kind of update or delete tourists if necessary.
router.use(authController.restrictTo('admin', 'lead-guide'));
router.route('/').get(bookingController.getAllBookings).post(bookingController.createBooking);
router
  .route('/:id')
  .get(bookingController.getBooking)
  .patch(bookingController.updateBooking)
  .delete(bookingController.deleteBooking);

// export reviews router
module.exports = router;
