process.env.JWT_SECRET = 'test-secret';
process.env.FRONTEND_URL = 'http://localhost:5173';

const jwt = require('jsonwebtoken');
const request = require('supertest');

jest.mock('../src/config/db', () => ({
  pool: { query: jest.fn() },
  getDbHealth: () => ({ postgres: true, mongo: true })
}));

jest.mock('../src/models/Chat', () => ({
  create: jest.fn(),
  find: jest.fn(),
  countDocuments: jest.fn(),
  deleteMany: jest.fn()
}));

jest.mock('../src/services/ai.service', () => ({
  buildResponse: jest.fn()
}));

jest.mock('../src/utils/audit', () => ({
  logAuditAction: jest.fn().mockResolvedValue(undefined)
}));

const Chat = require('../src/models/Chat');
const { buildResponse } = require('../src/services/ai.service');
const app = require('../src/app');

describe('Chat API', () => {
  const token = jwt.sign({ id: 7, email: 'user@example.com', role: 'user' }, process.env.JWT_SECRET);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('creates a chat assessment', async () => {
    buildResponse.mockResolvedValue({
      symptoms: ['fever'],
      possibleCauses: ['viral infection'],
      prevention: ['drink water'],
      whenToConsultDoctor: ['if symptoms worsen'],
      riskLevel: 'Medium',
      confidenceScore: 0.81,
      promptVersion: 'health-awareness-v3',
      emergencyAlert: '',
      recommendedHospitals: [],
      disclaimer: 'test disclaimer'
    });

    Chat.create.mockResolvedValue({
      _id: 'chat-1',
      riskLevel: 'Medium',
      createdAt: new Date().toISOString()
    });

    const response = await request(app)
      .post('/api/chat')
      .set('Authorization', `Bearer ${token}`)
      .send({ question: 'I have fever and headache', language: 'en' });

    expect(response.statusCode).toBe(201);
    expect(response.body.success).toBe(true);
    expect(buildResponse).toHaveBeenCalledWith('I have fever and headache', 7, 'en');
    expect(Chat.create).toHaveBeenCalled();
  });

  test('clears chat history', async () => {
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
