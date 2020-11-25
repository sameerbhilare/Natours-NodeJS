const express = require('express');
const userController = require('../controllers/userController');
const authController = require('../controllers/authController');

const router = express.Router(); // kind of sub-application

/**
 * signup is a special endpoint which doesn't fit for REST philosophy.
 * 1) This is NOT a REST "Resource"
 * 2) Name of the URL matters and will decide which action will be performed.
 * 3) We only need POST for signup. No GET, etc.
 */
router.post('/signup', authController.signup);
router.post('/login', authController.login);
router.get('/logout', authController.logout);
router.post('/forgotPassword', authController.forgotPassword);
// it's PATCH, because the result of this will be the modification of the password property in the user document.
router.patch('/resetPassword/:token', authController.resetPassword);

/************************************************************************* */
// middleware - which will basically protect all routes coming AFTER THIS POINT
// that's because middlewares run in sequence
// without below line, we would have to use authController.protect in each route whereever required
router.use(authController.protect);

// /me route
router.get('/me', userController.getMe, userController.getUser);
// it's PATCH, because the result of this will be the modification of the password property in the user document.
router.patch('/updateMyPassword', authController.updatePassword);
router.patch(
  '/updateMe',
  userController.uploadUserPhoto,
  userController.resizeUserPhoto,
  userController.updateMe
);
// DELETE
router.delete('/deleteMe', userController.deleteMe);

/************************************************************************* */
// middleware - which will basically restrict all routes coming AFTER THIS POINT from unauthorized access.
// only ADMIN is allowed to access below routes
// that's because middlewares run in sequence
// without below line, we would have to use authController.restrictTo('admin') in each route whereever required
router.use(authController.restrictTo('admin'));

/**
 * follows REST philosophy, where
 * the name of the URL has nothing to do with the action that is actually performed.
 * 1) This is a REST "Resource"
 * 2) Name of the URL has nothing to do with the action that is actually performed.
 * 3) Based on actions, we have different HTTP Methods like GET, POST, DELETE, PATCH, etc.
 */
router.route('/').get(userController.getAllUsers).post(userController.createUser);
router
  .route('/:id')
  .get(userController.getUser)
  .patch(userController.updateUser)
  .delete(userController.deleteUser);

// export single entity
module.exports = router;
