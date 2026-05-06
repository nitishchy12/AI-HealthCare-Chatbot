process.env.JWT_SECRET   = 'test-secret';
process.env.FRONTEND_URL = 'http://localhost:5173';

const request = require('supertest');
const jwt     = require('jsonwebtoken');

jest.mock('../src/config/db', () => ({
  pool: { query: jest.fn().mockResolvedValue({ rows: [] }) },
  getDbHealth: () => ({ postgres: true, mongo: true }),
}));

jest.mock('../src/models/Conversation', () => ({
  find: jest.fn().mockReturnValue({
    sort:  function() { return this; },
    limit: function() { return this; },
    lean:  jest.fn().mockResolvedValue([
      { _id: 'conv1', userId: 1, title: 'I have fever', last_message_at: new Date().toISOString(), is_deleted: false },
    ]),
  }),
}));

jest.mock('../src/models/Message', () => ({
  aggregate: jest.fn().mockResolvedValue([
    {
      _id: 'conv1',
      content: 'Fever is caused by infection.',
      structured_output: { possibleCauses: ['viral infection'], symptoms: ['fever'], riskLevel: 'Low' },
    },
  ]),
}));

jest.mock('../src/models/SymptomCheck', () => ({
  find: jest.fn().mockReturnValue({
    sort:  function() { return this; },
    limit: function() { return this; },
    lean:  jest.fn().mockResolvedValue([]),
  }),
}));

jest.mock('../src/services/session.service', () => ({
  createSession: async () => 'r', findSession: async () => null,
  rotateSession: async () => 'r2', revokeSession: async () => {}, revokeAllSessions: async () => {},
}));

const app   = require('../src/app');
const token = jwt.sign({ id: 1, email: 'test@test.com', role: 'user' }, 'test-secret', { expiresIn: '1h' });
const auth  = { Authorization: `Bearer ${token}` };

describe('Health History API', () => {
  beforeEach(() => jest.clearAllMocks());

  test('GET /api/history returns 401 without token', async () => {
    const res = await request(app).get('/api/history');
    expect(res.statusCode).toBe(401);
    expect(res.body.error).toBe('TOKEN_MISSING');
  });

  test('GET /api/history returns merged history', async () => {
    const res = await request(app).get('/api/history').set(auth);
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    // At least 1 item from conversation mock
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
  });

  test('GET /api/history items have required fields', async () => {
    const res = await request(app).get('/api/history').set(auth);
    if (res.body.data.length > 0) {
      const item = res.body.data[0];
      expect(item).toHaveProperty('id');
      expect(item).toHaveProperty('type');
      expect(item).toHaveProperty('title');
      expect(item).toHaveProperty('createdAt');
    }
  });
});
