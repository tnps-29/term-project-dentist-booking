const asyncHandler = require('../middleware/asyncHandler');
const { sendDueReminders } = require('../jobs/reminder');

// @desc    Send due appointment reminders now (same job as the cron)
// @route   POST /api/v1/reminders/run
// @access  Private (admin)
exports.runReminders = asyncHandler(async (req, res) => {
  const result = await sendDueReminders();
  res.status(200).json({ success: true, data: result });
});
