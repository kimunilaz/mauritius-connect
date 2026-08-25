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
    `/conversations?${new globalThis.URLSearchParams({ page, limit })}`,
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

export function listMessages(
  accessToken,
  conversationId,
  { page = 1, limit = 50, signal } = {},
) {
  return apiRequest(
    `/conversations/${conversationId}/messages?${new globalThis.URLSearchParams({ page, limit })}`,
    { accessToken, signal, returnEnvelope: true },
  );
}

export function sendMessage(accessToken, conversationId, body) {
  return apiRequest(`/conversations/${conversationId}/messages`, {
    method: 'POST',
    accessToken,
    body: { body },
  });
}

export function markConversationRead(accessToken, conversationId) {
  return apiRequest(`/conversations/${conversationId}/read`, {
    method: 'POST',
    accessToken,
    body: {},
  });
}
