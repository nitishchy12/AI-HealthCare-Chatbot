process.env.JWT_SECRET     = 'test-secret';
process.env.FRONTEND_URL   = 'http://localhost:5173';

const request = require('supertest');

// ── Mock DB ───────────────────────────────────────────────────────
jest.mock('../src/config/db', () => ({
  pool: { query: jest.fn() },
  getDbHealth: () => ({ postgres: true, mongo: true }),
}));

// ── Mock argon2 (fast for tests) ──────────────────────────────────
jest.mock('argon2', () => ({
  argon2id: 2,
  hash:   async () => '$argon2id$hashed',
  verify: async (_stored, pw) => pw === 'Password1',
}));

// ── Mock session service ──────────────────────────────────────────
jest.mock('../src/services/session.service', () => ({
  createSession: async () => 'mock-refresh-token',
  findSession:   async () => null,
  rotateSession: async () => 'new-refresh-token',
  revokeSession: async () => {},
  revokeAllSessions: async () => {},
}));

const { pool } = require('../src/config/db');
const app       = require('../src/app');

describe('Auth API', () => {
  beforeEach(() => jest.clearAllMocks());

  // ── Register ───────────────────────────────────────────────────
  test('registers a new user and returns token + refreshToken', async () => {
    pool.query
      .mockResolvedValueOnce({ rowCount: 0, rows: [] })          // duplicate check
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [{
          id: 1, name: 'Nitish Kumar', first_name: 'Nitish', last_name: 'Kumar',
          email: 'nitish@example.com', role: 'user', age: 22,
          gender: 'Male', medical_notes: null, city: 'Delhi',
          avatar_url: null, totp_enabled: false,
          preferred_language: 'en', theme_preference: 'light',
          created_at: new Date().toISOString(),
        }],
      });

    const res = await request(app).post('/api/auth/register').send({
      name: 'Nitish Kumar', email: 'nitish@example.com',
      password: 'Password1', age: 22, gender: 'Male', city: 'Delhi',
    });

    expect(res.statusCode).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.email).toBe('nitish@example.com');
    expect(res.body.data.token).toBeTruthy();
    expect(res.body.data.refreshToken).toBe('mock-refresh-token');
  });

  test('rejects duplicate email with 409', async () => {
    pool.query.mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 1 }] });

    const res = await request(app).post('/api/auth/register').send({
      name: 'Nitish', email: 'existing@example.com', password: 'Password1',
    });

    expect(res.statusCode).toBe(409);
    expect(res.body.success).toBe(false);
  });

  test('rejects register with weak password (no uppercase)', async () => {
    const res = await request(app).post('/api/auth/register').send({
      name: 'Nitish', email: 'n@example.com', password: 'alllowercase1',
    });
    expect(res.statusCode).toBe(400);
  });

  // ── Login ──────────────────────────────────────────────────────
  test('logs in successfully and returns token + refreshToken', async () => {
    pool.query
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [{
          id: 1, name: 'Nitish', email: 'nitish@example.com', role: 'user',
          password_hash: '$argon2id$hashed',
          failed_login_attempts: 0, locked_until: null, totp_enabled: false,
          first_name: 'Nitish', last_name: null, avatar_url: null,
          preferred_language: 'en', theme_preference: 'light',
        }],
      })
      .mockResolvedValueOnce({ rows: [] }); // UPDATE last_seen_at

    const res = await request(app).post('/api/auth/login').send({
      email: 'nitish@example.com', password: 'Password1',
    });

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.token).toBeTruthy();
    expect(res.body.data.refreshToken).toBe('mock-refresh-token');
  });

  test('rejects invalid credentials with 401', async () => {
    pool.query.mockResolvedValueOnce({ rowCount: 0, rows: [] });

    const res = await request(app).post('/api/auth/login').send({
      email: 'nobody@example.com', password: 'Password1',
    });

    expect(res.statusCode).toBe(401);
    expect(res.body.success).toBe(false);
  });

  test('rejects wrong password and increments failed attempts', async () => {
    pool.query
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [{
          id: 1, name: 'Nitish', email: 'nitish@example.com', role: 'user',
          password_hash: '$argon2id$hashed',
          failed_login_attempts: 0, locked_until: null, totp_enabled: false,
        }],
      })
      .mockResolvedValueOnce({ rows: [] }); // UPDATE failed_login_attempts

    const res = await request(app).post('/api/auth/login').send({
      email: 'nitish@example.com', password: 'WrongPassword1',
    });

    expect(res.statusCode).toBe(401);
    expect(pool.query).toHaveBeenCalledTimes(2);
  });

  test('returns 429 for locked account', async () => {
    const future = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    pool.query.mockResolvedValueOnce({
      rowCount: 1,
      rows: [{
        id: 1, email: 'locked@example.com', password_hash: '$argon2id$hashed',
        failed_login_attempts: 5, locked_until: future,
        totp_enabled: false,
      }],
    });

    const res = await request(app).post('/api/auth/login').send({
      email: 'locked@example.com', password: 'Password1',
    });

    expect(res.statusCode).toBe(429);
    expect(res.body.error).toBe('ACCOUNT_LOCKED');
  });
});
