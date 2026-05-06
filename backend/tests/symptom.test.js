process.env.JWT_SECRET   = 'test-secret';
process.env.FRONTEND_URL = 'http://localhost:5173';

const request = require('supertest');
const jwt     = require('jsonwebtoken');

jest.mock('../src/config/db', () => ({
  pool: {
    query: jest.fn().mockResolvedValue({ rows: [{ age: 25, city: 'Delhi' }] }),
  },
  getDbHealth: () => ({ postgres: true, mongo: true }),
}));

jest.mock('../src/models/SymptomCheck', () => ({
  create: jest.fn(),
  find:   jest.fn(),
}));

jest.mock('../src/services/session.service', () => ({
  createSession:     async () => 'mock-refresh',
  findSession:       async () => null,
  rotateSession:     async () => 'new-refresh',
  revokeSession:     async () => {},
  revokeAllSessions: async () => {},
}));

const SymptomCheck = require('../src/models/SymptomCheck');
const app          = require('../src/app');
const token = jwt.sign({ id: 1, email: 'test@test.com', role: 'user' }, 'test-secret', { expiresIn: '1h' });
const auth  = { Authorization: `Bearer ${token}` };

const MOCK_CHECK = {
  _id: 'sc1', userId: 1, symptoms: ['Fever', 'Headache'],
  riskScore: 4, riskLevel: 'Medium', possibleDisease: 'Viral infection',
  emergency: false, recommendations: ['Rest', 'Stay hydrated'],
  followUpAnswers: { feverDays: 2, breathingDifficulty: false, chestPain: false, fatigueLevel: 'Low' },
  createdAt: new Date().toISOString(),
};

describe('Symptom Checker API', () => {
  beforeEach(() => jest.clearAllMocks());

  test('POST /api/symptoms returns 401 without token', async () => {
    const res = await request(app).post('/api/symptoms').send({
      symptoms: ['Fever'], feverDays: 2, breathingDifficulty: false, chestPain: false, fatigueLevel: 'Low',
    });
    expect(res.statusCode).toBe(401);
  });

  test('POST /api/symptoms creates symptom check with valid data', async () => {
    SymptomCheck.create.mockResolvedValue(MOCK_CHECK);

    const res = await request(app)
      .post('/api/symptoms')
      .set(auth)
      .send({ symptoms: ['Fever', 'Headache'], feverDays: 2, breathingDifficulty: false, chestPain: false, fatigueLevel: 'Low' });

    expect(res.statusCode).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.riskLevel).toBe('Medium');
    expect(res.body.data.possibleDisease).toBeTruthy();
    expect(SymptomCheck.create).toHaveBeenCalled();
  });

  test('POST /api/symptoms detects high risk for chest pain', async () => {
    SymptomCheck.create.mockImplementation((data) => Promise.resolve({ ...data, _id: 'sc2' }));

    const res = await request(app)
      .post('/api/symptoms')
      .set(auth)
      .send({ symptoms: ['Chest pain', 'Shortness of breath'], feverDays: 0, breathingDifficulty: true, chestPain: true, fatigueLevel: 'High' });

    expect(res.statusCode).toBe(201);
    expect(res.body.data.riskLevel).toBe('High');
    expect(res.body.data.emergency).toBe(true);
  });

  test('POST /api/symptoms rejects missing required fields', async () => {
    const res = await request(app)
      .post('/api/symptoms')
      .set(auth)
      .send({ symptoms: [] }); // empty symptoms + missing required fields

    expect(res.statusCode).toBe(400);
  });

  test('GET /api/symptoms returns user symptom checks', async () => {
    SymptomCheck.find.mockReturnValue({
      sort:  function() { return this; },
      limit: function() { return this; },
      then:  (resolve) => resolve([MOCK_CHECK]),
      catch: function(fn) { return this; },
    });
    // Mock as a thenable array
    SymptomCheck.find.mockReturnValue({
      sort:  function() { return this; },
      limit: jest.fn().mockResolvedValue([MOCK_CHECK]),
    });

    const res = await request(app)
      .get('/api/symptoms')
      .set(auth);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
  });
});
