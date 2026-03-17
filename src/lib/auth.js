import axios from 'axios';

let cachedToken = null;
let cachedExpiresAt = 0;
let inFlightPromise = null;

function env(name, fallback = '') {
  return String(process.env[name] || fallback).trim();
}

function now() {
  return Date.now();
}

function buildAuthPayload() {
  return {
    username: env('AUTH_USERNAME'),
    password: env('AUTH_PASSWORD')
  };
}

function normalizeTokenResponse(data = {}) {
  const token = data.access_token || data.token || data.id_token || data.jwt || '';
  const expiresInSeconds = Number(data.expires_in || data.expiresIn || 43200);
  const safetyWindowMs = Number(env('AUTH_REFRESH_BEFORE_MS', 300000));

  return {
    token,
    expiresAt: now() + (expiresInSeconds * 1000) - safetyWindowMs
  };
}

export function clearTokenCache() {
  cachedToken = null;
  cachedExpiresAt = 0;
  inFlightPromise = null;
}

export async function fetchAccessToken(forceRefresh = false) {
  if (!env('AUTH_URL')) return '';

  if (!forceRefresh && cachedToken && cachedExpiresAt > now()) {
    return cachedToken;
  }

  if (!forceRefresh && inFlightPromise) {
    return inFlightPromise;
  }

  inFlightPromise = axios.post(env('AUTH_URL'), buildAuthPayload(), {
    timeout: Number(env('AUTH_TIMEOUT_MS', 15000)),
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json'
    }
  }).then(({ data }) => {
    const normalized = normalizeTokenResponse(data);

    if (!normalized.token) {
      throw new Error(`Auth sem token na resposta: ${JSON.stringify(data)}`);
    }

    cachedToken = normalized.token;
    cachedExpiresAt = normalized.expiresAt;
    return cachedToken;
  }).finally(() => {
    inFlightPromise = null;
  });

  return inFlightPromise;
}

export async function getAuthorizationHeader() {
  const token = await fetchAccessToken();
  return token ? `Bearer ${token}` : '';
}