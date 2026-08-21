import { apiRequest } from './apiClient.js';

export const getTenantProfile = (accessToken) =>
  apiRequest('/tenant/profile', { accessToken });
export const updateTenantProfile = (accessToken, profile) =>
  apiRequest('/tenant/profile', {
    method: 'PATCH',
    accessToken,
    body: profile,
  });
export const updateBaseProfile = (accessToken, profile) =>
  apiRequest('/profile', {
    method: 'PATCH',
    accessToken,
    body: profile,
  });
export const getPreferredLocations = (accessToken) =>
  apiRequest('/tenant/preferred-locations', { accessToken });
export const addPreferredLocation = (accessToken, location) =>
  apiRequest('/tenant/preferred-locations', {
    method: 'POST',
    accessToken,
    body: location,
  });
export const deletePreferredLocation = (accessToken, locationId) =>
  apiRequest(`/tenant/preferred-locations/${locationId}`, {
    method: 'DELETE',
    accessToken,
  });
export const getLandlordProfile = (accessToken) =>
  apiRequest('/landlord/profile', { accessToken });
export const updateLandlordProfile = (accessToken, profile) =>
  apiRequest('/landlord/profile', {
    method: 'PATCH',
    accessToken,
    body: profile,
  });
