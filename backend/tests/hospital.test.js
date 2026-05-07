process.env.JWT_SECRET = 'test-secret';
process.env.FRONTEND_URL = 'http://localhost:5173';
process.env.NODE_ENV = 'test';

const request = require('supertest');

const mockQuery = jest.fn();

jest.mock('../src/config/db', () => ({
  pool: { query: mockQuery },
  getDbHealth: () => ({ postgres: true, mongo: true }),
}));

jest.mock('../src/services/session.service', () => ({
  createSession: async () => 'mock-refresh',
  findSession: async () => null,
  rotateSession: async () => 'new-refresh',
  revokeSession: async () => {},
  revokeAllSessions: async () => {},
}));

const app = require('../src/app');

// LPU / Phagwara area coordinates
const LPU_LAT = 31.2548;
const LPU_LNG = 75.7058;

const PHAGWARA_HOSPITALS = [
  {
    id: 1,
    name: 'Civil Hospital Phagwara',
    city: 'Phagwara',
    address: 'GT Road, Phagwara',
    phone: '9880000001',
    latitude: '31.2243',
    longitude: '75.7706',
    rating: 4.0,
    specialization: 'General Physician',
    specialties: ['General Physician', 'Emergency Care'],
    emergency_24h: true,
    distance_km: '7.2',
  },
  {
    id: 2,
    name: 'Guru Nanak Mission Hospital Phagwara',
    city: 'Phagwara',
    address: 'Model Town, Phagwara',
    phone: '9880000004',
    latitude: '31.2255',
    longitude: '75.7720',
    rating: 4.3,
    specialization: 'General Physician',
    specialties: ['General Physician', 'Pediatrician', 'Emergency Care'],
    emergency_24h: true,
    distance_km: '7.4',
  },
];

const JALANDHAR_HOSPITALS = [
  {
    id: 3,
    name: 'Tagore Hospital Jalandhar',
    city: 'Jalandhar',
    address: 'Rama Mandi, Jalandhar',
    phone: '9879000002',
    latitude: '31.2960',
    longitude: '75.5670',
    rating: 4.5,
    specialization: 'Cardiologist',
    specialties: ['Cardiologist', 'Neurologist', 'Emergency Care'],
    emergency_24h: true,
    distance_km: '15.8',
  },
];

describe('Hospital API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ── getByCity ──────────────────────────────────────────────────────────────

  test('GET /api/hospitals?city=Phagwara returns array with normalised specialties', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: PHAGWARA_HOSPITALS })
      .mockResolvedValueOnce({ rows: [{ count: '2' }] });

    const res = await request(app).get('/api/hospitals?city=Phagwara');

    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data[0]).toMatchObject({
      name: 'Civil Hospital Phagwara',
      city: 'Phagwara',
      specialties: ['General Physician', 'Emergency Care'],
    });
    expect(res.body.pagination).toMatchObject({ page: 1, total: 2 });
  });

  test('GET /api/hospitals?city=Jalandhar returns Jalandhar hospitals', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: JALANDHAR_HOSPITALS })
      .mockResolvedValueOnce({ rows: [{ count: '1' }] });

    const res = await request(app).get('/api/hospitals?city=Jalandhar');

    expect(res.statusCode).toBe(200);
    expect(res.body.data[0].city).toBe('Jalandhar');
  });

  // ── getNearby ──────────────────────────────────────────────────────────────

  test('GET /api/hospitals/nearby returns hospitals sorted by distance ASC', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [
        { ...PHAGWARA_HOSPITALS[0], distance_km: '7.2' },
        { ...PHAGWARA_HOSPITALS[1], distance_km: '7.4' },
        { ...JALANDHAR_HOSPITALS[0], distance_km: '15.8' },
      ],
    });

    const res = await request(app)
      .get(`/api/hospitals/nearby?lat=${LPU_LAT}&lng=${LPU_LNG}&radius=50`);

    expect(res.statusCode).toBe(200);
    expect(res.body.data).toHaveLength(3);
    const distances = res.body.data.map((h) => Number(h.distance_km));
    for (let i = 1; i < distances.length; i++) {
      expect(distances[i]).toBeGreaterThanOrEqual(distances[i - 1]);
    }
    // Verify query uses correct ORDER BY
    expect(mockQuery.mock.calls[0][0]).toContain('ORDER BY distance_km ASC');
  });

  test('GET /api/hospitals/nearby with 10 km radius excludes distant hospitals', async () => {
    // Within 10 km of LPU: only Phagwara hospitals (~7 km); Jalandhar (~15 km) excluded
    mockQuery.mockResolvedValueOnce({
      rows: [
        { ...PHAGWARA_HOSPITALS[0], distance_km: '7.2' },
        { ...PHAGWARA_HOSPITALS[1], distance_km: '7.4' },
      ],
    });

    const res = await request(app)
      .get(`/api/hospitals/nearby?lat=${LPU_LAT}&lng=${LPU_LNG}&radius=10`);

    expect(res.statusCode).toBe(200);
    expect(res.body.data).toHaveLength(2);
    res.body.data.forEach((h) => {
      expect(Number(h.distance_km)).toBeLessThanOrEqual(10);
    });
    // Verify radius parameter is passed to the query
    const [, params] = mockQuery.mock.calls[0];
    expect(Number(params[3])).toBe(10);
  });

  test('GET /api/hospitals/nearby with 2 km radius returns empty when no hospital that close', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .get(`/api/hospitals/nearby?lat=${LPU_LAT}&lng=${LPU_LNG}&radius=2`);

    expect(res.statusCode).toBe(200);
    expect(res.body.data).toHaveLength(0);
  });

  test('GET /api/hospitals/nearby with specialty filter passes specialty to query', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ ...JALANDHAR_HOSPITALS[0], distance_km: '15.8' }],
    });

    const res = await request(app)
      .get(`/api/hospitals/nearby?lat=${LPU_LAT}&lng=${LPU_LNG}&radius=50&specialty=Cardiologist`);

    expect(res.statusCode).toBe(200);
    expect(res.body.data[0].specialization).toBe('Cardiologist');
    const [, params] = mockQuery.mock.calls[0];
    expect(params[2]).toBe('Cardiologist');
  });

  test('GET /api/hospitals/nearby returns 400 when lat/lng are missing', async () => {
    const res = await request(app).get('/api/hospitals/nearby');
    expect(res.statusCode).toBe(400);
  });

  test('GET /api/hospitals/nearby returns 400 when lat/lng are non-numeric', async () => {
    const res = await request(app).get('/api/hospitals/nearby?lat=abc&lng=xyz');
    expect(res.statusCode).toBe(400);
  });

  // ── emergency_24h normalisation ────────────────────────────────────────────

  test('emergency_24h is normalised to boolean in response', async () => {
    mockQuery
      .mockResolvedValueOnce({
        rows: [{
          id: 1,
          name: 'Civil Hospital Phagwara',
          city: 'Phagwara',
          address: 'GT Road',
          phone: '9880000001',
          latitude: '31.2243',
          longitude: '75.7706',
          rating: 4.0,
          specialization: 'General Physician',
          specialties: ['General Physician'],
          emergency_24h: 1,
        }],
      })
      .mockResolvedValueOnce({ rows: [{ count: '1' }] });

    const res = await request(app).get('/api/hospitals?city=Phagwara');

    expect(res.statusCode).toBe(200);
    expect(typeof res.body.data[0].emergency_24h).toBe('boolean');
  });
});
