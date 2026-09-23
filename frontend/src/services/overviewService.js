import { apiRequest } from './apiClient.js';

export function checkedList(value, key = 'items') {
  const total = value?.total ?? value?.meta?.total;
  if (!Array.isArray(value?.[key]) || !Number.isInteger(total) || total < 0)
    throw new Error('Invalid overview response');
  return value;
}

export async function getOverview(role, accessToken, signal) {
  const result = await apiRequest(`/overview/${role}`, { accessToken, signal });
  for (const key of role === 'admin'
    ? ['listings', 'reports', 'verifications', 'users']
    : ['applications', 'viewings'])
    checkedList(result?.[key]);
  if (role === 'landlord' && !Number.isInteger(result.applications.waiting))
    throw new Error('Invalid overview response');
  return result;
}
