import { apiRequest } from './apiClient.js';

export function createConversation(accessToken, listingId) {
  return apiRequest(`/listings/${listingId}/conversation`, {
    method: 'POST',
    accessToken,
    body: {},
  });
}

export async function listConversations(
  accessToken,
  { page = 1, limit = 20, signal } = {},
) {
  const response = await apiRequest(
    `/conversations?${new URLSearchParams({ page, limit })}`,
    { accessToken, signal, returnEnvelope: true },
  );
  return { conversations: response.data, meta: response.meta };
}

export function getConversation(accessToken, conversationId, { signal } = {}) {
  return apiRequest(`/conversations/${conversationId}`, {
    accessToken,
    signal,
  });
}
