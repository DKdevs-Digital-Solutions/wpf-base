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

export async function apiGet(url, { params = {}, headers = {}, authenticated = true, timeout } = {}) {
  const requestHeaders = { ...defaultHeaders(params.protocol || params.protocolo || ''), ...headers };

  if (authenticated) {
    const authorization = await getAuthorizationHeader();
    if (authorization) {
      requestHeaders.Authorization = authorization;
    }
  }

  try {
    const response = await axios.get(cleanUrl(url), {
      params,
      headers: requestHeaders,
      timeout: timeout || Number(env('API_TIMEOUT_MS', 15000))
    });
    return response.data;
  } catch (error) {
    if (error?.response?.status === 401 && authenticated) {
      clearTokenCache();
      const authorization = await getAuthorizationHeader();
      const retriedHeaders = { ...requestHeaders };
      if (authorization) retriedHeaders.Authorization = authorization;
      const response = await axios.get(cleanUrl(url), {
        params,
        headers: retriedHeaders,
        timeout: timeout || Number(env('API_TIMEOUT_MS', 15000))
      });
      return response.data;
    }
    throw error;
  }
}
