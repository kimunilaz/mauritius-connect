import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiRequest } from '../../src/services/apiClient.js';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

function pendingRequest() {
  vi.stubGlobal(
    'fetch',
    vi.fn(
      (url, { signal }) =>
        new Promise((resolve, reject) => {
          signal.addEventListener('abort', () => reject(signal.reason), {
            once: true,
          });
        }),
    ),
  );
}

describe('API request recovery', () => {
  it('ends a stalled request with a useful timeout error', async () => {
    vi.useFakeTimers();
    pendingRequest();
    const result = expect(
      apiRequest('/listings', { timeoutMs: 1000 }),
    ).rejects.toMatchObject({ code: 'REQUEST_TIMEOUT' });
    await vi.advanceTimersByTimeAsync(1000);
    await result;
    expect(vi.getTimerCount()).toBe(0);
  });

  it('preserves cancellation when a page is left', async () => {
    vi.useFakeTimers();
    pendingRequest();
    const controller = new AbortController();
    const result = expect(
      apiRequest('/listings', { signal: controller.signal }),
    ).rejects.toMatchObject({ name: 'AbortError' });
    controller.abort();
    await result;
    expect(vi.getTimerCount()).toBe(0);
  });

  it('cleans up the deadline after a successful response', async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ success: true, data: [] }),
      }),
    );
    await expect(apiRequest('/listings')).resolves.toEqual([]);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('gives image uploads more time and explains uncertain save outcomes', async () => {
    vi.useFakeTimers();
    pendingRequest();
    const result = expect(
      apiRequest('/images', {
        method: 'POST',
        body: new globalThis.FormData(),
      }),
    ).rejects.toMatchObject({
      code: 'REQUEST_TIMEOUT',
      message: expect.stringContaining('Check whether your changes were saved'),
    });
    await vi.advanceTimersByTimeAsync(30000);
    expect(fetch.mock.calls[0][1].signal.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(90000);
    await result;
    expect(vi.getTimerCount()).toBe(0);
  });
});
