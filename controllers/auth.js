const User = require('../models/User');
const asyncHandler = require('../middleware/asyncHandler');
const ErrorResponse = require('../utils/errorResponse');
const sendEmail = require('../utils/sendEmail');
const {
  renderResetForm,
  renderInvalidLink,
  renderResetSuccess,
} = require('../views/resetPasswordPage');

// Signs a JWT, sets it as an httpOnly cookie, and returns it in the body.
// Postman/mobile clients use the body token as "Authorization: Bearer <token>";
const sendTokenResponse = (user, statusCode, res) => {
  const token = user.getSignedJwtToken();
  const days = Number(process.env.JWT_COOKIE_EXPIRE) || 30;

  const options = {
    expires: new Date(Date.now() + days * 24 * 60 * 60 * 1000),
    httpOnly: true,
    sameSite: 'lax',
  };
  if (process.env.NODE_ENV === 'production') options.secure = true;

  res.status(statusCode).cookie('token', token, options).json({
    success: true,
    _id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    token,
  });
};

// @desc    Register a new user
// @route   POST /api/v1/auth/register
// @access  Public
exports.register = asyncHandler(async (req, res, next) => {
  const { name, tel, email, password } = req.body;

  if (email && (await User.exists({ email: String(email).toLowerCase().trim() }))) {
    return next(new ErrorResponse('Email is already registered', 400));
  }

  const user = await User.create({ name, tel, email, password });

  res.status(201).json({
    success: true,
    data: {
      _id: user._id,
      name: user.name,
      tel: user.tel,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt,
    },
  });
});

// @desc    Log in with email + password, returns a JWT
// @route   POST /api/v1/auth/login
// @access  Public
exports.login = asyncHandler(async (req, res, next) => {
  const { email, password } = req.body;

  if (typeof email !== 'string' || typeof password !== 'string' || !email || !password) {
    return next(new ErrorResponse('Please provide an email and password', 400));
  }

  const user = await User.findOne({ email: email.toLowerCase().trim() }).select('+password');

  // Same message for unknown email and wrong password, so emails can't be probed
  if (!user || !(await user.matchPassword(password))) {
    return next(new ErrorResponse('Invalid credentials', 401));
  }

  sendTokenResponse(user, 200, res);
});

// @desc    Log out: clear the token cookie
// @route   GET /api/v1/auth/logout
// @access  Public (always succeeds, even with an expired token)
// Note: JWTs are stateless, so a Bearer token stays valid until it expires.
//       Clients (Postman/frontend) should also discard their stored token.
exports.logout = (req, res) => {
  res.cookie('token', 'none', {
    expires: new Date(Date.now() + 10 * 1000),
    httpOnly: true,
    sameSite: 'lax',
  });

  res.status(200).json({ success: true, data: {} });
};

// @desc    Get the currently logged-in user
// @route   GET /api/v1/auth/me
// @access  Private
exports.getMe = (req, res) => {
  // req.user is set by the protect middleware (password is never selected)
  res.status(200).json({ success: true, data: req.user });
};

// ---------------------------------------------------------------------------
// Forgot / reset password
// ---------------------------------------------------------------------------

const RESET_REQUEST_MESSAGE =
  'หากอีเมลนี้มีบัญชีอยู่ในระบบ เราได้ส่งลิงก์สำหรับตั้งรหัสผ่านใหม่ไปให้แล้ว กรุณาตรวจสอบกล่องอีเมล (รวมถึงโฟลเดอร์สแปม)';

// Origin used in links inside emails. Set API_URL in production: never build it
// from the request's Host header, which a client can fake (reset link poisoning).
const getApiUrl = () =>
  (process.env.API_URL || `http://localhost:${process.env.PORT || 5001}`).replace(/\/+$/, '');

// Shared by the JSON (PUT) and HTML form (POST) endpoints.
// Throws ErrorResponse(400) for a bad token, mongoose ValidationError for a bad password.
const resetPasswordWithToken = async (token, password) => {
  const user = await User.findByResetToken(token);
  if (!user) throw new ErrorResponse('Invalid or expired reset token', 400);
  if (typeof password !== 'string' || !password) {
    throw new ErrorResponse('Please provide a new password', 400);
  }

  user.password = password;
  user.resetPasswordToken = undefined;
  user.resetPasswordExpire = undefined;
  await user.save();
  return user;
};

// @desc    Email a password reset link
// @route   POST /api/v1/auth/forgotpassword
// @access  Public
// The response is the same whether or not the email exists, so it can't be used
// to find out which emails are registered. The email is sent after responding.
exports.forgotPassword = asyncHandler(async (req, res, next) => {
  const { email } = req.body;
  if (typeof email !== 'string' || !email.trim()) {
    return next(new ErrorResponse('Please provide an email', 400));
  }

  const user = await User.findOne({ email: email.toLowerCase().trim() });

  if (user) {
    const resetToken = user.getResetPasswordToken();
    const hashed = user.resetPasswordToken;
    await user.save({ validateBeforeSave: false });

    const resetUrl = `${getApiUrl()}/api/v1/auth/resetpassword/${resetToken}`;
    const message =
      `สวัสดีคุณ ${user.name}\n\n` +
      `เราได้รับคำขอตั้งรหัสผ่านใหม่สำหรับบัญชี Dentist Booking ของคุณ\n\n` +
      `กดลิงก์ด้านล่างเพื่อตั้งรหัสผ่านใหม่:\n${resetUrl}\n\n` +
      `ลิงก์นี้ใช้ได้ภายใน 10 นาที และใช้ได้เพียงครั้งเดียว ` +
      `หากลิงก์หมดอายุ สามารถขอลิงก์ใหม่ได้ทุกเมื่อ\n\n` +
      `หากคุณไม่ได้ต้องการตั้งรหัสผ่านใหม่ ไม่ต้องทำอะไร รหัสผ่านเดิมของคุณยังใช้งานได้ตามปกติ\n\n` +
      `ขอบคุณที่ใช้บริการ\n` +
      `ทีมงาน Dentist Booking\n\n`;

    sendEmail({ email: user.email, subject: 'ตั้งรหัสผ่านใหม่สำหรับบัญชี Dentist Booking', message }).catch(
      async (err) => {
        console.error(`[forgotPassword] could not send reset email: ${err.message}`);
        // Drop the unusable token (only if a newer request hasn't replaced it)
        await User.updateOne(
          { _id: user._id, resetPasswordToken: hashed },
          { $unset: { resetPasswordToken: 1, resetPasswordExpire: 1 } }
        ).catch(() => {});
      }
    );
  }

  res.status(200).json({ success: true, message: RESET_REQUEST_MESSAGE });
});

// @desc    Reset password with the emailed token (JSON API)
// @route   PUT /api/v1/auth/resetpassword/:token
// @access  Public
exports.resetPassword = asyncHandler(async (req, res) => {
  const user = await resetPasswordWithToken(req.params.token, req.body.password);
  sendTokenResponse(user, 200, res);
});

// @desc    Show the reset password form (opened from the email link)
// @route   GET /api/v1/auth/resetpassword/:token
// @access  Public
exports.resetPasswordForm = asyncHandler(async (req, res) => {
  const user = await User.findByResetToken(req.params.token);
  if (!user) return renderInvalidLink(res);
  renderResetForm(res);
});

// @desc    Handle the reset password form submit
// @route   POST /api/v1/auth/resetpassword/:token
// @access  Public
exports.resetPasswordFormSubmit = asyncHandler(async (req, res) => {
  const { password, confirmPassword } = req.body;

  if (!(await User.findByResetToken(req.params.token))) return renderInvalidLink(res);
  if (typeof password !== 'string' || !password) {
    return renderResetForm(res, 400, 'กรุณากรอกรหัสผ่านใหม่');
  }
  if (password !== confirmPassword) return renderResetForm(res, 400, 'รหัสผ่านทั้งสองช่องไม่ตรงกัน');

  try {
    await resetPasswordWithToken(req.params.token, password);
  } catch (err) {
    // The only validation rule a new password can break is minlength (6)
    if (err.name === 'ValidationError') {
      return renderResetForm(res, 400, 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร');
    }
    if (err instanceof ErrorResponse) return renderInvalidLink(res);
    throw err;
  }

  renderResetSuccess(res);
});
