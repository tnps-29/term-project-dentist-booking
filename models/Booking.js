const mongoose = require('mongoose');

const BookingSchema = new mongoose.Schema(
  {
    date: {
      type: Date,
      required: [true, 'Please add a booking date'],
    },
    user: {
      type: mongoose.Schema.ObjectId,
      ref: 'User',
      required: [true, 'Booking must belong to a user'],
    },
    dentist: {
      type: mongoose.Schema.ObjectId,
      ref: 'Dentist',
      required: [true, 'Please choose a dentist'],
    },
    reminderSent: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

BookingSchema.index({ user: 1 });
BookingSchema.index({ dentist: 1, date: 1 });
BookingSchema.index({ reminderSent: 1, date: 1 });

module.exports = mongoose.model('Booking', BookingSchema);
