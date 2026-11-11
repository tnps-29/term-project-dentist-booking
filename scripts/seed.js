// Seed shared test data (T17).
//
//   npm run seed          create/refresh the seed admin, users and dentists (safe to re-run)
//   npm run seed:destroy  delete ONLY the seed records (and their bookings)
//
// Both only touch records listed in scripts/seed-data.js, so data that A or B
// created by hand in the shared database is left alone.
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', 'config', 'config.env'), quiet: true });

const mongoose = require('mongoose');
const connectDB = require('../config/db');
const User = require('../models/User');
const Dentist = require('../models/Dentist');
const Booking = require('../models/Booking');
const { users, dentists } = require('./seed-data');

const importData = async () => {
  for (const data of users) {
    let user = await User.findOne({ email: data.email });
    const action = user ? 'updated' : 'created';
    if (!user) user = new User();
    // Reset to the known values so the test credentials always work,
    // even after someone changed the password (e.g. testing T19).
    Object.assign(user, data);
    await user.save(); // pre-save hook hashes the password
    console.log(`  user    ${action.padEnd(7)} ${data.email.padEnd(20)} / ${data.password.padEnd(12)} (${data.role})`);
  }

  for (const data of dentists) {
    const existing = await Dentist.exists({ name: data.name });
    await Dentist.findOneAndUpdate({ name: data.name }, data, {
      upsert: true,
      runValidators: true,
      setDefaultsOnInsert: true,
    });
    console.log(`  dentist ${(existing ? 'updated' : 'created').padEnd(7)} ${data.name} (${data.expertise})`);
  }
};

const destroyData = async () => {
  const bookingsBefore = await Booking.countDocuments();
  const seedUsers = await User.find({ email: { $in: users.map((u) => u.email) } });
  await Booking.deleteMany({ user: { $in: seedUsers.map((u) => u._id) } });
  const deletedUsers = await User.deleteMany({ _id: { $in: seedUsers.map((u) => u._id) } });

  // deleteOne() per dentist so the cascade hook also removes their bookings
  const seedDentists = await Dentist.find({ name: { $in: dentists.map((d) => d.name) } });
  for (const d of seedDentists) await d.deleteOne();

  const deletedBookings = bookingsBefore - (await Booking.countDocuments());
  console.log(`  deleted ${deletedUsers.deletedCount} users, ${seedDentists.length} dentists, ${deletedBookings} bookings`);
};

const run = async () => {
  const destroy = process.argv.includes('--destroy');
  await connectDB();
  console.log(destroy ? 'Removing seed data...' : 'Seeding data...');
  if (destroy) await destroyData();
  else await importData();
  console.log('Done.');
};

run()
  .catch((err) => {
    console.error(`Seed failed: ${err.message}`);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
