import { apiRequest } from './apiClient.js';
export function operationRequest(token, path = '', options = {}) {
  return apiRequest(`/landlord/operations${path}`, {
    accessToken: token,
    ...options,
  });
}
export function tenantOperationRequest(token, path = '', options = {}) {
  return apiRequest(`/tenant/operations${path}`, {
    accessToken: token,
    ...options,
  });
}
export function queryString(fields) {
  return new globalThis.URLSearchParams(
    Object.entries(fields).filter(
      ([, v]) => v !== '' && v !== undefined && v !== null,
    ),
  ).toString();
}
