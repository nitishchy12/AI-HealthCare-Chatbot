const { pool } = require('../config/db');
const { clean } = require('../utils/sanitize');
const { logAuditAction } = require('../utils/audit');

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

    await logAuditAction({
      userId: req.user.id,
      role: req.user.role,
      action: 'CREATE',
      entityType: 'hospital',
      entityId: result.rows[0].id,
      details: { name: result.rows[0].name, city: result.rows[0].city }
    });

    return res.status(201).json({ success: true, message: 'Hospital added successfully', data: result.rows[0] });
  } catch (error) {
    return next(error);
  }
};

const updateHospital = async (req, res, next) => {
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
      `UPDATE hospitals
       SET name = $1, city = $2, address = $3, phone = $4, latitude = $5, longitude = $6, rating = $7, specialization = $8
       WHERE id = $9
       RETURNING *`,
      [payload.name, payload.city, payload.address, payload.phone, payload.latitude, payload.longitude, payload.rating, payload.specialization, req.params.id]
    );

    if (result.rowCount === 0) return next({ statusCode: 404, message: 'Hospital not found' });
    await logAuditAction({
      userId: req.user.id,
      role: req.user.role,
      action: 'UPDATE',
      entityType: 'hospital',
      entityId: result.rows[0].id,
      details: { name: result.rows[0].name, city: result.rows[0].city }
    });
    return res.status(200).json({ success: true, message: 'Hospital updated', data: result.rows[0] });
  } catch (error) {
    return next(error);
  }
};

const deleteHospital = async (req, res, next) => {
  try {
    const result = await pool.query('DELETE FROM hospitals WHERE id = $1 RETURNING id', [req.params.id]);
    if (result.rowCount === 0) return next({ statusCode: 404, message: 'Hospital not found' });
    await logAuditAction({
      userId: req.user.id,
      role: req.user.role,
      action: 'DELETE',
      entityType: 'hospital',
      entityId: req.params.id
    });
    return res.status(200).json({ success: true, message: 'Hospital deleted', data: { id: req.params.id } });
  } catch (error) {
    return next(error);
  }
};

module.exports = { getByCity, addHospital, updateHospital, deleteHospital };
