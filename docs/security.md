# Security Architecture

This document covers the threat model, implemented controls, and deployment security notes for the AI-Driven Public Health Chatbot.

---

## Threat Model (STRIDE)

### Spoofing
**What could go wrong:** An attacker impersonates a legitimate user or admin.

**Controls implemented:**
- Argon2id password hashing (time cost 3, memory cost 65536) — resistant to GPU-based cracking
- JWT access tokens (15-minute expiry) + rotating refresh tokens (7-day expiry stored as HTTP-only aware cookies)
- Token family tracking: refresh token rotation invalidates the entire family on reuse detection
- TOTP-based 2FA (RFC 6238) with time-window tolerance
- Account lockout after 5 failed login attempts (5-minute cooldown, tracked in PostgreSQL)

---

### Tampering
**What could go wrong:** User-supplied input modifies data in unintended ways (SQL injection, NoSQL injection, XSS, prototype pollution).

**Controls implemented:**
- All PostgreSQL queries use parameterized statements (`pg` driver — no string interpolation)
- All MongoDB writes explicitly pick allowed fields (never spread `req.body` directly)
- Input sanitisation via `sanitize-html` on all user-facing text fields
- Joi schema validation on all POST/PATCH endpoints before reaching controllers
- Content Security Policy via Helmet (see `backend/src/app.js`) restricts script and connect sources
- Frontend: DOMPurify + rehype-sanitize on all rendered Markdown from AI responses

---

### Repudiation
**What could go wrong:** An action is taken and later denied.

**Controls implemented:**
- `audit_logs` PostgreSQL table records every state-changing admin action:
  - Actor (`user_id`, `role`)
  - Action type (`CREATE`, `UPDATE`, `DELETE`, `SUSPEND_USER`, `ACTIVATE_PROMPT`, etc.)
  - Entity type and ID
  - Request ID (UUID, injected by `requestContext` middleware)
  - Timestamp
- Request ID header (`X-Request-ID`) propagated through all logs
- Morgan structured request logging with user ID and request ID

---

### Information Disclosure
**What could go wrong:** Sensitive data (passwords, PII, API keys) is exposed in logs, responses, or error messages.

**Controls implemented:**
- Passwords never logged — Argon2id hash stored, plaintext discarded immediately
- JWT secret and API keys loaded from environment variables only
- Error handler strips stack traces in production (`NODE_ENV=production`)
- AI service: system prompt instructs the LLM not to reproduce user PII in responses
- Database credentials not included in any client-facing error message
- `X-Powered-By` header removed by Helmet

**NOT implemented (known gaps):**
- PII scrubbing in AI conversation logs (future: regex-based masking before persistence)
- Audit log access controls are admin-only but logs are not encrypted at rest

---

### Denial of Service
**What could go wrong:** Flooding endpoints causes service degradation.

**Controls implemented:**
- Global rate limiter: 100 requests/15 minutes per IP on all `/api` routes
- Chat rate limiter: 10 messages/60 seconds per authenticated user ID (Redis-backed when available, in-memory fallback)
- AI service: request timeout enforced at the LangGraph level
- MongoDB/PostgreSQL connection pooling limits concurrent database load
- Nginx (in production Docker setup) handles TLS termination and connection limits

**NOT implemented:**
- DDoS mitigation at the infrastructure level (use Cloudflare or AWS Shield in production)
- Request body size limit is 1MB (configured in `express.json`) — not hardened against slow-body attacks

---

### Elevation of Privilege
**What could go wrong:** A regular user gains admin capabilities.

**Controls implemented:**
- `authMiddleware.js`: verifies JWT on every protected route
- `adminMiddleware.js`: checks `req.user.role === 'admin'` before any admin action
- Role stored in JWT payload — backend re-reads role from DB on sensitive operations
- Suspended users receive 403 on all authenticated routes (checked in `authMiddleware.js`)
- RBAC applied consistently: hospitals/diseases/tips CRUD requires admin role

---

## What IS Implemented

| Control | Status |
|---|---|
| Argon2id password hashing | ✅ |
| JWT + refresh token rotation | ✅ |
| TOTP 2FA | ✅ |
| Account lockout | ✅ |
| Parameterised SQL queries | ✅ |
| Input validation (Joi) | ✅ |
| HTML sanitisation | ✅ |
| Content Security Policy (Helmet) | ✅ |
| Audit logging | ✅ |
| Rate limiting (global + per-user chat) | ✅ |
| Admin role middleware | ✅ |
| Suspended user check | ✅ |
| Error stack suppression in production | ✅ |
| CORS restricted to `FRONTEND_URL` | ✅ |
| Redis-backed session invalidation | ✅ |

---

## What IS NOT Implemented (Known Limitations)

| Gap | Risk | Mitigation |
|---|---|---|
| No HIPAA certification | High (for clinical use) | This is a health awareness tool, not a medical device |
| No end-to-end encryption for chat messages | Medium | Messages stored in MongoDB — protect via DB access controls |
| No PII scrubbing in AI logs | Low-Medium | Do not store real patient data without adding this |
| Web push requires HTTPS | Low in dev | Must deploy behind HTTPS in production |
| No infrastructure-level DDoS protection | Medium | Add Cloudflare / WAF in production |
| AI responses not clinically validated | High for clinical use | Disclaimers shown on every response |
| No SOC 2 or ISO 27001 certification | N/A for demo | Required for enterprise/healthcare deployment |

---

## Deployment Security Notes

### Required before production:

1. **HTTPS is mandatory** — JWT cookies, web push, and service workers all require HTTPS. Use Let's Encrypt via Certbot or Cloudflare.

2. **JWT secret**: Must be at least 32 random characters. Generate with:
   ```
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

3. **VAPID keys**: Must be generated once and never changed (changing invalidates all push subscriptions):
   ```
   node -e "const wp=require('web-push');const k=wp.generateVAPIDKeys();console.log(JSON.stringify(k,null,2))"
   ```

4. **Database credentials**: Use strong, randomly generated passwords. Never use defaults in production.

5. **Environment variables**: Never commit `.env` files. Use a secrets manager (AWS Secrets Manager, Vault, Railway secrets).

6. **MongoDB**: Enable authentication. Do not expose port 27017 publicly.

7. **PostgreSQL**: Use a connection string with SSL (`?sslmode=require`) in production.

8. **Redis**: Enable `requirepass` or use a managed Redis with VPC isolation.

9. **Qdrant**: Not exposed publicly — keep behind an internal network or VPN.

10. **AI API key**: Rotate periodically. Set spending limits on your AI provider dashboard.

### Recommended additional controls for production:
- Enable OWASP ModSecurity WAF rules
- Set up Dependabot for dependency vulnerability scanning
- Configure GitHub secret scanning
- Add Sentry for error tracking (ensure PII is scrubbed before sending)
- Run `npm audit` and `pip-audit` in CI and block on high severity findings
