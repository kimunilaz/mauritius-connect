import { apiRequest } from './apiClient.js';

export function listViewings(accessToken, applicationId, { signal } = {}) {
  return apiRequest(`/applications/${applicationId}/viewings`, {
    accessToken,
    signal,
  });
}

export function proposeViewing(accessToken, applicationId, input) {
  return apiRequest(`/landlord/applications/${applicationId}/viewings`, {
    method: 'POST',
    accessToken,
    body: input,
  });
}

function action(accessToken, viewingId, name) {
  return apiRequest(`/viewings/${viewingId}/${name}`, {
    method: 'POST',
    accessToken,
    returnEnvelope: true,
  });
}

export const confirmViewing = (token, id) => action(token, id, 'confirm');
export const declineViewing = (token, id) => action(token, id, 'decline');
export const cancelViewing = (token, id) => action(token, id, 'cancel');
export const completeViewing = (token, id) => action(token, id, 'complete');
export const noShowViewing = (token, id) => action(token, id, 'no-show');
