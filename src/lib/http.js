import axios from 'axios';
import { clearTokenCache, getAuthorizationHeader } from './auth.js';

function cleanUrl(url = '') {
  return String(url || '').replace(/\/+$/g, '');
}

export function envUrl(name) {
  return cleanUrl(process.env[name] || '');
}

function env(name, fallback = '') {
  return String(process.env[name] || fallback).trim();
}

function defaultHeaders(correlationId = '') {
  const headers = {};
  if (correlationId) headers['x-correlation-id'] = correlationId;
  return headers;
}

async function withAuthorization(headers = {}, authenticated = true) {
  const requestHeaders = { ...headers };

  if (authenticated) {
    const authorization = await getAuthorizationHeader();
    if (authorization) {
      requestHeaders.Authorization = authorization;
    }
  }

  return requestHeaders;
}

async function requestWithRetry(method, url, {
  params = {},
  data,
  headers = {},
  authenticated = true,
  timeout,
  correlationId = ''
} = {}) {
  const baseHeaders = { ...defaultHeaders(correlationId || params.protocol || params.protocolo || ''), ...headers };
  const requestHeaders = await withAuthorization(baseHeaders, authenticated);

  try {
    const response = await axios({
      method,
      url: cleanUrl(url),
      params,
      data,
      headers: requestHeaders,
      timeout: timeout || Number(env('API_TIMEOUT_MS', 15000))
    });
    return response.data;
  } catch (error) {
    if (error?.response?.status === 401 && authenticated) {
      clearTokenCache();
      const retriedHeaders = await withAuthorization(baseHeaders, authenticated);
      const response = await axios({
        method,
        url: cleanUrl(url),
        params,
        data,
        headers: retriedHeaders,
        timeout: timeout || Number(env('API_TIMEOUT_MS', 15000))
      });
      return response.data;
    }
    throw error;
  }
}

export async function apiGet(url, options = {}) {
  return requestWithRetry('get', url, options);
}

export async function apiPost(url, data, options = {}) {
  return requestWithRetry('post', url, { ...options, data });
}

export async function apiPut(url, data, options = {}) {
  return requestWithRetry('put', url, { ...options, data });
}
