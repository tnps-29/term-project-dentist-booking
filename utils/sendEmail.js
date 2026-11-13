const nodemailer = require('nodemailer');

let transporter;

const getTransporter = () => {
  if (transporter) return transporter;

  if (process.env.SMTP_HOST) {
    const port = Number(process.env.SMTP_PORT) || 587;
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: port === 465, // 465 = TLS from the start, 587/2525 = STARTTLS
      auth: process.env.SMTP_EMAIL
        ? { user: process.env.SMTP_EMAIL, pass: process.env.SMTP_PASSWORD }
        : undefined,
    });
  } else {
    transporter = nodemailer.createTransport({ jsonTransport: true });
  }
  return transporter;
};

/**
 * Send an email.
 * @param {object} options
 * @param {string} options.email   recipient address
 * @param {string} options.subject subject line
 * @param {string} options.message plain-text body
 * @param {string} [options.html]  optional HTML body
 * @returns {Promise<object>} Nodemailer info object
 */
const sendEmail = async ({ email, subject, message, html }) => {
  const fromName = process.env.FROM_NAME || 'Dentist Booking';
  const fromEmail =
    process.env.FROM_EMAIL || process.env.SMTP_EMAIL || 'noreply@dentist-booking.local';

  const info = await getTransporter().sendMail({
    from: `"${fromName}" <${fromEmail}>`,
    to: email,
    subject,
    text: message,
    html,
  });

  if (!process.env.SMTP_HOST) {
    // jsonTransport: info.message is the email serialized as JSON
    const mail = JSON.parse(info.message);
    console.log(
      `[sendEmail] SMTP not configured, email not sent:\n` +
        `  To: ${email}\n  Subject: ${subject}\n  ${String(mail.text).replace(/\n/g, '\n  ')}`
    );
  }

  return info;
};

module.exports = sendEmail;
