const Booking = require('../models/Booking');
const Dentist = require('../models/Dentist');

//@desc Get all bookings
//@route GET /api/v1/bookings
//@route GET /api/v1/dentists/:dentistId/bookings
//@access Private
exports.getBookings = async (req, res, next) => {
    let query;

    //General users can see only their bookings!
    if (req.user.role !== 'admin') {
        query = Booking.find({ user: req.user.id });
    } else { //If you are an admin, you can see all!
        if (req.params.dentistId) {
            query = Booking.find({ dentist: req.params.dentistId });
        } else {
            query = Booking.find();
        }
    }

    query = query
        .populate({ path: 'dentist', select: 'name yearsOfExperience expertise' })
        .sort('date');

    try {
        const bookings = await query;

        res.status(200).json({
            success: true,
            count: bookings.length,
            data: bookings
        });
    } catch (error) {
        console.log(error);
        return res.status(500).json({ success: false, message: 'Cannot find Booking' });
    }
};

//@desc Get single booking
//@route GET /api/v1/bookings/:id
//@access Private
exports.getBooking = async (req, res, next) => {
    try {
        const booking = await Booking.findById(req.params.id).populate({
            path: 'dentist',
            select: 'name yearsOfExperience expertise'
        });

        if (!booking) {
            return res.status(404).json({ success: false, message: `No booking with the id of ${req.params.id}` });
        }

        //Make sure user is the booking owner
        if (booking.user.toString() !== req.user.id && req.user.role !== 'admin') {
            return res.status(401).json({ success: false, message: `User ${req.user.id} is not authorized to view this booking` });
        }

        res.status(200).json({ success: true, data: booking });
    } catch (error) {
        console.log(error);
        return res.status(500).json({ success: false, message: 'Cannot find Booking' });
    }
};

//@desc Add booking
//@route POST /api/v1/bookings
//@route POST /api/v1/dentists/:dentistId/bookings
//@access Private
exports.addBooking = async (req, res, next) => {
    try {
        //Dentist can come from the URL or from the body
        const dentistId = req.params.dentistId || req.body.dentist;

        if (!dentistId) {
            return res.status(400).json({ success: false, message: 'Please choose a dentist' });
        }

        const dentist = await Dentist.findById(dentistId);

        if (!dentist) {
            return res.status(404).json({ success: false, message: `No dentist with the id of ${dentistId}` });
        }

        //Check for existed booking
        const existedBooking = await Booking.findOne({ user: req.user.id });

        //If the user is not an admin, they can only create 1 booking
        if (existedBooking && req.user.role !== 'admin') {
            return res.status(400).json({ success: false, message: `The user with ID ${req.user.id} has already made a booking` });
        }

        //Take only allowed fields; user always comes from the token
        const booking = await Booking.create({
            date: req.body.date,
            dentist: dentistId,
            user: req.user.id
        });

        res.status(201).json({ success: true, data: booking });
    } catch (error) {
        console.log(error);
        if (error.name === 'ValidationError' || error.name === 'CastError') {
            return res.status(400).json({ success: false, message: error.message });
        }
        return res.status(500).json({ success: false, message: 'Cannot create Booking' });
    }
};

//@desc Update booking
//@route PUT /api/v1/bookings/:id
//@access Private
exports.updateBooking = async (req, res, next) => {
    try {
        let booking = await Booking.findById(req.params.id);

        if (!booking) {
            return res.status(404).json({ success: false, message: `No booking with the id of ${req.params.id}` });
        }

        //Make sure user is the booking owner
        if (booking.user.toString() !== req.user.id && req.user.role !== 'admin') {
            return res.status(401).json({ success: false, message: `User ${req.user.id} is not authorized to update this booking` });
        }

        //Allow updating only date and dentist (not user)
        const updates = {};
        if (req.body.date !== undefined) updates.date = req.body.date;

        if (req.body.dentist !== undefined) {
            const dentist = await Dentist.findById(req.body.dentist);
            if (!dentist) {
                return res.status(404).json({ success: false, message: `No dentist with the id of ${req.body.dentist}` });
            }
            updates.dentist = req.body.dentist;
        }

        booking = await Booking.findByIdAndUpdate(req.params.id, updates, {
            new: true,
            runValidators: true
        }).populate({ path: 'dentist', select: 'name yearsOfExperience expertise' });

        res.status(200).json({ success: true, data: booking });
    } catch (error) {
        console.log(error);
        if (error.name === 'ValidationError' || error.name === 'CastError') {
            return res.status(400).json({ success: false, message: error.message });
        }
        return res.status(500).json({ success: false, message: 'Cannot update Booking' });
    }
};

//@desc Delete booking
//@route DELETE /api/v1/bookings/:id
//@access Private
exports.deleteBooking = async (req, res, next) => {
    try {
        const booking = await Booking.findById(req.params.id);

        if (!booking) {
            return res.status(404).json({ success: false, message: `No booking with the id of ${req.params.id}` });
        }

        //Make sure user is the booking owner
        if (booking.user.toString() !== req.user.id && req.user.role !== 'admin') {
            return res.status(401).json({ success: false, message: `User ${req.user.id} is not authorized to delete this booking` });
        }

        await booking.deleteOne();

        res.status(200).json({ success: true, data: {} });
    } catch (error) {
        console.log(error);
        return res.status(500).json({ success: false, message: 'Cannot delete Booking' });
    }
};