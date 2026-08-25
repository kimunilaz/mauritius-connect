import { apiRequest } from './apiClient.js';

export async function listNotifications(
  accessToken,
  { page = 1, limit = 20, unreadOnly = false, signal } = {},
) {
  const response = await apiRequest(
    `/notifications?${new globalThis.URLSearchParams({
      page,
      limit,
      unread_only: unreadOnly,
    })}`,
    { accessToken, signal, returnEnvelope: true },
  );
  return { notifications: response.data, meta: response.meta };
}

export function getUnreadNotificationCount(accessToken, { signal } = {}) {
  return apiRequest('/notifications/unread-count', {
    accessToken,
    signal,
  });
}

export function markNotificationRead(accessToken, notificationId) {
  return apiRequest(`/notifications/${notificationId}/read`, {
    method: 'POST',
    accessToken,
    body: {},
  });
}

export function markAllNotificationsRead(accessToken) {
  return apiRequest('/notifications/read-all', {
    method: 'POST',
    accessToken,
    body: {},
  });
}
