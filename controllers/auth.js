const User = require('../models/User');
const asyncHandler = require('../middleware/asyncHandler');
const ErrorResponse = require('../utils/errorResponse');

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
