const mongoose = require('mongoose');

const DentistSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Please add a name'],
      trim: true,
      unique: true,
    },
    yearsOfExperience: {
      type: Number,
      required: [true, 'Please add years of experience'],
      min: [0, 'Years of experience cannot be negative'],
    },
    areaOfExpertise: {
      type: String,
      required: [true, 'Please add an area of expertise'],
      trim: true,
    },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

// Reverse populate: dentist.bookings
DentistSchema.virtual('bookings', {
  ref: 'Booking',
  localField: '_id',
  foreignField: 'dentist',
  justOne: false,
});

module.exports = mongoose.model('Dentist', DentistSchema);
