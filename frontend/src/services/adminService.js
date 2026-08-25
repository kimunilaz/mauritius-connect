import { apiRequest } from './apiClient.js';

function list(path, accessToken, query = {}) {
  const params = new globalThis.URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== '') {
      params.set(key, value);
    }
  }
  return apiRequest(`${path}?${params}`, {
    accessToken,
    returnEnvelope: true,
  });
}

export const listAdminListings = (accessToken, query) =>
  list('/admin/listings', accessToken, query);

export const getAdminListing = (accessToken, listingId) =>
  apiRequest(`/admin/listings/${listingId}`, { accessToken });

export const reviewAdminListing = (accessToken, listingId, action, reason) =>
  apiRequest(`/admin/listings/${listingId}/${action}`, {
    accessToken,
    method: 'POST',
    body: reason ? { reason } : {},
  });

export const listAdminUsers = (accessToken, query) =>
  list('/admin/users', accessToken, query);

export const getAdminUser = (accessToken, userId) =>
  apiRequest(`/admin/users/${userId}`, { accessToken });

export const changeAdminUserStatus = (accessToken, userId, action) =>
  apiRequest(`/admin/users/${userId}/${action}`, {
    accessToken,
    method: 'POST',
    body: {},
  });
