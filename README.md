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

Register always creates a `user`; `role` in the body is ignored (admins come from the seed script, T17). Passwords are hashed with bcrypt before saving. A duplicate email returns `400 Email is already registered`.

**Authentication (T07):** login returns a JWT in the body and also sets it as an httpOnly `token` cookie. Send it on protected routes as `Authorization: Bearer <token>`. A missing email or password returns `400`. A wrong password or unknown email returns `401 Invalid credentials`. JWT settings (`JWT_SECRET`, `JWT_EXPIRE`, `JWT_COOKIE_EXPIRE`) live in `config/config.env`.

**Logout (T08)** replaces the cookie with `token=none`. JWTs are stateless, so a Bearer token stays valid until it expires. Clients such as Postman should also clear their stored token.

### Protecting routes (T09)

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

## Seed data (T17)

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
