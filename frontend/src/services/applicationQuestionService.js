import { apiRequest } from './apiClient.js';

export async function listLandlordApplicationQuestions(
  accessToken,
  listingId,
  { signal } = {},
) {
  const envelope = await apiRequest(
    `/landlord/listings/${listingId}/application-questions`,
    { accessToken, signal, returnEnvelope: true },
  );
  return { questions: envelope.data, meta: envelope.meta };
}

export function listPublicApplicationQuestions(listingId, { signal } = {}) {
  return apiRequest(`/listings/${listingId}/application-questions`, { signal });
}

export function createApplicationQuestion(accessToken, listingId, question) {
  return apiRequest(`/listings/${listingId}/application-questions`, {
    method: 'POST',
    accessToken,
    body: question,
  });
}

export function updateApplicationQuestion(
  accessToken,
  listingId,
  questionId,
  question,
) {
  return apiRequest(
    `/listings/${listingId}/application-questions/${questionId}`,
    { method: 'PATCH', accessToken, body: question },
  );
}

export function deleteApplicationQuestion(accessToken, listingId, questionId) {
  return apiRequest(
    `/listings/${listingId}/application-questions/${questionId}`,
    { method: 'DELETE', accessToken },
  );
}
