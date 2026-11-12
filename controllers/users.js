const User = require('../models/User');

//@desc Get all registered users
//@route GET /api/v1/users
//@access Private (Admin only)
exports.getUsers = async (req, res, next) => {
    let query;

    //Copy req.query
    const reqQuery = { ...req.query };

    //Fields to exclude
    const removeFields = ['select', 'sort', 'page', 'limit'];

    //Loop over remove fields and delete them from reqQuery
    removeFields.forEach(param => delete reqQuery[param]);

    //Never allow filtering by password
    delete reqQuery.password;

    //Create query string (gt, gte, lt, lte, in)
    let queryStr = JSON.stringify(reqQuery);
    queryStr = queryStr.replace(/\b(gt|gte|lt|lte|in)\b/g, match => `$${match}`);

    //Use the same filter for both find and count
    const filter = JSON.parse(queryStr);
    query = User.find(filter);

    //Select Fields (password is always removed, even if requested)
    if (req.query.select) {
        const fields = req.query.select
            .split(',')
            .map(field => field.trim())
            .filter(field => field && field !== 'password' && field !== '+password')
            .join(' ');
        query = query.select(fields || '-password');
    } else {
        query = query.select('-password');
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
        const total = await User.countDocuments(filter);
        query = query.skip(startIndex).limit(limit);

        //Executing query
        const users = await query;

        //Pagination result
        const pagination = {};

        if (endIndex < total) {
            pagination.next = { page: page + 1, limit };
        }

        if (startIndex > 0) {
            pagination.prev = { page: page - 1, limit };
        }

        res.status(200).json({ success: true, count: users.length, total, pagination, data: users });
    } catch (err) {
        console.log(err);
        res.status(400).json({ success: false, message: err.message });
    }
};