process.env.JWT_SECRET = 'test-secret';
process.env.FRONTEND_URL = 'http://localhost:5173';
process.env.NODE_ENV = 'test';

const request = require('supertest');
const jwt = require('jsonwebtoken');

const chain = (value) => ({
  sort() { return this; },
  limit() { return Promise.resolve(value); },
  then(resolve, reject) { return Promise.resolve(value).then(resolve, reject); },
});

jest.mock('../src/config/db', () => ({
  pool: { query: jest.fn().mockResolvedValue({ rows: [{ name: 'Test User', email: 'test@example.com' }] }) },
  getDbHealth: () => ({ postgres: true, mongo: true }),
}));

jest.mock('../src/models/Chat', () => ({
  find: jest.fn(() => chain([
    {
      userId: 1,
      riskLevel: 'Medium',
      aiResponse: { symptoms: ['Fever'], possibleCauses: ['viral infection'], whenToConsultDoctor: ['Consult a doctor if symptoms persist.'] },
      createdAt: new Date(),
    },
  ])),
}));

jest.mock('../src/models/SymptomCheck', () => ({
  find: jest.fn(() => chain([
    {
      userId: 1,
      symptoms: ['Cough'],
      riskLevel: 'Low',
      createdAt: new Date(),
    },
  ])),
}));

jest.mock('../src/models/Message', () => ({
  find: jest.fn(() => ({
    sort() { return this; },
    limit() { return this; },
    lean: jest.fn().mockResolvedValue([]),
  })),
}));

jest.mock('../src/services/ai.service', () => ({
  buildResponse: jest.fn().mockResolvedValue({
    possibleCauses: ['a short viral pattern'],
    whenToConsultDoctor: ['Rest, hydrate, and consult a doctor if fever continues.'],
  }),
}));

jest.mock('../src/services/session.service', () => ({
  createSession: async () => 'r',
  findSession: async () => null,
  rotateSession: async () => 'r2',
  revokeSession: async () => {},
  revokeAllSessions: async () => {},
}));

const app = require('../src/app');
const token = jwt.sign({ id: 1, email: 'test@example.com', role: 'user' }, 'test-secret', { expiresIn: '1h' });

describe('Reports API', () => {
  test('GET /api/reports/insights returns 401 without token', async () => {
    const res = await request(app).get('/api/reports/insights');
    expect(res.statusCode).toBe(401);
  });

  test('GET /api/reports/insights returns summary for authenticated user', async () => {
    const res = await request(app)
      .get('/api/reports/insights?refresh=true')
      .set('Authorization', `Bearer ${token}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('summary');
    expect(res.body.data).toHaveProperty('recommendation');
  });
});
