const express = require('express');
const { runReminders } = require('../controllers/reminders');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

router.post('/run', protect, authorize('admin'), runReminders);

module.exports = router;
