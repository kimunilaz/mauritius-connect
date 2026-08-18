const viteEnvironment = import.meta.env ?? {};
const apiBaseUrl = (
  viteEnvironment.VITE_API_BASE_URL ?? 'http://localhost:3000/api/v1'
).replace(/\/$/, '');

export async function getHealth(options = {}) {
  const response = await fetch(`${apiBaseUrl}/health`, {
    headers: {
      Accept: 'application/json',
    },
    signal: options.signal,
  });

  if (!response.ok) {
    throw new Error(`Health request failed with status ${response.status}.`);
  }

  const payload = await response.json();

  if (payload.success !== true || payload.data?.status !== 'ok') {
    throw new Error('Health response did not match the API contract.');
  }

  return payload.data;
}
