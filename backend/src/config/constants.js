/**
 * Central config for all thresholds, limits, and tunable values.
 * Never hardcode these inline — change here and everywhere follows.
 */

/* ── JWT ─────────────────────────────────────────────────────────── */
const ACCESS_TOKEN_EXPIRY  = '15m';
const REFRESH_TOKEN_EXPIRY = '7d';
// Numeric ms equivalents used for cookie maxAge / expiry comparisons
const ACCESS_TOKEN_EXPIRY_MS  = 15 * 60 * 1000;           // 15 minutes
const REFRESH_TOKEN_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;  // 7 days

/* ── Argon2id password hashing ───────────────────────────────────── */
// OWASP recommended minimums for Argon2id (2023)
const ARGON2_MEMORY_COST  = 65536; // 64 MB
const ARGON2_TIME_COST    = 3;     // iterations
const ARGON2_PARALLELISM  = 1;     // threads

/* ── Account lockout ─────────────────────────────────────────────── */
const MAX_LOGIN_ATTEMPTS   = 5;
const LOCKOUT_DURATION_MS  = 15 * 60 * 1000; // 15 minutes

/* ── Rate limits ─────────────────────────────────────────────────── */
const GLOBAL_RATE_LIMIT_WINDOW_MS  = 15 * 60 * 1000; // 15 minutes
const GLOBAL_RATE_LIMIT_MAX        = 500;
const AUTH_RATE_LIMIT_WINDOW_MS    = 15 * 60 * 1000;
const AUTH_RATE_LIMIT_MAX          = 20;              // stricter for auth routes
const CHAT_RATE_LIMIT_WINDOW_MS    = 60 * 1000;       // 1 minute
const CHAT_RATE_LIMIT_MAX          = 10;

/* ── Risk scoring ────────────────────────────────────────────────── */
const RISK_SCORE_HIGH_THRESHOLD   = 8;
const RISK_SCORE_MEDIUM_THRESHOLD = 5;
const RISK_SCORE_MAX              = 10;

/* ── AI / LLM ────────────────────────────────────────────────────── */
const AI_KNOWLEDGE_TOP_K           = 5;    // RAG retrieval count
const AI_HISTORY_TOP_K             = 3;    // user history retrieval count
const AI_MAX_CONTEXT_MESSAGES      = 10;   // conversation turns kept in context
const AI_CONFIDENCE_BASE           = 0.55;
const AI_CONFIDENCE_MAX            = 0.95;
const AI_TOKEN_BUDGET_PER_REQUEST  = 2048;

/* ── Pagination ──────────────────────────────────────────────────── */
const DEFAULT_PAGE_LIMIT  = 10;
const MAX_PAGE_LIMIT      = 100;

/* ── Session / last-seen debounce ────────────────────────────────── */
const LAST_SEEN_UPDATE_DEBOUNCE_MS = 60 * 1000; // only update last_seen_at once/min

/* ── 2FA ─────────────────────────────────────────────────────────── */
const TOTP_WINDOW        = 1;  // allow ±1 step (30s tolerance)
const TOTP_STEP          = 30; // seconds per TOTP step
const TOTP_TEMP_TOKEN_EXPIRY = '5m'; // temp JWT for 2FA second-factor

/* ── Refresh token bytes ─────────────────────────────────────────── */
const REFRESH_TOKEN_BYTES = 48; // 48 random bytes → 96 hex chars

module.exports = {
  ACCESS_TOKEN_EXPIRY,
  REFRESH_TOKEN_EXPIRY,
  ACCESS_TOKEN_EXPIRY_MS,
  REFRESH_TOKEN_EXPIRY_MS,
  ARGON2_MEMORY_COST,
  ARGON2_TIME_COST,
  ARGON2_PARALLELISM,
  MAX_LOGIN_ATTEMPTS,
  LOCKOUT_DURATION_MS,
  GLOBAL_RATE_LIMIT_WINDOW_MS,
  GLOBAL_RATE_LIMIT_MAX,
  AUTH_RATE_LIMIT_WINDOW_MS,
  AUTH_RATE_LIMIT_MAX,
  CHAT_RATE_LIMIT_WINDOW_MS,
  CHAT_RATE_LIMIT_MAX,
  RISK_SCORE_HIGH_THRESHOLD,
  RISK_SCORE_MEDIUM_THRESHOLD,
  RISK_SCORE_MAX,
  AI_KNOWLEDGE_TOP_K,
  AI_HISTORY_TOP_K,
  AI_MAX_CONTEXT_MESSAGES,
  AI_CONFIDENCE_BASE,
  AI_CONFIDENCE_MAX,
  AI_TOKEN_BUDGET_PER_REQUEST,
  DEFAULT_PAGE_LIMIT,
  MAX_PAGE_LIMIT,
  LAST_SEEN_UPDATE_DEBOUNCE_MS,
  TOTP_WINDOW,
  TOTP_STEP,
  TOTP_TEMP_TOKEN_EXPIRY,
  REFRESH_TOKEN_BYTES,
};
