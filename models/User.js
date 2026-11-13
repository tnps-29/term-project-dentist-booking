const crypto = require('crypto');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const UserSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Please add a name'],
      trim: true,
    },
    tel: {
      type: String,
      required: [true, 'Please add a telephone number'],
      match: [/^[0-9+\-\s]{9,15}$/, 'Please add a valid telephone number'],
    },
    email: {
      type: String,
      required: [true, 'Please add an email'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please add a valid email'],
    },
    password: {
      type: String,
      required: [true, 'Please add a password'],
      minlength: [6, 'Password must be at least 6 characters'],
      select: false,
    },
    role: {
      type: String,
      enum: ['user', 'admin'],
      default: 'user',
    },
    //reset password (stored as a sha256 hash + expiry)
    resetPasswordToken: { type: String, select: false },
    resetPasswordExpire: { type: Date, select: false },
  },
  { timestamps: true }
);

// hash the password whenever it is set or changed
UserSchema.pre('save', async function () {
  if (!this.isModified('password')) return;
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// T07: sign a JWT containing the user id
UserSchema.methods.getSignedJwtToken = function () {
  if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET is not set (see config/config.env.example)');
  return jwt.sign({ id: this._id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || '30d',
  });
};

// compare a plain password with the stored hash
// (the user must be loaded with .select('+password'))
UserSchema.methods.matchPassword = function (enteredPassword) {
  return bcrypt.compare(enteredPassword, this.password);
};

// reset tokens are stored as sha256, never as the raw token.
const hashResetToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

// create a one-time reset token valid for 10 minutes.
// Only the hash is stored; the raw token is returned to be emailed.
UserSchema.methods.getResetPasswordToken = function () {
  const resetToken = crypto.randomBytes(20).toString('hex');
  this.resetPasswordToken = hashResetToken(resetToken);
  this.resetPasswordExpire = new Date(Date.now() + 10 * 60 * 1000);
  return resetToken;
};

// find the user for a raw (emailed) reset token that has not expired.
// Resolves to null for a malformed, unknown, used or expired token.
UserSchema.statics.findByResetToken = async function (token) {
  if (typeof token !== 'string' || !/^[a-f0-9]{40}$/.test(token)) return null;
  return this.findOne({
    resetPasswordToken: hashResetToken(token),
    resetPasswordExpire: { $gt: Date.now() },
  }).select('+resetPasswordToken +resetPasswordExpire');
};

module.exports = mongoose.model('User', UserSchema);
