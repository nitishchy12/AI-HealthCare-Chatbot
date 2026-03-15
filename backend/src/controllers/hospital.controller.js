const { pool } = require('../config/db');
const { clean } = require('../utils/sanitize');

const getByCity = async (req, res, next) => {
  try {
    const city = clean(req.query.city || '');
    const specialization = clean(req.query.specialization || '');
    if (!city) return next({ statusCode: 400, message: 'City query is required' });

    const result = await pool.query(
      `SELECT * FROM hospitals
       WHERE LOWER(city) = LOWER($1)
       AND ($2 = '' OR LOWER(specialization) LIKE LOWER('%' || $2 || '%'))
       ORDER BY rating DESC, name ASC`,
      [city, specialization]
    );
    return res.status(200).json({ success: true, message: 'Hospitals fetched', data: result.rows });
  } catch (error) {
    return next(error);
  }
};

const addHospital = async (req, res, next) => {
  try {
    const payload = {
      name: clean(req.body.name),
      city: clean(req.body.city),
      address: clean(req.body.address),
      phone: clean(req.body.phone || ''),
      latitude: clean(req.body.latitude || ''),
      longitude: clean(req.body.longitude || ''),
      rating: req.body.rating || 4.2,
      specialization: clean(req.body.specialization || 'General Physician')
    };

    const result = await pool.query(
      'INSERT INTO hospitals (name, city, address, phone, latitude, longitude, rating, specialization) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *',
      [payload.name, payload.city, payload.address, payload.phone, payload.latitude, payload.longitude, payload.rating, payload.specialization]
    );

    return res.status(201).json({ success: true, message: 'Hospital added successfully', data: result.rows[0] });
  } catch (error) {
    return next(error);
  }
};

module.exports = { getByCity, addHospital };
