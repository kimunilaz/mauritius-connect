import { apiRequest } from './apiClient.js';

function result(envelope) {
  return { application: envelope.data, meta: envelope.meta };
}

export async function createApplicationDraft(
  accessToken,
  listingId,
  fields = {},
  { signal } = {},
) {
  return result(
    await apiRequest(`/listings/${listingId}/applications`, {
      method: 'POST',
      accessToken,
      body: fields,
      signal,
      returnEnvelope: true,
    }),
  );
}

export async function getApplicationDraft(
  accessToken,
  applicationId,
  { signal } = {},
) {
  return result(
    await apiRequest(`/applications/${applicationId}`, {
      accessToken,
      signal,
      returnEnvelope: true,
    }),
  );
}

export async function listTenantApplications(
  accessToken,
  { page = 1, limit = 20, status, signal } = {},
) {
  const query = new globalThis.URLSearchParams({
    page: String(page),
    limit: String(limit),
  });
  if (status) query.set('status', status);
  const envelope = await apiRequest(`/tenant/applications?${query}`, {
    accessToken,
    signal,
    returnEnvelope: true,
  });
  return { applications: envelope.data, meta: envelope.meta };
}

export const getTenantApplication = getApplicationDraft;

export async function updateApplicationDraft(
  accessToken,
  applicationId,
  fields,
) {
  return result(
    await apiRequest(`/applications/${applicationId}`, {
      method: 'PATCH',
      accessToken,
      body: fields,
      returnEnvelope: true,
    }),
  );
}

export function getApplicationAnswers(
  accessToken,
  applicationId,
  { signal } = {},
) {
  return apiRequest(`/applications/${applicationId}/answers`, {
    accessToken,
    signal,
  });
}

export function putApplicationAnswers(accessToken, applicationId, answers) {
  return apiRequest(`/applications/${applicationId}/answers`, {
    method: 'PUT',
    accessToken,
    body: { answers },
  });
}

export async function submitApplication(accessToken, applicationId) {
  return result(
    await apiRequest(`/applications/${applicationId}/submit`, {
      method: 'POST',
      accessToken,
      returnEnvelope: true,
    }),
  );
}

export function withdrawApplication(accessToken, applicationId) {
  return apiRequest(`/applications/${applicationId}/withdraw`, {
    method: 'POST',
    accessToken,
    returnEnvelope: true,
  });
}
