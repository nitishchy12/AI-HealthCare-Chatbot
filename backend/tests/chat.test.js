process.env.JWT_SECRET   = 'test-secret';
process.env.FRONTEND_URL = 'http://localhost:5173';

const jwt     = require('jsonwebtoken');
const request = require('supertest');

jest.mock('../src/config/db', () => ({
  pool: { query: jest.fn().mockResolvedValue({ rows: [{ city: 'Delhi' }] }) },
  getDbHealth: () => ({ postgres: true, mongo: true }),
}));

jest.mock('../src/models/Chat', () => ({
  create:        jest.fn(),
  find:          jest.fn().mockReturnValue({ sort: function(){return this;}, skip: function(){return this;}, limit: function(){return this;} }),
  countDocuments: jest.fn().mockResolvedValue(0),
  deleteMany:    jest.fn(),
}));

// conversation.service and models — needed by the upgraded chat.controller
jest.mock('../src/services/conversation.service', () => ({
  createConversation: jest.fn(),
  appendMessages:     jest.fn().mockResolvedValue({}),
  getContextMessages: jest.fn().mockResolvedValue([]),
}));

jest.mock('../src/models/Conversation', () => ({
  find:          jest.fn().mockReturnValue({ sort: function(){return this;}, select: function(){return this;} }),
  findOne:       jest.fn(),
  updateMany:    jest.fn().mockResolvedValue({}),
  create:        jest.fn(),
}));

jest.mock('../src/models/Message', () => ({
  create:    jest.fn().mockResolvedValue({}),
  aggregate: jest.fn().mockResolvedValue([]),
  find:      jest.fn().mockReturnValue({ sort: function(){return this;}, skip: function(){return this;}, limit: function(){return this;}, lean: jest.fn().mockResolvedValue([]) }),
  countDocuments: jest.fn().mockResolvedValue(0),
}));

jest.mock('../src/services/ai.service', () => ({
  buildResponse: jest.fn(),
  PROMPT_VERSION: 'v1',
}));

jest.mock('../src/utils/audit', () => ({
  logAuditAction: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../src/services/session.service', () => ({
  createSession:     async () => 'mock-refresh',
  findSession:       async () => null,
  rotateSession:     async () => 'new-refresh',
  revokeSession:     async () => {},
  revokeAllSessions: async () => {},
}));

const Chat        = require('../src/models/Chat');
const Conversation = require('../src/models/Conversation');
const convSvc     = require('../src/services/conversation.service');
const { buildResponse } = require('../src/services/ai.service');
const app         = require('../src/app');

const MOCK_CONV = {
  _id: 'conv-1', userId: 7, title: 'I have fever', is_deleted: false,
};

const MOCK_AI = {
  symptoms: ['fever'], possibleCauses: ['viral infection'],
  prevention: ['drink water'], whenToConsultDoctor: ['if symptoms worsen'],
  riskLevel: 'Medium', confidenceScore: 0.81,
  promptVersion: 'v1', emergencyAlert: '',
  recommendedHospitals: [], disclaimer: 'test disclaimer',
};

describe('Chat API', () => {
  const token = jwt.sign({ id: 7, email: 'user@example.com', role: 'user' }, process.env.JWT_SECRET, { expiresIn: '1h' });

  beforeEach(() => {
    jest.clearAllMocks();
    buildResponse.mockResolvedValue(MOCK_AI);
    convSvc.createConversation.mockResolvedValue(MOCK_CONV);
    Conversation.findOne.mockResolvedValue(null); // no existing conv → creates new
    Chat.create.mockResolvedValue({
      _id: 'chat-1', riskLevel: 'Medium',
      createdAt: new Date().toISOString(),
      toObject() { return { _id: 'chat-1', riskLevel: 'Medium', conversationId: 'conv-1' }; },
    });
  });

  test('creates a chat assessment and returns conversationId', async () => {
    const response = await request(app)
      .post('/api/chat')
      .set('Authorization', `Bearer ${token}`)
      .send({ question: 'I have fever and headache', language: 'en' });

    expect(response.statusCode).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data.conversationId).toBe('conv-1');
    expect(buildResponse).toHaveBeenCalled();
    expect(Chat.create).toHaveBeenCalled();
    expect(convSvc.appendMessages).toHaveBeenCalled();
  });

  test('clears chat history (soft-deletes conversations + hard-deletes legacy chats)', async () => {
    Conversation.find.mockReturnValue({ sort: function(){return this;}, select: jest.fn().mockResolvedValue([]) });
    Chat.deleteMany.mockResolvedValue({ acknowledged: true });

    const response = await request(app)
      .delete('/api/chat/history')
      .set('Authorization', `Bearer ${token}`);

    expect(response.statusCode).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.cleared).toBe(true);
    expect(Chat.deleteMany).toHaveBeenCalledWith({ userId: 7 });
  });
});
