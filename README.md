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

## Conventions

- **Base path:** `/api/v1/<resource>` (`auth`, `users`, `dentists`, `bookings`)
- **Success response:** `{ success: true, data, count? }`
- **Error response:** `{ success: false, message }`. Use `next(new ErrorResponse(msg, status))` and wrap controllers in `asyncHandler`.
- **Status codes:** 400 bad input, 401 not logged in, 403 wrong role or not the owner, 404 not found
- **Files:** controllers and routes are named after the resource in lowercase plural, e.g. `controllers/bookings.js`. Models use singular PascalCase, e.g. `models/Booking.js`.
- **Branches:** `<type>/tNN-short-name`, e.g. `feat/t06-register`. Types are `feat`, `fix`, `chore`, and `test`.
- **Commits:** `tNN: short description`, e.g. `t06: add register endpoint`
