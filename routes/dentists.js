const express = require('express');
const router = express.Router();
const {getDentists,getDentist,createDentist,updateDentist,deleteDentist} = require('../controllers/dentists');

//Include other resource routers
const bookingRouter = require('./bookings');

const { protect, authorize } = require('../middleware/auth');

//Re-route into other resource routers
router.use('/:dentistId/bookings/',bookingRouter);

//Dentist list (Public) + Create (Admin only)
router.route('/').get(getDentists).post(protect, authorize('admin'), createDentist);

//Single dentist (Public) + Update/Delete (Admin only)
router.route('/:id').get(getDentist).put(protect, authorize('admin'), updateDentist).delete(protect, authorize('admin'), deleteDentist);

module.exports = router;