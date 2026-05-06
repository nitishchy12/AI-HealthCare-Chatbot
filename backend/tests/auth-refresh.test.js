process.env.JWT_SECRET   = 'test-secret';
process.env.FRONTEND_URL = 'http://localhost:5173';

const request = require('supertest');
const jwt     = require('jsonwebtoken');

jest.mock('../src/config/db', () => ({
  pool: { query: jest.fn() },
  getDbHealth: () => ({ postgres: true, mongo: true }),
}));

jest.mock('argon2', () => ({
  argon2id: 2,
  hash:   async () => '$argon2id$hashed',
  verify: async (_s, pw) => pw === 'Password1',
}));

const mockSession = {
  id: 'session-uuid',
  user_id: 1,
  refresh_token_hash: 'hashed',
  created_at: new Date(),
  revoked_at: null,
};

const mockUser = {
  id: 1, email: 'nitish@example.com', role: 'user',
  name: 'Nitish', first_name: 'Nitish', last_name: null,
  avatar_url: null, totp_enabled: false,
  preferred_language: 'en', theme_preference: 'light',
};

jest.mock('../src/services/session.service', () => ({
  createSession:     async () => 'new-refresh-token',
  findSession:       jest.fn(),
  rotateSession:     async () => 'rotated-refresh-token',
  revokeSession:     jest.fn(async () => {}),
  revokeAllSessions: jest.fn(async () => {}),
}));

const sessionService = require('../src/services/session.service');
const { pool }       = require('../src/config/db');
const app            = require('../src/app');

describe('Auth Refresh & Session API', () => {
  beforeEach(() => jest.clearAllMocks());

  // ── Refresh ────────────────────────────────────────────────────
  test('exchanges valid refresh token for new access + refresh tokens', async () => {
    sessionService.findSession.mockResolvedValueOnce(mockSession);
    pool.query.mockResolvedValueOnce({ rows: [mockUser] });

    const res = await request(app).post('/api/auth/refresh').send({
      refreshToken: 'valid-raw-token',
    });

    expect(res.statusCode).toBe(200);
    expect(res.body.data.token).toBeTruthy();
    expect(res.body.data.refreshToken).toBe('rotated-refresh-token');
  });

  test('rejects invalid / expired refresh token with 401', async () => {
    sessionService.findSession.mockResolvedValueOnce(null);

    const res = await request(app).post('/api/auth/refresh').send({
      refreshToken: 'bad-token',
    });

    expect(res.statusCode).toBe(401);
    expect(res.body.error).toBe('REFRESH_INVALID');
  });

  test('returns 400 when refreshToken is missing from body', async () => {
    const res = await request(app).post('/api/auth/refresh').send({});
    expect(res.statusCode).toBe(400);
  });

  // ── Logout ─────────────────────────────────────────────────────
  test('logout revokes the provided refresh token', async () => {
    const res = await request(app).post('/api/auth/logout').send({
      refreshToken: 'some-token',
    });

    expect(res.statusCode).toBe(200);
    expect(sessionService.revokeSession).toHaveBeenCalledWith('some-token');
  });

  test('logout without refresh token still returns 200', async () => {
    const res = await request(app).post('/api/auth/logout').send({});
    expect(res.statusCode).toBe(200);
  });

  // ── Auth middleware ────────────────────────────────────────────
  test('returns TOKEN_EXPIRED error code on expired access token', async () => {
    const expired = jwt.sign(
      { id: 1, email: 'test@test.com', role: 'user' },
      'test-secret',
      { expiresIn: -1 }, // already expired
    );

    const res = await request(app)
      .get('/api/history')
      .set('Authorization', `Bearer ${expired}`);

    expect(res.statusCode).toBe(401);
    expect(res.body.error).toBe('TOKEN_EXPIRED');
  });

  test('returns TOKEN_MISSING when no authorization header', async () => {
    const res = await request(app).get('/api/history');
    expect(res.statusCode).toBe(401);
    expect(res.body.error).toBe('TOKEN_MISSING');
  });

  test('returns TOKEN_INVALID for a garbage token', async () => {
    const res = await request(app)
      .get('/api/history')
      .set('Authorization', 'Bearer not.a.real.jwt');

    expect(res.statusCode).toBe(401);
    expect(res.body.error).toBe('TOKEN_INVALID');
  });
});
