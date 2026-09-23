import { apiRequest } from './apiClient.js';
export function ownerRequest(token, path = '', options = {}) {
  return apiRequest(`/agent/owners${path}`, { accessToken: token, ...options });
}
