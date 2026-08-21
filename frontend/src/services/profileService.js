import { apiRequest } from './apiClient.js';

export function getCurrentProfile(accessToken, options = {}) {
  return apiRequest('/auth/me', {
    accessToken,
    signal: options.signal,
  });
}

export function registerApplicationProfile(accessToken, profile) {
  return apiRequest('/auth/register-profile', {
    method: 'POST',
    accessToken,
    body: profile,
  });
}
