const { pool } = require('../config/db');
const { clean } = require('../utils/sanitize');

const getProfile = async (req, res, next) => {
  try {
    const result = await pool.query(
      'SELECT id, name, email, role, age, gender, medical_notes, city, created_at FROM users WHERE id = $1',
      [req.user.id]
    );
    return res.status(200).json({ success: true, message: 'Profile fetched', data: result.rows[0] });
  } catch (error) {
    return next(error);
  }
};

const updateProfile = async (req, res, next) => {
  try {
    const payload = {
      name: clean(req.body.name),
      age: req.body.age || null,
      gender: clean(req.body.gender || ''),
      medicalNotes: clean(req.body.medical_notes || ''),
      city: clean(req.body.city || '')
    };

    const result = await pool.query(
      `UPDATE users
       SET name = $1, age = $2, gender = $3, medical_notes = $4, city = $5
       WHERE id = $6
       RETURNING id, name, email, role, age, gender, medical_notes, city, created_at`,
      [payload.name, payload.age, payload.gender || null, payload.medicalNotes || null, payload.city || null, req.user.id]
    );

    return res.status(200).json({ success: true, message: 'Profile updated', data: result.rows[0] });
  } catch (error) {
    return next(error);
  }
};

module.exports = { getProfile, updateProfile };
