import { fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  activeProfile,
  createFakeSupabaseClient,
  createSession,
  jsonResponse,
  profileResponse,
  renderApp,
} from '../helpers/authTestUtils.jsx';

const emptyTenantProfile = {
  occupation_type: null,
  employer_or_school: null,
  income_range: null,
  preferred_move_date: null,
  preferred_lease_duration_months: null,
  number_of_occupants: null,
  has_pets: false,
  bio: null,
};

function mockTenantApi() {
  return vi.fn(async (url, options = {}) => {
    if (url.endsWith('/auth/me')) return profileResponse();
    if (
      url.includes('/tenant/preferred-locations/') &&
      options.method === 'DELETE'
    ) {
      return { ok: true, status: 204 };
    }
    if (url.endsWith('/tenant/profile')) {
      return jsonResponse(200, { success: true, data: emptyTenantProfile });
    }
    if (url.endsWith('/tenant/preferred-locations')) {
      if (options.method === 'POST') {
        return jsonResponse(201, {
          success: true,
          data: {
            id: '30000000-0000-4000-8000-000000000001',
            district: 'Moka',
            locality: null,
            neighbourhood: null,
          },
        });
      }
      return jsonResponse(200, { success: true, data: [] });
    }
    if (url.endsWith('/profile')) {
      return jsonResponse(200, {
        success: true,
        data: { first_name: 'Jane', last_name: 'Doe', phone: null },
      });
    }
    throw new Error(`Unexpected URL: ${url}`);
  });
}

afterEach(() => vi.unstubAllGlobals());

describe('tenant profile page', () => {
  it('renders accessible sections and sends bearer-authenticated updates', async () => {
    const fetchMock = mockTenantApi();
    vi.stubGlobal('fetch', fetchMock);
    renderApp({
      route: '/tenant/profile',
      client: createFakeSupabaseClient({ session: createSession() }),
    });

    expect(
      await screen.findByRole('heading', { name: 'Your rental profile' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Personal details' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Rental preferences' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Preferred locations' }),
    ).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Occupation'), {
      target: { value: 'STUDENT' },
    });
    fireEvent.change(screen.getByLabelText('Number of occupants'), {
      target: { value: '2' },
    });
    fireEvent.click(
      screen.getByRole('button', { name: 'Save rental preferences' }),
    );

    await screen.findByText('Rental preferences saved.');
    const patch = fetchMock.mock.calls.find(
      ([url, options]) =>
        url.endsWith('/tenant/profile') && options.method === 'PATCH',
    );
    expect(patch[1].headers.Authorization).toBe('Bearer verified-access-token');
    expect(JSON.parse(patch[1].body)).toMatchObject({
      occupation_type: 'STUDENT',
      number_of_occupants: 2,
    });
  });

  it('adds a structured preferred location', async () => {
    const fetchMock = mockTenantApi();
    vi.stubGlobal('fetch', fetchMock);
    renderApp({
      route: '/tenant/profile',
      client: createFakeSupabaseClient({ session: createSession() }),
    });

    fireEvent.change(await screen.findByLabelText('District'), {
      target: { value: 'Moka' },
    });
    fireEvent.click(
      screen.getByRole('button', { name: 'Add preferred location' }),
    );
    expect(
      await screen.findByText('Preferred location added.'),
    ).toBeInTheDocument();
    expect(screen.getByText('Moka')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }));
    expect(
      await screen.findByText('Preferred location removed.'),
    ).toBeInTheDocument();
    expect(screen.queryByText('Moka')).not.toBeInTheDocument();
  });

  it('displays server validation errors clearly', async () => {
    const fetchMock = mockTenantApi();
    fetchMock
      .mockImplementationOnce(async () => profileResponse())
      .mockImplementationOnce(async () =>
        jsonResponse(200, { success: true, data: emptyTenantProfile }),
      )
      .mockImplementationOnce(async () =>
        jsonResponse(200, { success: true, data: [] }),
      )
      .mockImplementationOnce(async () =>
        jsonResponse(422, {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Some fields are invalid.',
            fields: { number_of_occupants: 'Must be at least 1.' },
          },
        }),
      );
    vi.stubGlobal('fetch', fetchMock);
    renderApp({
      route: '/tenant/profile',
      client: createFakeSupabaseClient({ session: createSession() }),
    });

    await screen.findByRole('heading', { name: 'Your rental profile' });
    fireEvent.click(
      screen.getByRole('button', { name: 'Save rental preferences' }),
    );
    expect(await screen.findByText('Must be at least 1.')).toBeInTheDocument();
  });

  it('redirects a landlord away from the tenant route', async () => {
    const landlord = { ...activeProfile, role: 'LANDLORD' };
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(profileResponse(landlord)),
    );
    renderApp({
      route: '/tenant/profile',
      client: createFakeSupabaseClient({ session: createSession() }),
    });
    expect(
      await screen.findByRole('heading', { name: 'Jane Doe' }),
    ).toBeInTheDocument();
    expect(screen.queryByText('Your rental profile')).not.toBeInTheDocument();
  });
});

describe('landlord profile page', () => {
  it('shows read-only verification state and saves only base fields', async () => {
    const landlord = { ...activeProfile, role: 'LANDLORD' };
    const fetchMock = vi.fn(async (url, options = {}) => {
      if (url.endsWith('/auth/me')) return profileResponse(landlord);
      if (url.endsWith('/landlord/profile')) {
        return jsonResponse(200, {
          success: true,
          data: {
            first_name: 'Jane',
            last_name: 'Doe',
            phone: null,
            verification_status: 'UNVERIFIED',
          },
        });
      }
      throw new Error(`Unexpected URL ${url} ${options.method}`);
    });
    vi.stubGlobal('fetch', fetchMock);
    renderApp({
      route: '/landlord/profile',
      client: createFakeSupabaseClient({ session: createSession() }),
    });

    expect(
      await screen.findByRole('heading', { name: 'Your landlord details' }),
    ).toBeInTheDocument();
    expect(screen.getByText('UNVERIFIED')).toBeInTheDocument();
    expect(
      screen.queryByRole('textbox', { name: /verification status/i }),
    ).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('First name'), {
      target: { value: 'Marie' },
    });
    fireEvent.click(
      screen.getByRole('button', { name: 'Save landlord profile' }),
    );
    await waitFor(() => {
      const requestCall = fetchMock.mock.calls.find(
        ([url, options]) =>
          url.endsWith('/landlord/profile') && options.method === 'PATCH',
      );
      expect(JSON.parse(requestCall[1].body)).toEqual({
        first_name: 'Marie',
        last_name: 'Doe',
        phone: null,
      });
    });
  });

  it('redirects unauthenticated access to login', async () => {
    renderApp({ route: '/landlord/profile' });
    expect(
      await screen.findByRole('heading', { name: 'Log in' }),
    ).toBeInTheDocument();
  });
});
