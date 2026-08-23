export const LISTING_STATUSES = [
  'DRAFT',
  'PENDING_REVIEW',
  'ACTIVE',
  'PAUSED',
  'RENTED',
  'CLOSED',
];

export const PUBLIC_PROPERTY_TYPES = [
  'APARTMENT',
  'HOUSE',
  'STUDIO',
  'ROOM',
  'TOWNHOUSE',
  'VILLA',
  'OTHER',
];

export function listingStatusLabel(status) {
  return status
    .toLowerCase()
    .replaceAll('_', ' ')
    .replace(/^./, (letter) => letter.toUpperCase());
}

const mur = new Intl.NumberFormat('en-MU', { maximumFractionDigits: 2 });

export function formatRent(value) {
  return `Rs ${mur.format(value)} / month`;
}

export function formatPublicRent(value) {
  return `Rs ${mur.format(value)}/month`;
}

export function formatDate(value) {
  const date = new Date(`${value}T12:00:00.000Z`);
  if (Number.isNaN(date.valueOf())) return value;
  return new Intl.DateTimeFormat('en-MU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

export function publicPropertyTypeLabel(type) {
  return type
    .toLowerCase()
    .replaceAll('_', ' ')
    .replace(/^./, (letter) => letter.toUpperCase());
}

export function publicLocation(property) {
  return [property.neighbourhood, property.locality, property.district]
    .filter(Boolean)
    .filter((value, index, values) => values.indexOf(value) === index)
    .join(', ');
}
