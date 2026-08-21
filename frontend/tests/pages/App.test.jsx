import { screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderApp } from '../helpers/authTestUtils.jsx';

describe('application bootstrap', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, data: { status: 'ok' } }),
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders the platform bootstrap page and confirms the API connection', async () => {
    renderApp();

    expect(
      screen.getByRole('heading', { name: 'Mauritius Rental Platform' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Platform foundation is running.'),
    ).toBeInTheDocument();
    expect(await screen.findByText('API connected')).toBeInTheDocument();
  });

  it('renders the not-found fallback for an unknown route', () => {
    renderApp({ route: '/missing' });

    expect(
      screen.getByRole('heading', { name: 'Page not found' }),
    ).toBeInTheDocument();
  });
});
