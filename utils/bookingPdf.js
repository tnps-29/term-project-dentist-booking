// Appointment confirmation PDF for one booking (English, A4).
// Text uses the embedded Sarabun font (assets/fonts, SIL OFL 1.1) instead of
// PDFKit's built-in Helvetica, so Thai names and expertise render correctly.
const path = require('path');
const PDFDocument = require('pdfkit');

const FONT_DIR = path.join(__dirname, '..', 'assets', 'fonts');
const FONT_REGULAR = path.join(FONT_DIR, 'Sarabun-Regular.ttf');
const FONT_BOLD = path.join(FONT_DIR, 'Sarabun-Bold.ttf');

const COLORS = {
  primary: '#2563eb',
  text: '#1f2933',
  muted: '#6b7280',
  line: '#d1d5db',
  panel: '#f3f4f6',
};

const formatDate = (date, options) =>
  new Date(date).toLocaleString('en-GB', { timeZone: 'Asia/Bangkok', ...options });

// "Saturday, 14 November 2026" / "10:30 (UTC+7)"
const appointmentDay = (date) =>
  formatDate(date, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const appointmentTime = (date) =>
  `${formatDate(date, { hour: '2-digit', minute: '2-digit', hour12: false })} (Bangkok time, UTC+7)`;

const sectionTitle = (doc, title) => {
  doc.moveDown(1.2).font('Bold').fontSize(12).fillColor(COLORS.primary)
    .text(title.toUpperCase(), doc.page.margins.left, doc.y);
  const y = doc.y + 3;
  doc.moveTo(doc.page.margins.left, y).lineTo(doc.page.width - doc.page.margins.right, y)
    .lineWidth(0.7).strokeColor(COLORS.line).stroke();
  doc.y = y + 8;
};

const row = (doc, label, value) => {
  const x = doc.page.margins.left;
  const y = doc.y;
  doc.font('Regular').fontSize(10).fillColor(COLORS.muted).text(label, x, y, { width: 140 });
  doc.font('Regular').fontSize(11).fillColor(COLORS.text)
    .text(value === undefined || value === null || value === '' ? '-' : String(value), x + 150, y, {
      width: doc.page.width - doc.page.margins.right - x - 150,
    });
  doc.moveDown(0.5);
};

/**
 * Write the appointment PDF for a booking into a writable stream (e.g. res).
 * The booking must have `user` and `dentist` populated.
 * @param {object} booking
 * @param {import('stream').Writable} stream
 */
const writeBookingPdf = (booking, stream) => {
  const doc = new PDFDocument({
    size: 'A4',
    margin: 50,
    info: {
      Title: `Dentist Appointment ${booking._id}`,
      Author: 'Dentist Booking',
      Subject: 'Appointment confirmation',
    },
  });
  doc.registerFont('Regular', FONT_REGULAR);
  doc.registerFont('Bold', FONT_BOLD);
  doc.font('Regular');
  doc.pipe(stream);

  const left = doc.page.margins.left;
  const contentWidth = doc.page.width - left - doc.page.margins.right;

  // Header band
  doc.rect(0, 0, doc.page.width, 90).fill(COLORS.primary);
  doc.font('Bold').fontSize(22).fillColor('#ffffff').text('Dentist Booking', left, 28);
  doc.font('Regular').fontSize(11).text('Appointment Confirmation', left, 56);
  doc.y = 115;

  // Appointment summary panel
  const panelTop = doc.y;
  doc.rect(left, panelTop, contentWidth, 78).fill(COLORS.panel);
  doc.font('Regular').fontSize(10).fillColor(COLORS.muted).text('APPOINTMENT', left + 16, panelTop + 14);
  doc.font('Bold').fontSize(16).fillColor(COLORS.text)
    .text(appointmentDay(booking.date), left + 16, panelTop + 30, { width: contentWidth - 32 });
  doc.font('Regular').fontSize(12).fillColor(COLORS.text)
    .text(appointmentTime(booking.date), left + 16, panelTop + 52, { width: contentWidth - 32 });
  doc.y = panelTop + 78;

  sectionTitle(doc, 'Patient');
  row(doc, 'Name', booking.user && booking.user.name);
  row(doc, 'Email', booking.user && booking.user.email);
  row(doc, 'Telephone', booking.user && booking.user.tel);

  sectionTitle(doc, 'Dentist');
  row(doc, 'Name', booking.dentist && booking.dentist.name);
  row(doc, 'Expertise', booking.dentist && booking.dentist.expertise);
  row(
    doc,
    'Experience',
    booking.dentist && booking.dentist.yearsOfExperience !== undefined
      ? `${booking.dentist.yearsOfExperience} year${booking.dentist.yearsOfExperience === 1 ? '' : 's'}`
      : undefined
  );

  sectionTitle(doc, 'Booking details');
  row(doc, 'Booking ID', booking._id);
  row(doc, 'Booked on', booking.createdAt && formatDate(booking.createdAt, { dateStyle: 'long', timeStyle: 'short' }));
  row(doc, 'Issued on', formatDate(new Date(), { dateStyle: 'long', timeStyle: 'short' }));

  sectionTitle(doc, 'Before your visit');
  doc.font('Regular').fontSize(10).fillColor(COLORS.text).list(
    [
      'Please arrive 10-15 minutes before your appointment time.',
      'Bring this confirmation (printed or on your phone).',
      'To reschedule or cancel, update your booking in the Dentist Booking system.',
    ],
    left,
    doc.y,
    { width: contentWidth, bulletRadius: 2, textIndent: 12, paragraphGap: 4 }
  );

  // Footer
  const footerY = doc.page.height - doc.page.margins.bottom - 20;
  doc.font('Regular').fontSize(8).fillColor(COLORS.muted).text(
    'This document was generated automatically by the Dentist Booking system.',
    left,
    footerY,
    { width: contentWidth, align: 'center', lineBreak: false }
  );

  doc.end();
};

module.exports = writeBookingPdf;
