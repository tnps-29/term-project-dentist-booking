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
  bookingPdf.js        appointment confirmation PDF (PDFKit)
assets/fonts/          Sarabun font (SIL OFL 1.1) embedded in PDFs for Thai text
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
| `resetPasswordToken`, `resetPasswordExpire` | String, Date | hidden, used by reset password|

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
| `reminderSent` | Boolean | default `false`, set when the reminder email is sent|

The one-booking-per-user limit is enforced in the booking controller (T12), not in the schema, so admins aren't blocked by it. All models have `createdAt` / `updatedAt`.

## API endpoints

Base URL: `http://localhost:5001/api/v1`

| Method | Path | Access | Body | Response |
|---|---|---|---|---|---|
| POST | `/auth/register` | Public | `{ name, tel, email, password }` | `201 { success, data: { _id, name, tel, email, role, createdAt } }` |
| POST | `/auth/login` | Public | `{ email, password }` | `200 { success, _id, name, email, role, token }` + `token` cookie |
| GET | `/auth/logout` | Public | – | `200 { success, data: {} }`, `token` cookie cleared |
| GET | `/auth/me` | Logged in | – | `200 { success, data: user }` (no password) |
| POST | `/auth/forgotpassword` | Public | `{ email }` | `200 { success, message }` (same for unknown emails) |
| PUT | `/auth/resetpassword/:token` | Public | `{ password }` | `200 { success, _id, name, email, role, token }` + `token` cookie |
| GET / POST | `/auth/resetpassword/:token` | Public | form: `password`, `confirmPassword` | HTML form opened from the email link |
| GET | `/bookings/:id/pdf` | Owner or admin | – | `200` PDF (`application/pdf`), add `?download=true` to save as a file |
| POST | `/reminders/run` | Admin | – | `200 { success, data: { checked, sent, failed, skipped } }` |

Register always creates a `user`; `role` in the body is ignored (admins come from the seed script). Passwords are hashed with bcrypt before saving. A duplicate email returns `400 Email is already registered`.

**Authentication:** login returns a JWT in the body and also sets it as an httpOnly `token` cookie. Send it on protected routes as `Authorization: Bearer <token>`. A missing email or password returns `400`. A wrong password or unknown email returns `401 Invalid credentials`. JWT settings (`JWT_SECRET`, `JWT_EXPIRE`, `JWT_COOKIE_EXPIRE`) live in `config/config.env`.

**Logout** replaces the cookie with `token=none`. JWTs are stateless, so a Bearer token stays valid until it expires. Clients such as Postman should also clear their stored token.

**Reset password:** `POST /auth/forgotpassword` emails a reset link (via `sendEmail`) and always answers `200` with the same message, so it can't reveal which emails are registered. Only a sha256 hash of the token is stored, it expires after 10 minutes, and it works once. The email (in Thai) contains a link `GET {API_URL}/api/v1/auth/resetpassword/<token>` that opens a plain HTML form (no JavaScript, because of helmet's CSP).

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

`utils/sendEmail.js` is shared by reset password and appointment reminders:

```js
const sendEmail = require('../utils/sendEmail');
await sendEmail({ email: user.email, subject: 'Subject', message: 'Plain-text body' });
```

Set `SMTP_HOST`, `SMTP_PORT`, `SMTP_EMAIL`, `SMTP_PASSWORD`, `FROM_NAME` and `FROM_EMAIL` in `config/config.env` (see `config.env.example`). Port 465 uses TLS. Other ports use STARTTLS. If `SMTP_HOST` is empty, nothing is sent and the email is printed to the console instead, which is enough for development. To see real emails without spamming anyone, use a sandbox inbox such as Mailtrap. `sendEmail` rejects when SMTP fails, so callers should catch the error.

## Appointment PDF

`GET /bookings/:id/pdf` returns a one-page A4 appointment confirmation in English. It shows the appointment date and time in Bangkok time, the patient, the dentist and the booking ID. `utils/bookingPdf.js` builds it with PDFKit.

- Only the booking owner or an admin can download it. Others get `403`, no token gets `401`, an unknown booking gets `404` and a malformed id gets `400`.
- It is sent with `Content-Disposition: inline`, so a browser should open it rather than save it. `?download=true` sends it as an attachment named `booking-<id>.pdf`.
- Labels are English, but names and expertise may be Thai. PDFKit's built-in Helvetica has no Thai glyphs, so the PDF embeds Sarabun from `assets/fonts/` (SIL Open Font License, see `assets/fonts/OFL.txt`).
- **Postman:** send the request, then use **Save Response > Save to a file**, or open the URL in a browser while logged in (the `token` cookie works).

## Appointment reminders

`jobs/reminder.js` emails each user (in Thai) about their upcoming booking. The email includes the dentist and the date and time in Bangkok time.

- **Cron:** started by `server.js`. `REMINDER_CRON` in `config.env` overrides the schedule (cron syntax, 6 fields for seconds), or set it to `off` to disable it. The cron only starts when `SMTP_HOST` is set. Without SMTP, a local server would mark bookings in the shared database as reminded while only printing the emails to its console.
- **No duplicates:** `Booking.reminderSent` marks a booking as reminded. Each booking is claimed atomically before its email goes out, so two runs at once (the cron plus a manual run, or two servers on the shared database) never send the same reminder twice. If sending fails, the flag goes back to `false` and the next run retries.
- **Rescheduling:** a hook in `models/Booking.js` resets `reminderSent` to `false` whenever `date` changes, through `PUT /bookings/:id` or any other update, so the new time gets its own reminder.
- **Manual run:** `POST /reminders/run` (admin) runs the same job right away and returns counts. `skipped` counts bookings whose user or dentist no longer exists. It works without SMTP too, in which case the emails are printed to the console.

> **Shared database warning:** in demo mode the first run reminds *every* future booking in the database, including B's and the `@example.com` test users (Gmail sends those back as bounces). The bookings it reminds are marked `reminderSent`, so they won't get a 24-hour reminder later. Keep `REMINDER_CRON=off` on machines that aren't doing the email demo.

**Testing from Postman:** create a booking. With the cron running, the email arrives within about 10 seconds. Without the cron, call `POST /reminders/run` as admin and expect `sent: 1`, then call it again and expect `sent: 0`.

## Seed data

```bash
npm run seed           # create or refresh the test accounts and dentists (safe to re-run)
npm run seed:destroy   # remove only the seed records (and their bookings)
```

## Postman

Files are in `postman/`:

| File | What it is |
|---|---|
| `Dentist Booking API.postman_collection.json` | Presentation Demo and Extra Credits Demo folders with test scripts |
| `Dentist-Booking-Local.postman_environment.json` | Variables: `baseURL`, `token`, `adminToken`, `userEmail`, `userPassword`, `adminEmail`, `adminPassword` |

**Setup**

1. Run `npm run seed` to create the admin account (`admin@dentist.com`).
2. In Postman, click **Import** and drop in both files.
3. Select the **Dentist Booking - Local** environment (top right).
4. Start the server with `npm run dev`.

The collection has two folders. Run either one on its own: select it and click **Run**, keeping the order. Both are repeatable because every run registers new users.

To send requests one at a time instead, go top to bottom. Booking dates are filled in by the collection's pre-request script, so any request has a valid future date. Ids and tokens still come from earlier requests: log in before booking, and create a booking (4.1, 6.1) before the requests that use it. Sent alone, "4.2 Second booking" is the user's first booking and returns 201.

**Presentation Demo** (live demo, all automated)

| Step | Requests |
|---|---|
| 0. Setup | another user registers and books, so the user can be shown that they can't touch other people's bookings, and the admin has a booking to manage |
| 1. User Registration + Validation Check | register 201; duplicate email, missing fields, invalid email, invalid telephone and short password give 400; `role: admin` is ignored |
| 2. User Log-in | log in 200 (token + httpOnly cookie), wrong password 401, missing password 400, `/me` |
| 3. User View Product | all dentists, one dentist, unknown dentist 404; `select` + `sort`, `page` + `limit`, `yearsOfExperience[gte]=10` |
| 4. User Create Booking | create 201. **Check Create Condition:** second booking 400, not logged in 401, unknown dentist 404, missing date 400, invalid date format 400 |
| 5. User View Own Booking | sees only their own booking; another user's booking 403 |
| 6. User Edit Own Booking | edit 200 (`reminderSent` reset); another user's booking 403 |
| 7. User Delete Own Booking | another user's booking 403, delete own 200, then 404 |
| 8. User Log-out | log out, `/me` afterwards 401 |
| 9. Admin Log-in | admin logs in |
| 10. Admin View Any Booking | all bookings, one booking, bookings of one dentist |
| 11. Admin Edit Any Booking | edits the other user's booking |
| 12. Admin Delete Any Booking | deletes it, then 404; cascade: admin adds a dentist, another user books it, admin deletes the dentist, the booking is gone (404) |

**Extra Credits Demo** (extra credit features)

| Step | Requests |
|---|---|
| 0. Setup | admin logs in; registers a patient and another user; real_user1 (from `npm run seed`) logs in |
| 1. Admin views all users | admin 200 without passwords, normal user 403, not logged in 401 |
| 2. Reset password via emailed link | forgot password (generic 200 for any email, missing email 400), wrong token 400, wrong link page 400, reset with the emailed token, same token again 400 |
| 3. Search dentists by expertise | `?expertise=ortho`, `?expertise=SURGERY`, no match |
| 4. Reminder email | real_user1 books; the cron emails it within about 10 seconds, or admin runs the job now (401, 403, admin 200); the booking is then marked `reminderSent` |
| 5. Search dentists by name | `?name=dentist_1`, `?name=DENT`, no match, `.*` treated as text |
| 6. Admin issues the appointment PDF | patient books; admin PDF inline and `?download=true`; owner 200, another user 403, not logged in 401, not found 404; booking deleted |

Two steps stay manual (set in the collection's **Variables** tab):

1. `runReminders`: `true` runs 4.4 and 4.5. Step 4.4 runs the job immediately and emails *every* booking it finds due, including other people's on the shared database.
2. Open the reset link in a browser to reset with the form, or copy the 40-character token from the end of the link into `resetToken` and run the folder again. Step 2.6 resets the password to `newPassword` and updates `realUserPassword`. While `resetToken` is set, step 2.1 is skipped so it doesn't send a new email that would replace the token.

The Presentation Demo uses `@example.com` users only. If the server's reminder cron is running, their bookings are still emailed and bounce.

## Conventions

- **Base path:** `/api/v1/<resource>` (`auth`, `users`, `dentists`, `bookings`)
- **Success response:** `{ success: true, data, count? }`
- **Error response:** `{ success: false, message }`. Use `next(new ErrorResponse(msg, status))` and wrap controllers in `asyncHandler`.
- **Status codes:** 400 bad input, 401 not logged in, 403 wrong role or not the owner, 404 not found
- **Files:** controllers and routes are named after the resource in lowercase plural, e.g. `controllers/bookings.js`. Models use singular PascalCase, e.g. `models/Booking.js`.
- **Branches:** `<type>/tNN-short-name`, e.g. `feat/t06-register`. Types are `feat`, `fix`, `chore`, and `test`.
- **Commits:** `tNN: short description`, e.g. `t06: add register endpoint`
