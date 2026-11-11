const mongoose = require('mongoose');

const DentistSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Please add a name'],
      trim: true,
      unique: true,
      maxlength: [100, 'Name cannot be more than 100 characters'],
    },
    yearsOfExperience: {
      type: Number,
      required: [true, 'Please add years of experience'],
      min: [0, 'Years of experience cannot be negative'],
    },
    expertise: {
      type: String,
      required: [true, 'Please add an area of expertise'],
      trim: true,
    },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

// Reverse populate: Dentist.findById(id).populate('bookings')
DentistSchema.virtual('bookings', {
  ref: 'Booking',
  localField: '_id',
  foreignField: 'dentist',
  justOne: false,
});

// Cascade: deleting a dentist with dentist.deleteOne() also deletes their bookings
DentistSchema.pre('deleteOne', { document: true, query: false }, async function () {
  await this.model('Booking').deleteMany({ dentist: this._id });
});

module.exports = mongoose.model('Dentist', DentistSchema);
