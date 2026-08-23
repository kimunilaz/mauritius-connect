import { apiRequest } from './apiClient.js';

export async function listPublicListings(filters = {}, { signal } = {}) {
  const query = new globalThis.URLSearchParams();
  for (const [field, value] of Object.entries(filters)) {
    if (value !== undefined && value !== null && value !== '') {
      query.set(field, String(value));
    }
  }
  const suffix = query.size ? `?${query}` : '';
  const envelope = await apiRequest(`/listings${suffix}`, {
    signal,
    returnEnvelope: true,
  });
  return { listings: envelope.data, meta: envelope.meta };
}

export function getPublicListing(listingId, { signal } = {}) {
  return apiRequest(`/listings/${listingId}`, { signal });
}

export function createListing(accessToken, listing) {
  return apiRequest('/listings', {
    method: 'POST',
    accessToken,
    body: listing,
  });
}

export async function listLandlordListings(
  accessToken,
  { page = 1, limit = 20, status } = {},
) {
  const query = new globalThis.URLSearchParams({
    page: String(page),
    limit: String(limit),
  });
  if (status) query.set('status', status);
  const envelope = await apiRequest(`/landlord/listings?${query}`, {
    accessToken,
    returnEnvelope: true,
  });
  return { listings: envelope.data, meta: envelope.meta };
}

export function getLandlordListing(accessToken, listingId) {
  return apiRequest(`/landlord/listings/${listingId}`, { accessToken });
}

export function updateListing(accessToken, listingId, listing) {
  return apiRequest(`/listings/${listingId}`, {
    method: 'PATCH',
    accessToken,
    body: listing,
  });
}

function listingAction(action) {
  return (accessToken, listingId) =>
    apiRequest(`/listings/${listingId}/${action}`, {
      method: 'POST',
      accessToken,
    });
}

export const publishListing = listingAction('publish');
export const pauseListing = listingAction('pause');
export const activateListing = listingAction('activate');
export const closeListing = listingAction('close');
