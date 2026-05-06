const { pool } = require('../config/db');
const { clean } = require('../utils/sanitize');
const { logAuditAction } = require('../utils/audit');
const { getCachedOrFetch, del } = require('../utils/redisCache');

const cityKey  = (city, spec) => `hospitals:city:${city.toLowerCase()}:${spec.toLowerCase()}`;
const CACHE_TTL = 300;

const normalizeHospital = (row = {}) => {
  const specialties = Array.isArray(row.specialties) && row.specialties.length
    ? row.specialties
    : String(row.specialization || 'General Physician')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);

  return {
    ...row,
    specialties,
    specialty: row.specialization || specialties[0] || 'General Physician',
    emergency_24h: Boolean(row.emergency_24h),
  };
};

/* GET /api/hospitals?city=X&specialization=Y&page=N ─────────────── */
const getByCity = async (req, res, next) => {
  try {
    const city           = clean(req.query.city || '');
    const specialization = clean(req.query.specialization || req.query.specialty || '');
    const page           = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit          = Math.min(50, parseInt(req.query.limit, 10) || 20);
    const offset         = (page - 1) * limit;

    const cacheKey = cityKey(city, specialization) + `:${page}:${limit}`;
    const result = await getCachedOrFetch(cacheKey, CACHE_TTL, async () => {
      const [rows, count] = await Promise.all([
        pool.query(
          `SELECT id, name, city, address, phone, latitude, longitude,
                  rating, specialization, emergency_24h, created_at,
                  CASE
                    WHEN to_regclass('public.hospitals') IS NOT NULL
                    THEN COALESCE(specialties, ARRAY[specialization])
                    ELSE ARRAY[specialization]
                  END AS specialties
           FROM hospitals
           WHERE ($1 = '' OR LOWER(city) = LOWER($1))
             AND ($2 = '' OR LOWER(specialization) LIKE LOWER('%' || $2 || '%'))
           ORDER BY rating DESC, name ASC
           LIMIT $3 OFFSET $4`,
          [city, specialization, limit, offset],
        ),
        pool.query(
          `SELECT COUNT(*) FROM hospitals
           WHERE ($1 = '' OR LOWER(city) = LOWER($1))
             AND ($2 = '' OR LOWER(specialization) LIKE LOWER('%' || $2 || '%'))`,
          [city, specialization],
        ),
      ]);
      return { data: rows.rows.map(normalizeHospital), total: parseInt(count.rows[0].count, 10) };
    });

    res.setHeader('Cache-Control', 'public, max-age=300');
    return res.status(200).json({
      success: true,
      message: 'Hospitals fetched',
      data:    result.data,
      pagination: { page, limit, total: result.total },
    });
  } catch (error) {
    return next(error);
  }
};

/* GET /api/hospitals/nearby?lat=X&lng=Y&radius=50&specialty=Z ──── */
const getNearby = async (req, res, next) => {
  try {
    const lat      = parseFloat(req.query.lat);
    const lng      = parseFloat(req.query.lng);
    const radius   = Math.min(200, parseFloat(req.query.radius) || 50);
    const specialty = clean(req.query.specialty || '');

    if (isNaN(lat) || isNaN(lng)) {
      return next({ statusCode: 400, message: 'lat and lng are required and must be numbers' });
    }

    const result = await pool.query(
      `SELECT *
       FROM (
         SELECT id, name, city, address, phone, latitude, longitude,
                rating, specialization, emergency_24h,
                COALESCE(specialties, ARRAY[specialization]) AS specialties,
                ROUND(
                  6371 * acos(
                    GREATEST(-1, LEAST(1,
                      cos(radians($1)) * cos(radians(latitude::float))
                      * cos(radians(longitude::float) - radians($2))
                      + sin(radians($1)) * sin(radians(latitude::float))
                    ))
                  )::numeric, 1
                ) AS distance_km
         FROM hospitals
         WHERE latitude IS NOT NULL AND longitude IS NOT NULL
           AND latitude::float BETWEEN -90 AND 90
           AND longitude::float BETWEEN -180 AND 180
           AND ($3 = '' OR LOWER(specialization) LIKE LOWER('%' || $3 || '%')
                OR EXISTS (
                  SELECT 1 FROM unnest(COALESCE(specialties, ARRAY[specialization])) AS s
                  WHERE LOWER(s) LIKE LOWER('%' || $3 || '%')
                ))
       ) ranked
       WHERE distance_km <= $4
       ORDER BY distance_km ASC, rating DESC
       LIMIT 20`,
      [lat, lng, specialty, radius],
    );

    return res.status(200).json({
      success: true,
      message: 'Nearby hospitals fetched',
      data:    result.rows.map(normalizeHospital),
    });
  } catch (error) {
    return next(error);
  }
};

/* POST /api/hospitals ──────────────────────────────────────────── */
const addHospital = async (req, res, next) => {
  try {
    const payload = {
      name:          clean(req.body.name),
      city:          clean(req.body.city),
      address:       clean(req.body.address),
      phone:         clean(req.body.phone || ''),
      latitude:      clean(req.body.latitude  || ''),
      longitude:     clean(req.body.longitude || ''),
      rating:        req.body.rating || 4.2,
      specialization: clean(req.body.specialization || 'General Physician'),
      emergency_24h: Boolean(req.body.emergency_24h),
    };

    const result = await pool.query(
      `INSERT INTO hospitals
         (name, city, address, phone, latitude, longitude, rating, specialization, emergency_24h)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       RETURNING *`,
      [payload.name, payload.city, payload.address, payload.phone,
       payload.latitude, payload.longitude, payload.rating,
       payload.specialization, payload.emergency_24h],
    );

    await del(cityKey(payload.city, ''), cityKey(payload.city, payload.specialization));
    await logAuditAction({
      userId: req.user.id, role: req.user.role,
      action: 'CREATE', entityType: 'hospital',
      entityId: result.rows[0].id,
      details: { name: result.rows[0].name, city: result.rows[0].city },
    });

    return res.status(201).json({ success: true, message: 'Hospital added', data: result.rows[0] });
  } catch (error) {
    return next(error);
  }
};

/* PUT /api/hospitals/:id ───────────────────────────────────────── */
const updateHospital = async (req, res, next) => {
  try {
    const payload = {
      name:          clean(req.body.name),
      city:          clean(req.body.city),
      address:       clean(req.body.address),
      phone:         clean(req.body.phone || ''),
      latitude:      clean(req.body.latitude  || ''),
      longitude:     clean(req.body.longitude || ''),
      rating:        req.body.rating || 4.2,
      specialization: clean(req.body.specialization || 'General Physician'),
      emergency_24h: Boolean(req.body.emergency_24h),
    };

    const result = await pool.query(
      `UPDATE hospitals
       SET name=$1, city=$2, address=$3, phone=$4,
           latitude=$5, longitude=$6, rating=$7,
           specialization=$8, emergency_24h=$9
       WHERE id=$10 RETURNING *`,
      [payload.name, payload.city, payload.address, payload.phone,
       payload.latitude, payload.longitude, payload.rating,
       payload.specialization, payload.emergency_24h, req.params.id],
    );

    if (result.rowCount === 0) return next({ statusCode: 404, message: 'Hospital not found' });

    await logAuditAction({
      userId: req.user.id, role: req.user.role,
      action: 'UPDATE', entityType: 'hospital',
      entityId: result.rows[0].id,
      details: { name: result.rows[0].name },
    });

    return res.status(200).json({ success: true, message: 'Hospital updated', data: result.rows[0] });
  } catch (error) {
    return next(error);
  }
};

/* DELETE /api/hospitals/:id ────────────────────────────────────── */
const deleteHospital = async (req, res, next) => {
  try {
    const result = await pool.query('DELETE FROM hospitals WHERE id=$1 RETURNING id', [req.params.id]);
    if (result.rowCount === 0) return next({ statusCode: 404, message: 'Hospital not found' });

    await logAuditAction({
      userId: req.user.id, role: req.user.role,
      action: 'DELETE', entityType: 'hospital',
      entityId: req.params.id,
    });

    return res.status(200).json({ success: true, message: 'Hospital deleted', data: { id: req.params.id } });
  } catch (error) {
    return next(error);
  }
};

module.exports = { getByCity, getNearby, addHospital, updateHospital, deleteHospital };
