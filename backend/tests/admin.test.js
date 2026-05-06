process.env.JWT_SECRET = 'test-secret';
process.env.FRONTEND_URL = 'http://localhost:5173';
process.env.NODE_ENV = 'test';

const request = require('supertest');
const jwt = require('jsonwebtoken');

const mockPoolQuery = jest.fn((sql) => {
  if (String(sql).includes('UPDATE users SET role')) {
    return Promise.resolve({ rowCount: 1, rows: [{ id: 2, name: 'User', email: 'user@example.com', role: 'admin' }] });
  }
  if (String(sql).includes('last_seen_at')) return Promise.resolve({ rows: [{ count: '3' }] });
  if (String(sql).includes('COUNT(*) FROM users')) return Promise.resolve({ rows: [{ count: '10' }] });
  return Promise.resolve({ rows: [] });
});

jest.mock('../src/config/db', () => ({
  pool: { query: (...args) => mockPoolQuery(...args) },
  getDbHealth: () => ({ postgres: true, mongo: true }),
}));

jest.mock('../src/models/Conversation', () => ({
  countDocuments: jest.fn().mockResolvedValue(7),
}));

jest.mock('../src/models/Message', () => ({
  countDocuments: jest.fn().mockResolvedValue(2),
}));

jest.mock('../src/utils/audit', () => ({
  logAuditAction: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../src/services/session.service', () => ({
  createSession: async () => 'r',
  findSession: async () => null,
  rotateSession: async () => 'r2',
  revokeSession: async () => {},
  revokeAllSessions: async () => {},
}));

const app = require('../src/app');
const userToken = jwt.sign({ id: 1, email: 'user@example.com', role: 'user' }, 'test-secret', { expiresIn: '1h' });
const adminToken = jwt.sign({ id: 99, email: 'admin@example.com', role: 'admin' }, 'test-secret', { expiresIn: '1h' });

describe('Admin API', () => {
  beforeEach(() => mockPoolQuery.mockClear());

  test('GET /api/admin/stats returns 403 for non-admin', async () => {
    const res = await request(app).get('/api/admin/stats').set('Authorization', `Bearer ${userToken}`);
    expect(res.statusCode).toBe(403);
  });

  test('GET /api/admin/stats returns correct shape for admin', async () => {
    const res = await request(app).get('/api/admin/stats').set('Authorization', `Bearer ${adminToken}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.data).toEqual(expect.objectContaining({
      total_users: expect.any(Number),
      active_24h: expect.any(Number),
      conversations_7d: expect.any(Number),
      high_risk_7d: expect.any(Number),
    }));
  });

  test('PATCH /api/admin/users/:id/role updates role in DB', async () => {
    const res = await request(app)
      .patch('/api/admin/users/2/role')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ role: 'admin' });

    expect(res.statusCode).toBe(200);
    expect(res.body.data.role).toBe('admin');
    expect(mockPoolQuery).toHaveBeenCalledWith(expect.stringContaining('UPDATE users SET role'), ['admin', '2']);
  });
});
