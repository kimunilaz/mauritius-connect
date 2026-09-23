import { fireEvent, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderApp } from '../helpers/authTestUtils.jsx';

describe('application bootstrap', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, data: [], meta: { total: 0 } }),
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('offers a rental search and separate tenant and landlord journeys', async () => {
    renderApp();

    expect(
      screen.getByRole('heading', {
        name: 'Find a place to rent in Mauritius',
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', {
        name: 'Manage your properties with Asserta',
      }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Location')).toBeInTheDocument();
    expect(
      screen.queryByText('Platform foundation is running.'),
    ).not.toBeInTheDocument();
  });

  it('passes the homepage locality into rental search', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          data: [],
          meta: { page: 1, total: 0, total_pages: 0 },
        }),
      }),
    );
    renderApp();
    fireEvent.change(screen.getByLabelText('Location'), {
      target: { value: 'Moka' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Search rentals/ }));
    expect(await screen.findByDisplayValue('Moka')).toBeInTheDocument();
  });

  it('renders the not-found fallback for an unknown route', () => {
    renderApp({ route: '/missing' });

    expect(
      screen.getByRole('heading', { name: 'Page not found' }),
    ).toBeInTheDocument();
  });
});
