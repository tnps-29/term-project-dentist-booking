# Project 4: Dentist Booking System — Group "HelloWorld"

REST API for the SW Dev Prac term project. Built with Node.js, Express 4, MongoDB (Mongoose 8), and JWT.

## Getting started

```bash
npm install
cp config/config.env.example config/config.env   # set MONGO_URI (local or Atlas)
npm run dev                                      # nodemon, or: npm start
```

`GET /` should return `{ "success": true, "message": "Dentist Booking API" }`.

## Project structure

```
server.js              entry: load env, connect DB, start server
app.js                 Express app: parsers, security middleware, routes, error handler
config/
  db.js                MongoDB connection
  config.env.example   env template (copy to config.env, which is git-ignored)
models/                Mongoose models (User, Dentist, Booking)
controllers/           request handlers, one file per resource
routes/                Express routers, mounted under /api/v1
middleware/
  error.js             central error handler
  asyncHandler.js      async wrapper for controllers
utils/
  errorResponse.js     ErrorResponse(message, statusCode)
```

## Data models

```
User 1 ──── 0..1 Booking 0..* ──── 1 Dentist
```

**User** (`models/User.js`)

| Field | Type | Rules |
|---|---|---|
| `name` | String | required |
| `tel` | String | required, 9–15 digits (`+`, `-`, spaces allowed) |
| `email` | String | required, unique, valid email, stored lowercase |
| `password` | String | required, min 6, **hidden by default** (`.select('+password')` to read) |
| `role` | String | `user` \| `admin`, default `user` |
| `resetPasswordToken`, `resetPasswordExpire` | String, Date | hidden, used by reset password (T19) |

**Dentist** (`models/Dentist.js`)

| Field | Type | Rules |
|---|---|---|
| `name` | String | required, unique, max 100 |
| `yearsOfExperience` | Number | required, ≥ 0 |
| `expertise` | String | required (area of expertise) |
| `bookings` | virtual | `Dentist.findById(id).populate('bookings')` |

Deleting a dentist with `dentist.deleteOne()` also deletes their bookings.

**Booking** (`models/Booking.js`)

| Field | Type | Rules |
|---|---|---|
| `date` | Date | required, date **and time** of the appointment (ISO 8601, e.g. `2026-12-01T10:00:00+07:00`) |
| `user` | ObjectId → User | required |
| `dentist` | ObjectId → Dentist | required |
| `reminderSent` | Boolean | default `false`, set by the 24h reminder (T23) |

The one-booking-per-user limit is enforced in the booking controller (T12), not in the schema, so admins aren't blocked by it. All models have `createdAt` / `updatedAt`.

## API endpoints

Base URL: `http://localhost:5001/api/v1`

| Method | Path | Access | Ticket | Body | Response |
|---|---|---|---|---|---|
| POST | `/auth/register` | Public | T06 | `{ name, tel, email, password }` | `201 { success, data: { _id, name, tel, email, role, createdAt } }` |

Register always creates a `user`; `role` in the body is ignored (admins come from the seed script, T17). Passwords are hashed with bcrypt before saving. A duplicate email returns `400 Email is already registered`.

## Conventions

- **Base path:** `/api/v1/<resource>` (`auth`, `users`, `dentists`, `bookings`)
- **Success response:** `{ success: true, data, count? }`
- **Error response:** `{ success: false, message }`. Use `next(new ErrorResponse(msg, status))` and wrap controllers in `asyncHandler`.
- **Status codes:** 400 bad input, 401 not logged in, 403 wrong role or not the owner, 404 not found
- **Files:** controllers and routes are named after the resource in lowercase plural, e.g. `controllers/bookings.js`. Models use singular PascalCase, e.g. `models/Booking.js`.
- **Branches:** `<type>/tNN-short-name`, e.g. `feat/t06-register`. Types are `feat`, `fix`, `chore`, and `test`.
- **Commits:** `tNN: short description`, e.g. `t06: add register endpoint`
