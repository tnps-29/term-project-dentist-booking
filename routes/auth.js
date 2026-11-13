const express = require('express');
const {
  register,
  login,
  logout,
  getMe,
  forgotPassword,
  resetPassword,
  resetPasswordForm,
  resetPasswordFormSubmit,
} = require('../controllers/auth');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.post('/register', register);
router.post('/login', login);
router.get('/logout', logout);
router.get('/me', protect, getMe);

//reset password
router.post('/forgotpassword', forgotPassword);
router
  .route('/resetpassword/:token')
  .get(resetPasswordForm) // HTML form opened from the email link
  .post(resetPasswordFormSubmit) // form submit
  .put(resetPassword); // JSON API (Postman)

module.exports = router;
