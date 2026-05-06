/**
 * In-memory store for the short-lived access token.
 * Access tokens live here — NOT in localStorage — to reduce XSS exposure.
 * Refresh tokens go in localStorage because they're opaque (no JWT claims exposed).
 */
let _accessToken = null;

export const getAccessToken  = ()    => _accessToken;
export const setAccessToken  = (t)   => { _accessToken = t; };
export const clearAccessToken = ()   => { _accessToken = null; };

export const REFRESH_TOKEN_KEY = 'refresh_token';
export const USER_KEY          = 'auth_user';

export const getRefreshToken  = ()    => localStorage.getItem(REFRESH_TOKEN_KEY);
export const setRefreshToken  = (t)   => localStorage.setItem(REFRESH_TOKEN_KEY, t);
export const clearRefreshToken = ()   => localStorage.removeItem(REFRESH_TOKEN_KEY);

export const getStoredUser    = ()    => {
  try { return JSON.parse(localStorage.getItem(USER_KEY)); } catch { return null; }
};
export const setStoredUser    = (u)   => localStorage.setItem(USER_KEY, JSON.stringify(u));
export const clearStoredUser  = ()    => localStorage.removeItem(USER_KEY);
