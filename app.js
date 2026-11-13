const express = require('express');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const cors = require('cors');
const mongoSanitize = require('express-mongo-sanitize');
const hpp = require('hpp');
const { rateLimit } = require('express-rate-limit');

const errorHandler = require('./middleware/error');

const app = express();

app.use(helmet());
app.use(cors({ origin: true, credentials: true }));

// Body + cookie parsing
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

// Input sanitizing (needs the parsed body)
app.use(mongoSanitize());
app.use(hpp());
if (process.env.NODE_ENV !== 'test') {
  app.use(
    rateLimit({
      windowMs: 10 * 60 * 1000,
      limit: 500,
      standardHeaders: true,
      legacyHeaders: false,
    })
  );
}

app.get('/', (req, res) => res.json({ success: true, message: 'Dentist Booking API' }));

// ---- TODO: API routes (mounted per ticket) ----
app.use('/api/v1/auth', require('./routes/auth')); // T06-T10, T19 (A)
app.use('/api/v1/users', require('./routes/users'));       // T16 (B)
app.use('/api/v1/dentists', require('./routes/dentists')); // T11, T20, T21 (B)
app.use('/api/v1/bookings', require('./routes/bookings')); // T12-T15, T22 (B)
app.use('/api/v1/reminders', require('./routes/reminders')); // T23 (A)

app.use((req, res) =>
  res.status(404).json({ success: false, message: `Not found: ${req.method} ${req.originalUrl}` })
);
app.use(errorHandler);

module.exports = app;
