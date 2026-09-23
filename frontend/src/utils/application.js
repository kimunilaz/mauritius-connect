export const APPLICATION_STATUSES = Object.freeze([
  'DRAFT',
  'SUBMITTED',
  'UNDER_REVIEW',
  'SHORTLISTED',
  'VIEWING_INVITED',
  'VIEWING_COMPLETED',
  'ACCEPTED',
  'REJECTED',
  'WITHDRAWN',
]);

export { statusLabel as applicationStatusLabel } from './status.js';

export function applicationDate(value) {
  if (!value) return 'Not provided';
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return value;
  return new Intl.DateTimeFormat('en-MU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date);
}
