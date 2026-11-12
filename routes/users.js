const express = require('express');
const router = express.Router();
const { getUsers } = require('../controllers/users');

const { protect, authorize } = require('../middleware/auth');

//All routes below require a logged-in admin
router.use(protect, authorize('admin'));

//User list (Admin only)
router.route('/').get(getUsers);

module.exports = router;