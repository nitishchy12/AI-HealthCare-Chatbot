process.env.JWT_SECRET   = 'test-secret';
process.env.FRONTEND_URL = 'http://localhost:5173';

const request = require('supertest');
const jwt     = require('jsonwebtoken');

jest.mock('../src/config/db', () => ({
  pool: { query: jest.fn().mockResolvedValue({ rows: [{ city: 'Delhi' }] }) },
  getDbHealth: () => ({ postgres: true, mongo: true }),
}));

jest.mock('../src/services/conversation.service', () => ({
  createConversation:  jest.fn().mockResolvedValue({ _id: 'conv-stream', userId: 1, title: 'test', is_deleted: false }),
  appendMessages:      jest.fn().mockResolvedValue({}),
  getContextMessages:  jest.fn().mockResolvedValue([]),
}));

jest.mock('../src/models/Conversation', () => ({
  find:          jest.fn().mockReturnValue({ sort: () => ({ select: () => [] }) }),
  findOne:       jest.fn().mockResolvedValue(null),
  updateMany:    jest.fn().mockResolvedValue({}),
  create:        jest.fn().mockResolvedValue({ _id: 'conv-stream' }),
}));

jest.mock('../src/models/Message', () => ({
  create:    jest.fn().mockResolvedValue({}),
  aggregate: jest.fn().mockResolvedValue([]),
  find:      jest.fn().mockReturnValue({ sort: () => ({ skip: () => ({ limit: () => ({ lean: () => [] }) }) }) }),
  countDocuments: jest.fn().mockResolvedValue(0),
}));

jest.mock('../src/models/Chat', () => ({
  find:          jest.fn().mockReturnValue({ sort: () => ({ skip: () => ({ limit: () => [] }) }) }),
  countDocuments: jest.fn().mockResolvedValue(0),
  create:        jest.fn().mockResolvedValue({ _id: 'chat1', riskLevel: 'Low', createdAt: new Date(), toObject() { return this; } }),
  deleteMany:    jest.fn().mockResolvedValue({}),
}));

jest.mock('../src/services/ai.service', () => ({
  buildResponse: jest.fn().mockResolvedValue({
    symptoms: ['headache'], possibleCauses: ['migraine'], prevention: ['rest'],
    whenToConsultDoctor: ['if severe'], riskLevel: 'Low',
    confidenceScore: 0.8, promptVersion: 'v1',
    emergencyAlert: '', recommendedHospitals: [], disclaimer: 'For awareness only.',
  }),
  PROMPT_VERSION: 'v1',
}));

jest.mock('../src/services/session.service', () => ({
  createSession: async () => 'mock-refresh', findSession: async () => null,
  rotateSession: async () => 'r', revokeSession: async () => {}, revokeAllSessions: async () => {},
}));

jest.mock('../src/models/Feedback', () => ({
  findOneAndUpdate: jest.fn().mockResolvedValue({ _id: 'fb1', rating: 1 }),
}));

jest.mock('../src/utils/audit', () => ({ logAuditAction: jest.fn() }));

const app   = require('../src/app');
const token = jwt.sign({ id: 1, email: 'test@test.com', role: 'user' }, 'test-secret', { expiresIn: '1h' });

describe('SSE Streaming API', () => {
  beforeEach(() => jest.clearAllMocks());

  // ── 1. No token → 401 ─────────────────────────────────────────
  test('GET /api/chat/stream without token returns 401', async () => {
    const res = await request(app).get('/api/chat/stream?question=I+have+fever');
    expect(res.statusCode).toBe(401);
    expect(res.body.error).toBe('TOKEN_MISSING');
  });

  // ── 2. No question → 400 ──────────────────────────────────────
  test('GET /api/chat/stream with missing question returns 400', async () => {
    const res = await request(app)
      .get('/api/chat/stream')
      .set('Authorization', `Bearer ${token}`);
    expect(res.statusCode).toBe(400);
  });

  // ── 3. Short question → 400 ───────────────────────────────────
  test('GET /api/chat/stream with question < 5 chars returns 400', async () => {
    const res = await request(app)
      .get('/api/chat/stream?question=hi')
      .set('Authorization', `Bearer ${token}`);
    expect(res.statusCode).toBe(400);
  });

  // ── 4. Valid request → SSE stream with correct headers ────────
  test('GET /api/chat/stream returns text/event-stream and SSE events', async () => {
    const res = await request(app)
      .get('/api/chat/stream?question=I+have+fever+and+headache&language=en')
      .set('Authorization', `Bearer ${token}`)
      .buffer(true)
      .parse((res, cb) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk.toString(); });
        res.on('end', () => cb(null, data));
      });

    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/event-stream/);

    // Verify SSE events present in body
    expect(res.body).toMatch(/event: token/);
    expect(res.body).toMatch(/event: metadata/);
    expect(res.body).toMatch(/event: done/);
  });

  // ── 5. Metadata event contains expected fields ─────────────────
  test('SSE metadata event includes riskLevel and conversationId', async () => {
    const res = await request(app)
      .get('/api/chat/stream?question=I+have+a+headache+today&language=en')
      .set('Authorization', `Bearer ${token}`)
      .buffer(true)
      .parse((res, cb) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk.toString(); });
        res.on('end', () => cb(null, data));
      });

    const lines = res.body.split('\n');
    const metaLine = lines.find((l) => l.startsWith('data:') &&
      lines[lines.indexOf(l) - 1]?.includes('event: metadata'));

    // Find metadata data line
    let metaData = null;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes('event: metadata') && lines[i+1]?.startsWith('data:')) {
        metaData = JSON.parse(lines[i+1].replace('data: ', ''));
        break;
      }
    }

    expect(metaData).not.toBeNull();
    expect(metaData).toHaveProperty('riskLevel');
    expect(metaData).toHaveProperty('conversationId');
    expect(['Low', 'Medium', 'High']).toContain(metaData.riskLevel);
  });

  // ── 6. Feedback endpoint ──────────────────────────────────────
  test('POST /api/chat/messages/:id/feedback saves rating', async () => {
    const res = await request(app)
      .post('/api/chat/messages/msg123/feedback')
      .set('Authorization', `Bearer ${token}`)
      .send({ rating: 1, reason: 'Helpful', comment: 'Good answer' });

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
  });

  test('POST /api/chat/messages/:id/feedback rejects invalid rating', async () => {
    const res = await request(app)
      .post('/api/chat/messages/msg123/feedback')
      .set('Authorization', `Bearer ${token}`)
      .send({ rating: 5 }); // invalid — must be -1, 0, or 1

    expect(res.statusCode).toBe(400);
  });
});
