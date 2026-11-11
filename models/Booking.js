const mongoose = require('mongoose');

const BookingSchema = new mongoose.Schema(
  {
    bookingDate: {
      type: Date,
      required: [true, 'Please add a booking date'],
    },
    user: {
      type: mongoose.Schema.ObjectId,
      ref: 'User',
      required: true,
    },
    dentist: {
      type: mongoose.Schema.ObjectId,
      ref: 'Dentist',
      required: true,
    },
    // Used by the 24h reminder email ticket
    reminderSent: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Booking', BookingSchema);
