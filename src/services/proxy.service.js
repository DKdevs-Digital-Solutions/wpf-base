import { apiGet, apiPost, apiPut } from '../lib/http.js';
import { fetchAccessToken } from '../lib/auth.js';

function cleanBaseUrl(url = '') {
  return String(url || '').replace(/\/+$/g, '');
}

function joinUrl(baseUrl, path) {
  const normalizedPath = String(path || '').trim();
  return `${cleanBaseUrl(baseUrl)}${normalizedPath.startsWith('/') ? normalizedPath : `/${normalizedPath}`}`;
}

export function createProxyService(env = process.env) {
  const baseUrl = cleanBaseUrl(env.CRM_BASE_URL || env.CRM_PROXY_BASE_URL || '');

  return {
    async getToken({ forceRefresh = false } = {}) {
      const token = await fetchAccessToken(forceRefresh);
      return {
        token,
        tokenType: token ? 'Bearer' : '',
        authorization: token ? `Bearer ${token}` : ''
      };
    },

    async schedule(payload) {
      return apiPost(joinUrl(baseUrl, '/service-order/schedule'), payload, {
        headers: { 'Content-Type': 'application/json' },
        correlationId: payload?.protocol || payload?.protocolo || ''
      });
    },

    async getAvailabilities({ postalCode, protocol }) {
      return apiGet(joinUrl(baseUrl, '/capacity/availabilities'), {
        params: {
          'postal-code': postalCode,
          protocol
        },
        correlationId: protocol
      });
    },

    async updateTicketCustomer(ticketId, payload) {
      return apiPut(joinUrl(baseUrl, `/ticket/customer/${encodeURIComponent(String(ticketId || '').trim())}`), payload, {
        headers: { 'Content-Type': 'application/json' },
        correlationId: payload?.protocol || payload?.protocolo || ticketId
      });
    }
  };
}
