export function statusLabel(value) {
  if (!value) return 'Not provided';
  if (value === 'VIEWING_INVITED') return 'Viewing proposed';
  return value
    .toLowerCase()
    .replaceAll('_', ' ')
    .replace(/^./, (letter) => letter.toUpperCase());
}
