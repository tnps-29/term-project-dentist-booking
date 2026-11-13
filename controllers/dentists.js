const Dentist = require('../models/Dentist');
//Register the Booking model so the Dentist pre('deleteOne') hook can use it
require('../models/Booking');

//Escape special regex characters so user input is searched as plain text
//e.g. "Dr. (Som)" will not break the regex
const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

//@desc Get all dentists (search by ?name= and ?expertise=)
//@route GET /api/v1/dentists
//@access Public
exports.getDentists = async (req, res, next) => {
    let query;

    //Copy req.query
    const reqQuery = { ...req.query };

    //Fields to exclude (name and expertise are handled as regex search below)
    const removeFields = ['select', 'sort', 'page', 'limit', 'name', 'expertise'];

    //Loop over remove fields and delete them from reqQuery
    removeFields.forEach(param => delete reqQuery[param]);

    //Create query string (gt, gte, lt, lte, in)
    let queryStr = JSON.stringify(reqQuery);
    queryStr = queryStr.replace(/\b(gt|gte|lt|lte|in)\b/g, match => `$${match}`);

    //Use the same filter for both find and count
    const filter = JSON.parse(queryStr);

    //Search by name: GET /dentists?name=som  (case-insensitive, partial match)
    if (typeof req.query.name === 'string' && req.query.name.trim()) {
        filter.name = { $regex: escapeRegex(req.query.name.trim()), $options: 'i' };
    }

    //Search by area of expertise: GET /dentists?expertise=ortho  (case-insensitive, partial match)
    if (typeof req.query.expertise === 'string' && req.query.expertise.trim()) {
        filter.expertise = { $regex: escapeRegex(req.query.expertise.trim()), $options: 'i' };
    }

    query = Dentist.find(filter);

    //Select Fields (default: name, yearsOfExperience, expertise)
    if (req.query.select) {
        const fields = req.query.select.split(',').join(' ');
        query = query.select(fields);
    } else {
        query = query.select('name yearsOfExperience expertise');
    }

    //Sort
    if (req.query.sort) {
        const sortBy = req.query.sort.split(',').join(' ');
        query = query.sort(sortBy);
    } else {
        query = query.sort('-createdAt');
    }

    //Pagination
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 25;
    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;

    try {
        const total = await Dentist.countDocuments(filter);
        query = query.skip(startIndex).limit(limit);

        //Executing query
        const dentists = await query;

        //Pagination result
        const pagination = {};

        if (endIndex < total) {
            pagination.next = { page: page + 1, limit };
        }

        if (startIndex > 0) {
            pagination.prev = { page: page - 1, limit };
        }

        res.status(200).json({ success: true, count: dentists.length, pagination, data: dentists });
    } catch (err) {
        console.log(err);
        res.status(400).json({ success: false, message: err.message });
    }
};

//@desc Get single dentist
//@route GET /api/v1/dentists/:id
//@access Public
exports.getDentist = async (req, res, next) => {
    try {
        const dentist = await Dentist.findById(req.params.id).select('name yearsOfExperience expertise');

        if (!dentist) {
            return res.status(404).json({ success: false, message: `Dentist not found with id of ${req.params.id}` });
        }

        res.status(200).json({ success: true, data: dentist });
    } catch (err) {
        console.log(err);
        res.status(400).json({ success: false, message: err.message });
    }
};

//@desc Create a dentist
//@route POST /api/v1/dentists
//@access Private
exports.createDentist = async (req, res, next) => {
    try {
        const { name, yearsOfExperience, expertise } = req.body;

        const dentist = await Dentist.create({ name, yearsOfExperience, expertise });

        res.status(201).json({ success: true, data: dentist });
    } catch (err) {
        console.log(err);
        res.status(400).json({ success: false, message: err.message });
    }
};

//@desc Update single dentist
//@route PUT /api/v1/dentists/:id
//@access Private
exports.updateDentist = async (req, res, next) => {
    try {
        //Allow updating only these fields
        const { name, yearsOfExperience, expertise } = req.body;
        const updates = {};
        if (name !== undefined) updates.name = name;
        if (yearsOfExperience !== undefined) updates.yearsOfExperience = yearsOfExperience;
        if (expertise !== undefined) updates.expertise = expertise;

        const dentist = await Dentist.findByIdAndUpdate(req.params.id, updates, {
            new: true,
            runValidators: true
        });

        if (!dentist) {
            return res.status(404).json({ success: false, message: `Dentist not found with id of ${req.params.id}` });
        }

        res.status(200).json({ success: true, data: dentist });
    } catch (err) {
        console.log(err);
        res.status(400).json({ success: false, message: err.message });
    }
};

//@desc Delete single dentist
//@route DELETE /api/v1/dentists/:id
//@access Private
exports.deleteDentist = async (req, res, next) => {
    try {
        const dentist = await Dentist.findById(req.params.id);

        if (!dentist) {
            return res.status(404).json({ success: false, message: `Dentist not found with id of ${req.params.id}` });
        }

        //Document-level deleteOne triggers the model's pre('deleteOne') hook,
        //which also deletes all bookings of this dentist
        await dentist.deleteOne();

        res.status(200).json({ success: true, data: {} });
    } catch (err) {
        console.log(err);
        res.status(400).json({ success: false, message: err.message });
    }
};