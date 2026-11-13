// Appointment reminder: email users whose booking is within the next 24 hours.
// Runs from a cron in server.js and from POST /api/v1/reminders/run (admin).
const cron = require('node-cron');
const Booking = require('../models/Booking');
const sendEmail = require('../utils/sendEmail');

const REMIND_BEFORE_MS = 24 * 60 * 60 * 1000;
const DEFAULT_SCHEDULE = '*/10 * * * *'; // every 10 minutes

const formatThaiDate = (date) =>
  date.toLocaleString('th-TH', {
    timeZone: 'Asia/Bangkok',
    dateStyle: 'full',
    timeStyle: 'short',
  });

const buildMessage = (booking) => {
  const { user, dentist } = booking;
  return (
    `สวัสดีคุณ ${user.name}\n\n` +
    `ขอแจ้งเตือนว่าคุณมีนัดหมายทันตแพทย์ในอีกไม่ถึง 24 ชั่วโมง\n\n` +
    `ทันตแพทย์: ${dentist.name}${dentist.expertise ? ` (${dentist.expertise})` : ''}\n` +
    `วันและเวลา: ${formatThaiDate(booking.date)}\n\n`
  );
};

/**
 * Send reminders for bookings between now and now + 24h that have not been
 * reminded yet. Each booking is claimed atomically (reminderSent: false -> true)
 * before its email is sent, so two runs at once (cron + manual, or two servers
 * on the shared database) never send the same reminder twice. If the email
 * fails, the claim is undone and the next run retries it.
 *
 * @returns {Promise<{checked: number, sent: number, failed: number, skipped: number}>}
 */
const sendDueReminders = async () => {
  const now = new Date();
  const due = await Booking.find({
    reminderSent: false,
    date: { $gt: now, $lte: new Date(now.getTime() + REMIND_BEFORE_MS) },
  })
    .select('_id')
    .lean();

  const result = { checked: due.length, sent: 0, failed: 0, skipped: 0 };

  for (const { _id } of due) {
    const booking = await Booking.findOneAndUpdate(
      { _id, reminderSent: false },
      { reminderSent: true },
      { new: true }
    )
      .populate({ path: 'user', select: 'name email' })
      .populate({ path: 'dentist', select: 'name expertise' });

    if (!booking) continue; // claimed by another run in the meantime

    if (!booking.user || !booking.dentist) {
      result.skipped += 1; // account or dentist was deleted: nobody to remind
      continue;
    }

    try {
      await sendEmail({
        email: booking.user.email,
        subject: 'แจ้งเตือนนัดหมายทันตแพทย์ภายใน 24 ชั่วโมง',
        message: buildMessage(booking),
      });
      result.sent += 1;
    } catch (err) {
      result.failed += 1;
      console.error(`[reminder] could not email booking ${_id}: ${err.message}`);
      await Booking.updateOne({ _id }, { reminderSent: false }).catch(() => {});
    }
  }

  return result;
};

/**
 * Start the reminder cron. Skipped when SMTP is not configured: otherwise a
 * local server without SMTP would mark bookings in the shared database as
 * reminded while only printing the emails to its console.
 * Set REMINDER_CRON to change the schedule, or to "off" to disable it.
 */
const startReminderJob = () => {
  const schedule = process.env.REMINDER_CRON || DEFAULT_SCHEDULE;

  if (schedule === 'off') {
    console.log('[reminder] cron disabled (REMINDER_CRON=off)');
    return null;
  }
  if (!process.env.SMTP_HOST) {
    console.log('[reminder] cron not started: SMTP is not configured');
    return null;
  }
  if (!cron.validate(schedule)) {
    console.error(`[reminder] cron not started: invalid REMINDER_CRON "${schedule}"`);
    return null;
  }

  let running = false;
  const task = cron.schedule(schedule, async () => {
    if (running) return; // previous run still sending
    running = true;
    try {
      const r = await sendDueReminders();
      if (r.checked) console.log(`[reminder] ${JSON.stringify(r)}`);
    } catch (err) {
      console.error(`[reminder] run failed: ${err.message}`);
    } finally {
      running = false;
    }
  });

  console.log(`[reminder] cron started (${schedule})`);
  return task;
};

module.exports = { sendDueReminders, startReminderJob };
