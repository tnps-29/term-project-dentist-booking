const User = require('../models/User');
const asyncHandler = require('../middleware/asyncHandler');
const ErrorResponse = require('../utils/errorResponse');

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
