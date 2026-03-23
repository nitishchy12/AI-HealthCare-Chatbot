process.env.JWT_SECRET = 'test-secret';
process.env.FRONTEND_URL = 'http://localhost:5173';

const request = require('supertest');

jest.mock('../src/config/db', () => ({
  pool: { query: jest.fn() },
  getDbHealth: () => ({ postgres: true, mongo: true })
}));

const { pool } = require('../src/config/db');
const app = require('../src/app');

describe('Auth API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('registers a user successfully', async () => {
    pool.query
      .mockResolvedValueOnce({ rowCount: 0, rows: [] })
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [{
          id: 1,
          name: 'Nitish',
          email: 'nitish@example.com',
          role: 'user',
          age: 22,
          gender: 'Male',
          medical_notes: null,
          city: 'Delhi',
          created_at: new Date().toISOString()
        }]
      });

    const response = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Nitish',
        email: 'nitish@example.com',
        password: 'Password1',
        age: 22,
        gender: 'Male',
        city: 'Delhi'
      });

    expect(response.statusCode).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data.user.email).toBe('nitish@example.com');
    expect(response.body.data.token).toBeTruthy();
  });

  test('rejects invalid login credentials', async () => {
    pool.query.mockResolvedValueOnce({ rowCount: 0, rows: [] });

    const response = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'missing@example.com',
        password: 'Password1'
      });

    expect(response.statusCode).toBe(401);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toBe('Invalid email or password');
  });
});
