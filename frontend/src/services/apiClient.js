const viteEnvironment = import.meta.env ?? {};
const apiBaseUrl = (
  viteEnvironment.VITE_API_BASE_URL ?? 'http://localhost:3000/api/v1'
).replace(/\/$/, '');

export class ApiError extends Error {
  constructor({ status, code, message, fields }) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}

export async function apiRequest(
  path,
  { method = 'GET', accessToken, body, signal, returnEnvelope = false } = {},
) {
  const headers = { Accept: 'application/json' };

  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  const multipart =
    typeof globalThis.FormData !== 'undefined' &&
    body instanceof globalThis.FormData;

  if (body !== undefined && !multipart) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(`${apiBaseUrl}${path}`, {
    method,
    headers,
    body: body === undefined || multipart ? body : JSON.stringify(body),
    signal,
  });

  if (response.status === 204) {
    return null;
  }

  let payload;

  try {
    payload = await response.json();
  } catch {
    throw new ApiError({
      status: response.status,
      code: 'INVALID_API_RESPONSE',
      message: 'The server returned an invalid response.',
    });
  }

  if (!response.ok || payload.success !== true) {
    throw new ApiError({
      status: response.status,
      code: payload.error?.code ?? 'API_REQUEST_FAILED',
      message: payload.error?.message ?? 'The request could not be completed.',
      fields: payload.error?.fields,
    });
  }

  return returnEnvelope ? payload : payload.data;
}
