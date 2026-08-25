import { apiRequest } from './apiClient.js';

export function createReport(accessToken, input) {
  return apiRequest('/reports', {
    method: 'POST',
    accessToken,
    body: input,
  });
}

export async function listAdminReports(
  accessToken,
  { page = 1, limit = 20, status, targetType, signal } = {},
) {
  const params = new globalThis.URLSearchParams({ page, limit });
  if (status) params.set('status', status);
  if (targetType) params.set('target_type', targetType);
  const response = await apiRequest(`/admin/reports?${params}`, {
    accessToken,
    signal,
    returnEnvelope: true,
  });
  return { reports: response.data, meta: response.meta };
}

export function getAdminReport(accessToken, reportId, { signal } = {}) {
  return apiRequest(`/admin/reports/${reportId}`, {
    accessToken,
    signal,
  });
}

export function moderateReport(accessToken, reportId, action, reason = '') {
  return apiRequest(`/admin/reports/${reportId}/${action}`, {
    method: 'POST',
    accessToken,
    body: reason ? { reason } : {},
  });
}
