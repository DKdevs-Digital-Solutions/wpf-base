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
  const grantType = env('AUTH_GRANT_TYPE', 'client_credentials');
  const username = env('AUTH_USERNAME');
  const password = env('AUTH_PASSWORD');
  const clientId = env('AUTH_CLIENT_ID');
  const clientSecret = env('AUTH_CLIENT_SECRET');
  const audience = env('AUTH_AUDIENCE');

  return {
    grant_type: grantType,
    username,
    password,
    client_id: clientId,
    client_secret: clientSecret,
    audience
  };
}

function getConfiguredAuthHeaders() {
  const headers = { 'Content-Type': 'application/json' };
  const apiKey = env('AUTH_API_KEY');
  const subscriptionKey = env('AUTH_SUBSCRIPTION_KEY');

  if (apiKey) headers['x-api-key'] = apiKey;
  if (subscriptionKey) headers['Ocp-Apim-Subscription-Key'] = subscriptionKey;

  return headers;
}

function normalizeTokenResponse(data = {}) {
  const token = data.access_token || data.token || data.id_token || '';
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
  if (!env('AUTH_URL')) {
    return '';
  }

  if (!forceRefresh && cachedToken && cachedExpiresAt > now()) {
    return cachedToken;
  }

  if (!forceRefresh && inFlightPromise) {
    return inFlightPromise;
  }

  inFlightPromise = axios.post(env('AUTH_URL'), buildAuthPayload(), {
    timeout: Number(env('AUTH_TIMEOUT_MS', 15000)),
    headers: getConfiguredAuthHeaders()
  }).then(({ data }) => {
    const normalized = normalizeTokenResponse(data);
    if (!normalized.token) {
      throw new Error('Auth sem access_token na resposta.');
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
