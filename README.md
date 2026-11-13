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
jobs/
  reminder.js          appointment reminder job (cron + sendDueReminders)
views/
  resetPasswordPage.js HTML form pages for the reset password email link
middleware/
  error.js             central error handler
  asyncHandler.js      async wrapper for controllers
utils/
  errorResponse.js     ErrorResponse(message, statusCode)
  sendEmail.js         sendEmail({ email, subject, message, html? }) via SMTP
postman/               Postman collection + environment (import into Postman)
scripts/
  seed.js              npm run seed / seed:destroy
  seed-data.js         test accounts and dentists
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
| POST | `/auth/login` | Public | T07 | `{ email, password }` | `200 { success, _id, name, email, role, token }` + `token` cookie |
| GET | `/auth/logout` | Public | T08 | – | `200 { success, data: {} }`, `token` cookie cleared |
| GET | `/auth/me` | Logged in | T10 | – | `200 { success, data: user }` (no password) |
| POST | `/auth/forgotpassword` | Public | T19 | `{ email }` | `200 { success, message }` (same for unknown emails) |
| PUT | `/auth/resetpassword/:token` | Public | T19 | `{ password }` | `200 { success, _id, name, email, role, token }` + `token` cookie |
| GET / POST | `/auth/resetpassword/:token` | Public | T19 | form: `password`, `confirmPassword` | HTML form opened from the email link |
| POST | `/reminders/run` | Admin | T23 | – | `200 { success, data: { checked, sent, failed, skipped } }` |

Register always creates a `user`; `role` in the body is ignored (admins come from the seed script, T17). Passwords are hashed with bcrypt before saving. A duplicate email returns `400 Email is already registered`.

**Authentication:** login returns a JWT in the body and also sets it as an httpOnly `token` cookie. Send it on protected routes as `Authorization: Bearer <token>`. A missing email or password returns `400`. A wrong password or unknown email returns `401 Invalid credentials`. JWT settings (`JWT_SECRET`, `JWT_EXPIRE`, `JWT_COOKIE_EXPIRE`) live in `config/config.env`.

**Logout** replaces the cookie with `token=none`. JWTs are stateless, so a Bearer token stays valid until it expires. Clients such as Postman should also clear their stored token.

**Reset password:** `POST /auth/forgotpassword` emails a reset link (via `sendEmail`, T18) and always answers `200` with the same message, so it can't reveal which emails are registered. Only a sha256 hash of the token is stored, it expires after 10 minutes, and it works once. The email (in Thai) contains a link `GET {API_URL}/api/v1/auth/resetpassword/<token>` that opens a plain HTML form (no JavaScript, because of helmet's CSP).

**Testing reset password from Postman:** the token is the last part of the link in the email (40 hex characters). Postman can't read emails, so copy it by hand:

1. `POST /auth/forgotpassword` with `{ "email": "<your email>" }`.
2. Open the email and copy the token from the end of the link. Without SMTP settings, the email is printed in the server console instead.
3. `PUT /auth/resetpassword/<token>` with `{ "password": "<new password>" }`. Success returns a JWT and logs the user in like `/auth/login`.

An invalid, used or expired token returns `400 Invalid or expired reset token`. A password shorter than 6 characters returns `400`. Set `API_URL` in `config/config.env` to the public origin of the API (default `http://localhost:<PORT>`).

### Protecting routes

`middleware/auth.js` exports two middlewares:

- `protect` requires a valid JWT (Bearer header or `token` cookie) and sets `req.user`, loaded fresh from the DB without the password. It returns **401** when the token is missing, invalid, or expired, or when the user no longer exists.
- `authorize(...roles)` must come **after** `protect`. It returns **403** when `req.user.role` isn't one of `roles`.

```js
const { protect, authorize } = require('../middleware/auth');

router.route('/')
  .get(getDentists)                                   // public
  .post(protect, authorize('admin'), createDentist);  // admin only

router.use(protect);                                  // every route below needs login
router.route('/:id').put(updateBooking);              // then check ownership in the controller:
// if (booking.user.toString() !== req.user.id && req.user.role !== 'admin') -> 403
```

## Email

`utils/sendEmail.js` is shared by reset password (T19) and appointment reminders (T23):

```js
const sendEmail = require('../utils/sendEmail');
await sendEmail({ email: user.email, subject: 'Subject', message: 'Plain-text body' });
```

Set `SMTP_HOST`, `SMTP_PORT`, `SMTP_EMAIL`, `SMTP_PASSWORD`, `FROM_NAME` and `FROM_EMAIL` in `config/config.env` (see `config.env.example`). Port 465 uses TLS. Other ports use STARTTLS. If `SMTP_HOST` is empty, nothing is sent and the email is printed to the console instead, which is enough for development. To see real emails without spamming anyone, use a sandbox inbox such as Mailtrap. `sendEmail` rejects when SMTP fails, so callers should catch the error.

## Appointment reminders

`jobs/reminder.js` emails each user (in Thai) when their booking is less than 24 hours away. It includes the dentist and the date and time in Bangkok time.

- **Cron:** `server.js` runs the job every 10 minutes. Change the schedule with `REMINDER_CRON` (cron syntax), or set it to `off` to disable it. The cron only starts when `SMTP_HOST` is set. Without SMTP, a local server would mark bookings in the shared database as reminded while only printing the emails to its console.
- **No duplicates:** `Booking.reminderSent` marks a booking as reminded. Each booking is claimed atomically before its email goes out, so two runs at once (the cron plus a manual run, or two servers on the shared database) never send the same reminder twice. If sending fails, the flag goes back to `false` and the next run retries.
- **Rescheduling:** a hook in `models/Booking.js` resets `reminderSent` to `false` whenever `date` changes, through `PUT /bookings/:id` or any other update, so the new time gets its own reminder.
- **Manual run:** `POST /reminders/run` (admin) runs the same job right away and returns counts. `skipped` counts bookings whose user or dentist no longer exists. It works without SMTP too, in which case the emails are printed to the console.

**Testing from Postman:** log in as admin and create a booking for less than 24 hours from now. Call `POST /reminders/run` and expect `sent: 1`. Call it again and expect `sent: 0`.

## Seed data

```bash
npm run seed           # create or refresh the test accounts and dentists (safe to re-run)
npm run seed:destroy   # remove only the seed records (and their bookings)
```

Both commands only touch the records listed in `scripts/seed-data.js`. Anything else that A or B creates in the shared database is left alone. Re-running `seed` resets the seed accounts to the passwords below, which is handy after testing reset password.

| Role | Email | Password |
|---|---|---|
| admin | `admin@dentist.com` | `admin123` |
| user | `user1@example.com` | `password123` |
| user | `user2@example.com` | `password123` |
| user | `user3@example.com` | `password123` |

There are 8 dentists. Two of them are `Orthodontics`, which is useful for testing expertise search. These are test-only credentials.

## Postman (T02)

Files are in `postman/`:

| File | What it is |
|---|---|
| `Dentist-Booking.postman_collection.json` | Requests grouped by folder (Auth so far) with test scripts |
| `Dentist-Booking-Local.postman_environment.json` | Variables: `baseURL`, `token`, `adminToken`, `userEmail`, `userPassword`, `adminEmail`, `adminPassword` |

**Setup**

1. In Postman, click **Import** and drop in both files.
2. Select the **Dentist Booking - Local** environment (top right).
3. Start the server (`npm run dev`) and run **Auth → Register**, then **Login (user)**.

**How tokens work**

- The collection uses `Authorization: Bearer {{token}}` by default, so new requests inherit it. Set a request's Auth to `{{adminToken}}` for admin-only routes.
- **Login (user)** saves the JWT to `{{token}}`. **Login (admin)** saves it to `{{adminToken}}`. Run `npm run seed` first to create that account.
- **Logout** clears `{{token}}`.
- **Register** generates a unique `userEmail` each time, so the **Collection Runner** can be run repeatedly.

When adding requests, put them in a folder for the resource (`Dentists`, `Bookings`, `Users`) and add a `pm.test` for the expected status code. Export the collection back to `postman/` (Collection → ⋯ → Export, v2.1) so it stays in git.

## Conventions

- **Base path:** `/api/v1/<resource>` (`auth`, `users`, `dentists`, `bookings`)
- **Success response:** `{ success: true, data, count? }`
- **Error response:** `{ success: false, message }`. Use `next(new ErrorResponse(msg, status))` and wrap controllers in `asyncHandler`.
- **Status codes:** 400 bad input, 401 not logged in, 403 wrong role or not the owner, 404 not found
- **Files:** controllers and routes are named after the resource in lowercase plural, e.g. `controllers/bookings.js`. Models use singular PascalCase, e.g. `models/Booking.js`.
- **Branches:** `<type>/tNN-short-name`, e.g. `feat/t06-register`. Types are `feat`, `fix`, `chore`, and `test`.
- **Commits:** `tNN: short description`, e.g. `t06: add register endpoint`
