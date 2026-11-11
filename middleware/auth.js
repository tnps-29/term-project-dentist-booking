const jwt = require('jsonwebtoken');
const User = require('../models/User');

// @desc  Require a logged-in user. Reads the JWT from
//        "Authorization: Bearer <token>" (Postman) or the "token" cookie (browser),
//        then sets req.user (without password).
//
//        Usage: router.get('/me', protect, getMe);
exports.protect = async (req, res, next) => {
  let token;
  const header = req.headers.authorization;

  if (header && header.startsWith('Bearer ')) {
    token = header.split(' ')[1];
  } else if (req.cookies && req.cookies.token && req.cookies.token !== 'none') {
    token = req.cookies.token;
  }

  if (!token) {
    return res.status(401).json({ success: false, message: 'Not authorized to access this route' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);
    // Token is valid but the account was deleted
    if (!user) {
      return res.status(401).json({ success: false, message: 'Not authorized to access this route' });
    }
    req.user = user;
    next();
  } catch (err) {
    // Invalid signature, malformed or expired token
    return res.status(401).json({ success: false, message: 'Not authorized to access this route' });
  }
};

// @desc  Allow only the given roles. Must come after protect.
//
//        Usage: router.post('/', protect, authorize('admin'), createDentist);
//               router.get('/', protect, authorize('admin', 'user'), getBookings);
exports.authorize = (...roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) {
    return res.status(403).json({
      success: false,
      message: `User role '${req.user ? req.user.role : 'guest'}' is not authorized to access this route`,
    });
  }
  next();
};
