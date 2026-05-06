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

describe('Hospital API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('GET /api/hospitals?city=Phagwara returns array', async () => {
    mockQuery
      .mockResolvedValueOnce({
        rows: [{
          id: 1,
          name: 'Phagwara Civil Hospital',
          city: 'Phagwara',
          address: 'GT Road',
          phone: '9876500001',
          latitude: '31.2240',
          longitude: '75.7708',
          rating: 4.2,
          specialization: 'General Physician',
          specialties: ['General Physician'],
          emergency_24h: true,
        }],
      })
      .mockResolvedValueOnce({ rows: [{ count: '1' }] });

    const res = await request(app).get('/api/hospitals?city=Phagwara');

    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data[0]).toMatchObject({
      name: 'Phagwara Civil Hospital',
      city: 'Phagwara',
      specialties: ['General Physician'],
    });
  });

  test('GET /api/hospitals/nearby returns hospitals sorted by distance', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [
        { id: 1, name: 'Near Hospital', distance_km: '2.1', specialization: 'General Physician', specialties: ['General Physician'] },
        { id: 2, name: 'Far Hospital', distance_km: '18.4', specialization: 'General Physician', specialties: ['General Physician'] },
      ],
    });

    const res = await request(app).get('/api/hospitals/nearby?lat=31.22&lng=75.77&radius=50');

    expect(res.statusCode).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(Number(res.body.data[0].distance_km)).toBeLessThanOrEqual(Number(res.body.data[1].distance_km));
    expect(mockQuery.mock.calls[0][0]).toContain('ORDER BY distance_km ASC');
  });
});
