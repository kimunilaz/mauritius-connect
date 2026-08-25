import { apiRequest } from './apiClient.js';
export const createVerification = (accessToken, body) =>
  apiRequest('/landlord/verifications', { accessToken, method: 'POST', body });
export const listVerifications = (accessToken, query = '') =>
  apiRequest(`/landlord/verifications${query}`, { accessToken });
export const uploadVerificationEvidence = (accessToken, id, file) =>
  apiRequest(`/landlord/verifications/${id}/evidence`, {
    accessToken,
    method: 'POST',
    body: file,
  });
export const listAdminVerifications = (accessToken, query = '') =>
  apiRequest(`/admin/verifications${query}`, { accessToken });
export const getAdminVerification = (accessToken, id) =>
  apiRequest(`/admin/verifications/${id}`, { accessToken });
export const moderateVerification = (accessToken, id, action, body = {}) =>
  apiRequest(`/admin/verifications/${id}/${action}`, {
    accessToken,
    method: 'POST',
    body,
  });
