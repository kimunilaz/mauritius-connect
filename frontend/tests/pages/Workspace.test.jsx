import { ownerOperations } from '../../../e2e/workspace-fixtures.js';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  activeProfile,
  createFakeSupabaseClient,
  createSession,
  jsonResponse,
  profileResponse,
  renderApp,
} from '../helpers/authTestUtils.jsx';

afterEach(() => vi.unstubAllGlobals());
const landlord = { ...activeProfile, role: 'LANDLORD' };

function setup({ failOverview = false, role = 'LANDLORD' } = {}) {
  let fail = failOverview;
  const client = createFakeSupabaseClient({ session: createSession() });
  const fetchMock = vi.fn(async (input) => {
    const url = new globalThis.URL(input);
    if (url.pathname.endsWith('/auth/me'))
      return profileResponse({ ...landlord, role });
    if (fail)
      return jsonResponse(503, {
        success: false,
        error: { code: 'UNAVAILABLE', message: 'Service unavailable.' },
      });
    if (url.pathname.endsWith('/operations/summary'))
      return jsonResponse(200, { success: true, data: ownerOperations() });
    const status = url.searchParams.get('status');
    const total = url.pathname.endsWith('/properties')
      ? 8
      : status === 'ACTIVE'
        ? 4
        : status === 'PENDING_REVIEW'
          ? 2
          : status === 'DRAFT'
            ? 1
            : 7;
    return jsonResponse(200, {
      success: true,
      data: [],
      meta: { total, page: 1, total_pages: 1 },
    });
  });
  vi.stubGlobal('fetch', fetchMock);
  renderApp({ route: '/account', client });
  return {
    client,
    fetchMock,
    recover: () => {
      fail = false;
    },
  };
}

describe('rental workspace', () => {
  it('lets a user retry a temporarily unavailable account', async () => {
    let recovered = false;
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        recovered
          ? profileResponse()
          : jsonResponse(503, {
              success: false,
              error: {
                code: 'UNAVAILABLE',
                message: 'Your profile is temporarily unavailable.',
              },
            }),
      ),
    );
    renderApp({
      route: '/account',
      client: createFakeSupabaseClient({ session: createSession() }),
    });
    expect(
      await screen.findByRole('heading', { name: 'Account unavailable' }),
    ).toBeInTheDocument();
    recovered = true;
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(
      await screen.findByRole('heading', { name: 'Welcome back, Jane' }),
    ).toBeInTheDocument();
  });

  it('lets a rejected session return to login', async () => {
    const client = createFakeSupabaseClient({ session: createSession() });
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse(401, {
          success: false,
          error: {
            code: 'INVALID_TOKEN',
            message: 'The access token is invalid or expired.',
          },
        }),
      ),
    );
    renderApp({ route: '/account', client });
    fireEvent.click(
      await screen.findByRole('button', { name: 'Return to login' }),
    );
    expect(
      await screen.findByRole('button', { name: 'Log in' }),
    ).toBeInTheDocument();
    expect(client.auth.signOut).toHaveBeenCalledOnce();
  });

  it('uses real portfolio totals and property actions', async () => {
    const { fetchMock } = setup();
    await screen.findByText('Rent overdue');
    expect(screen.getByText('8')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Moka apartment' }),
    ).toHaveAttribute('href', expect.stringContaining('/owner/properties/'));
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/operations/summary'),
      expect.anything(),
    );
  });
  it('shows summary errors without invented totals and recovers', async () => {
    const { recover } = setup({ failOverview: true });
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Service unavailable',
    );
    expect(screen.queryByText('8')).not.toBeInTheDocument();
    recover();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await screen.findByText('Rent overdue');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('closes mobile navigation after following a workspace link', async () => {
    setup();
    const navigation = await screen.findByRole('navigation', {
      name: 'Owner navigation',
    });
    fireEvent.click(screen.getByRole('button', { name: 'Menu' }));
    expect(screen.getByRole('button', { name: 'Close menu' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    fireEvent.click(
      within(navigation).getByRole('link', { name: 'Properties' }),
    );
    expect(
      await screen.findByRole('heading', { name: 'Properties' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Menu' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
  });

  it('offers tenant navigation without landlord actions', async () => {
    setup({ role: 'TENANT' });
    const navigation = await screen.findByRole('navigation', {
      name: 'Tenant navigation',
    });
    expect(
      within(navigation).getByRole('link', { name: 'Applications' }),
    ).toBeInTheDocument();
    expect(
      within(navigation).queryByRole('link', { name: 'Properties' }),
    ).not.toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Log out' })).toHaveLength(1);
  });

  it('logs out from any workspace page', async () => {
    const { client } = setup();
    fireEvent.click(await screen.findByRole('button', { name: 'Log out' }));
    await waitFor(() => expect(client.auth.signOut).toHaveBeenCalledOnce());
    expect(
      await screen.findByRole('button', { name: 'Log in' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('navigation', { name: 'Owner navigation' }),
    ).not.toBeInTheDocument();
  });
});
