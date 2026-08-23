import { apiRequest } from './apiClient.js';

export async function listLandlordApplications(
  accessToken,
  listingId,
  { page = 1, limit = 20, status, signal } = {},
) {
  const query = new globalThis.URLSearchParams({
    page: String(page),
    limit: String(limit),
  });
  if (status) query.set('status', status);
  const envelope = await apiRequest(
    `/landlord/listings/${listingId}/applications?${query}`,
    { accessToken, signal, returnEnvelope: true },
  );
  return { applications: envelope.data, meta: envelope.meta };
}

export function getLandlordApplication(
  accessToken,
  applicationId,
  { signal } = {},
) {
  return apiRequest(`/landlord/applications/${applicationId}`, {
    accessToken,
    signal,
  });
}

function transitionApplication(accessToken, applicationId, action) {
  return apiRequest(`/landlord/applications/${applicationId}/${action}`, {
    method: 'POST',
    accessToken,
    returnEnvelope: true,
  });
}

export function reviewApplication(accessToken, applicationId) {
  return transitionApplication(accessToken, applicationId, 'review');
}

export function shortlistApplication(accessToken, applicationId) {
  return transitionApplication(accessToken, applicationId, 'shortlist');
}

export function rejectApplication(accessToken, applicationId) {
  return transitionApplication(accessToken, applicationId, 'reject');
}
