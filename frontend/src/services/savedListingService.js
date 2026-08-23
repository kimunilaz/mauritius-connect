import { apiRequest } from './apiClient.js';

export async function listSavedListings(
  accessToken,
  { page = 1, limit = 20, signal } = {},
) {
  const query = new globalThis.URLSearchParams({
    page: String(page),
    limit: String(limit),
  });
  const envelope = await apiRequest(`/tenant/saved-listings?${query}`, {
    accessToken,
    signal,
    returnEnvelope: true,
  });
  return { saves: envelope.data, meta: envelope.meta };
}

export function getSavedListingStatus(accessToken, listingId, { signal } = {}) {
  return apiRequest(`/tenant/saved-listings/${listingId}/status`, {
    accessToken,
    signal,
  });
}

export function saveListing(accessToken, listingId) {
  return apiRequest(`/listings/${listingId}/save`, {
    method: 'POST',
    accessToken,
  });
}

export function removeSavedListing(accessToken, listingId) {
  return apiRequest(`/listings/${listingId}/save`, {
    method: 'DELETE',
    accessToken,
  });
}
