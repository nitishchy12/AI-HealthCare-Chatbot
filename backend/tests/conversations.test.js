process.env.JWT_SECRET   = 'test-secret';
process.env.FRONTEND_URL = 'http://localhost:5173';

const request = require('supertest');
const jwt     = require('jsonwebtoken');

// ── Mock Postgres ─────────────────────────────────────────────────
jest.mock('../src/config/db', () => ({
  pool: { query: jest.fn().mockResolvedValue({ rows: [{ city: 'Delhi' }] }) },
  getDbHealth: () => ({ postgres: true, mongo: true }),
}));

// ── Mock conversation.service (inline — jest.mock is hoisted) ─────
jest.mock('../src/services/conversation.service', () => ({
  createConversation:        jest.fn(),
  appendMessages:            jest.fn(),
  getContextMessages:        jest.fn(),
  autoTitle:                 jest.fn(),
  renameConversation:        jest.fn(),
  softDelete:                jest.fn(),
  listConversations:         jest.fn(),
  getConversationWithMessages: jest.fn(),
  getMessages:               jest.fn(),
}));

// ── Mock Conversation model (used directly by chat.controller) ────
jest.mock('../src/models/Conversation', () => ({
  find:             jest.fn().mockReturnValue({ sort: function(){return this;}, select: function(){return this;} }),
  findOne:          jest.fn(),
  findOneAndUpdate: jest.fn(),
  findByIdAndUpdate: jest.fn(),
  updateMany:       jest.fn().mockResolvedValue({}),
  create:           jest.fn(),
}));

jest.mock('../src/models/Message', () => ({
  find:          jest.fn().mockReturnValue({ sort: function(){return this;}, skip: function(){return this;}, limit: function(){return this;}, lean: jest.fn().mockResolvedValue([]) }),
  countDocuments: jest.fn().mockResolvedValue(0),
  create:        jest.fn().mockResolvedValue({}),
  aggregate:     jest.fn().mockResolvedValue([]),
}));

jest.mock('../src/models/Chat', () => ({
  find:          jest.fn().mockReturnValue({ sort: function(){return this;}, skip: function(){return this;}, limit: function(){return this;} }),
  countDocuments: jest.fn().mockResolvedValue(0),
  create:        jest.fn(),
  deleteMany:    jest.fn().mockResolvedValue({}),
}));

jest.mock('../src/models/SymptomCheck', () => ({
  find: jest.fn().mockReturnValue({ sort: function(){return this;}, limit: function(){return this;}, lean: jest.fn().mockResolvedValue([]) }),
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
  createSession:     async () => 'mock-refresh',
  findSession:       async () => null,
  rotateSession:     async () => 'new-refresh',
  revokeSession:     async () => {},
  revokeAllSessions: async () => {},
}));

jest.mock('../src/utils/audit', () => ({ logAuditAction: jest.fn() }));

// ── Require after mocks ───────────────────────────────────────────
const convSvc      = require('../src/services/conversation.service');
const Conversation = require('../src/models/Conversation');
const Chat         = require('../src/models/Chat');
const app          = require('../src/app');

const MOCK_CONV = {
  _id: 'conv123', userId: 1, title: 'I have a headache',
  language: 'en', is_deleted: false, message_count: 0,
  total_tokens: 0, last_message_at: new Date().toISOString(),
  created_at: new Date().toISOString(), messages: [],
};

const MOCK_LEGACY_CHAT = {
  _id: 'chat1', userId: 1, question: 'headache', riskLevel: 'Low',
  aiResponse: {
    riskLevel: 'Low', symptoms: ['headache'], possibleCauses: ['migraine'],
    prevention: ['rest'], whenToConsultDoctor: ['if severe'],
    confidenceScore: 0.8, promptVersion: 'v1',
    emergencyAlert: '', recommendedHospitals: [], disclaimer: 'For awareness only.',
  },
  createdAt: new Date(),
  toObject() { return { ...this, conversationId: 'conv123' }; },
};

const token = jwt.sign({ id: 1, email: 'nitish@example.com', role: 'user' }, 'test-secret', { expiresIn: '1h' });
const auth  = { Authorization: `Bearer ${token}` };

describe('Conversations API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default mock implementations
    convSvc.listConversations.mockResolvedValue({ items: [MOCK_CONV], total: 1, page: 1, totalPages: 1 });
    convSvc.createConversation.mockResolvedValue(MOCK_CONV);
    convSvc.getConversationWithMessages.mockResolvedValue(MOCK_CONV);
    convSvc.renameConversation.mockResolvedValue({ ...MOCK_CONV, title: 'Renamed title' });
    convSvc.softDelete.mockResolvedValue({ ...MOCK_CONV, is_deleted: true });
    convSvc.getContextMessages.mockResolvedValue([]);
    convSvc.appendMessages.mockResolvedValue({});
    Conversation.findOne.mockResolvedValue({ ...MOCK_CONV, is_deleted: false });
    Chat.create.mockResolvedValue(MOCK_LEGACY_CHAT);
  });

  // ── 1. Auth guard ──────────────────────────────────────────────
  test('GET /api/conversations returns 401 without token', async () => {
    const res = await request(app).get('/api/conversations');
    expect(res.statusCode).toBe(401);
    expect(res.body.error).toBe('TOKEN_MISSING');
  });

  // ── 2. List conversations ──────────────────────────────────────
  test('GET /api/conversations returns paginated list', async () => {
    const res = await request(app).get('/api/conversations').set(auth);
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data.items)).toBe(true);
    expect(res.body.data.total).toBe(1);
  });

  // ── 3. Create conversation ─────────────────────────────────────
  test('POST /api/conversations creates a new conversation', async () => {
    const res = await request(app)
      .post('/api/conversations')
      .set(auth)
      .send({ firstMessage: 'I have a headache', language: 'en' });

    expect(res.statusCode).toBe(201);
    expect(res.body.data._id).toBe('conv123');
    expect(convSvc.createConversation).toHaveBeenCalledWith({
      userId: 1, firstMessage: 'I have a headache', language: 'en',
    });
  });

  // ── 4. Get single conversation ─────────────────────────────────
  test('GET /api/conversations/:id returns conversation with messages', async () => {
    const res = await request(app).get('/api/conversations/conv123').set(auth);
    expect(res.statusCode).toBe(200);
    expect(res.body.data._id).toBe('conv123');
    expect(Array.isArray(res.body.data.messages)).toBe(true);
  });

  // ── 5. 404 for non-existent conversation ──────────────────────
  test('GET /api/conversations/:id returns 404 when not found', async () => {
    convSvc.getConversationWithMessages.mockResolvedValueOnce(null);
    const res = await request(app).get('/api/conversations/nonexistent').set(auth);
    expect(res.statusCode).toBe(404);
  });

  // ── 6. Rename conversation ─────────────────────────────────────
  test('PATCH /api/conversations/:id renames conversation', async () => {
    const res = await request(app)
      .patch('/api/conversations/conv123')
      .set(auth)
      .send({ title: 'Renamed title' });

    expect(res.statusCode).toBe(200);
    expect(res.body.data.title).toBe('Renamed title');
  });

  // ── 7. Rename rejects blank title ─────────────────────────────
  test('PATCH /api/conversations/:id rejects blank title', async () => {
    const res = await request(app)
      .patch('/api/conversations/conv123')
      .set(auth)
      .send({ title: '   ' });

    expect(res.statusCode).toBe(400);
  });

  // ── 8. Soft delete ─────────────────────────────────────────────
  test('DELETE /api/conversations/:id soft-deletes conversation', async () => {
    const res = await request(app).delete('/api/conversations/conv123').set(auth);
    expect(res.statusCode).toBe(200);
    expect(res.body.message).toBe('Conversation deleted');
    expect(convSvc.softDelete).toHaveBeenCalledWith('conv123', 1);
  });

  // ── 9. POST /api/chat creates conversation + returns conversationId
  test('POST /api/chat creates conversation and returns conversationId', async () => {
    const res = await request(app)
      .post('/api/chat')
      .set(auth)
      .send({ question: 'I have a headache and fever', language: 'en' });

    expect(res.statusCode).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.conversationId).toBe('conv123');
    expect(convSvc.createConversation).toHaveBeenCalled();
    expect(convSvc.appendMessages).toHaveBeenCalled();
  });
});
