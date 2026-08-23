import { apiRequest } from './apiClient.js';

export function createProperty(accessToken, property) {
  return apiRequest('/properties', {
    method: 'POST',
    accessToken,
    body: property,
  });
}

export async function listLandlordProperties(
  accessToken,
  { page = 1, limit = 20, archived = false } = {},
) {
  const query = new globalThis.URLSearchParams({
    page: String(page),
    limit: String(limit),
    archived: String(archived),
  });
  const envelope = await apiRequest(`/landlord/properties?${query}`, {
    accessToken,
    returnEnvelope: true,
  });
  return { properties: envelope.data, meta: envelope.meta };
}

export function getProperty(accessToken, propertyId) {
  return apiRequest(`/properties/${propertyId}`, { accessToken });
}

export function updateProperty(accessToken, propertyId, property) {
  return apiRequest(`/properties/${propertyId}`, {
    method: 'PATCH',
    accessToken,
    body: property,
  });
}

export function archiveProperty(accessToken, propertyId) {
  return apiRequest(`/properties/${propertyId}/archive`, {
    method: 'POST',
    accessToken,
  });
}

export function uploadPropertyImage(accessToken, propertyId, file) {
  const body = new globalThis.FormData();
  body.append('image', file);
  return apiRequest(`/properties/${propertyId}/images`, {
    method: 'POST',
    accessToken,
    body,
  });
}

export function updatePropertyImage(accessToken, propertyId, imageId, update) {
  return apiRequest(`/properties/${propertyId}/images/${imageId}`, {
    method: 'PATCH',
    accessToken,
    body: update,
  });
}

export function deletePropertyImage(accessToken, propertyId, imageId) {
  return apiRequest(`/properties/${propertyId}/images/${imageId}`, {
    method: 'DELETE',
    accessToken,
  });
}
