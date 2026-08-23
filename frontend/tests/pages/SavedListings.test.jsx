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

const LISTING_ID = '80000000-0000-4000-8000-000000000001';
const landlordProfile = { ...activeProfile, role: 'LANDLORD' };
const sessionClient = () =>
  createFakeSupabaseClient({ session: createSession() });

function publicListing(overrides = {}) {
  return {
    id: LISTING_ID,
    title: 'Modern apartment in Moka',
    monthly_rent: 18000,
    available_from: '2026-10-01',
    minimum_lease_months: 6,
    maximum_occupants: 3,
    pets_allowed: true,
    published_at: '2026-08-20T10:00:00.000Z',
    cover_image_url: 'https://storage.test/signed-cover',
    property: {
      property_type: 'APARTMENT',
      district: 'Moka',
      locality: 'Saint Pierre',
      neighbourhood: 'Helvetia',
      bedrooms: 2,
      bathrooms: 1.5,
      furnished: true,
      parking_spaces: 1,
      property_information_verified: false,
    },
    ...overrides,
  };
}

function publicDetail() {
  return {
    ...publicListing(),
    description: 'A bright and comfortable home.',
    deposit_amount: 18000,
    images: [],
  };
}

function savedListResponse(saves = [], meta) {
  return jsonResponse(200, {
    success: true,
    data: saves,
    meta: meta ?? {
      page: 1,
      limit: 20,
      total: saves.length,
      total_pages: saves.length ? 1 : 0,
    },
  });
}

function availableSave() {
  return {
    listing_id: LISTING_ID,
    saved_at: '2026-08-21T10:00:00.000Z',
    availability: 'AVAILABLE',
    listing: publicListing(),
  };
}

function unavailableSave() {
  return {
    listing_id: LISTING_ID,
    saved_at: '2026-08-21T10:00:00.000Z',
    availability: 'UNAVAILABLE',
    listing: null,
    former_title: 'Private former listing title',
    storage_path: 'private/former/path.jpg',
  };
}

afterEach(() => vi.unstubAllGlobals());

describe('saved rentals route and list', () => {
  it('redirects logged-out visitors to login', async () => {
    renderApp({ route: '/tenant/saved-listings' });
    expect(
      await screen.findByRole('heading', { name: 'Log in' }),
    ).toBeVisible();
  });

  it('redirects a LANDLORD away from the tenant saved route', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(profileResponse(landlordProfile)),
    );
    renderApp({ route: '/tenant/saved-listings', client: sessionClient() });
    expect(
      await screen.findByRole('heading', { name: 'Jane Doe' }),
    ).toBeVisible();
    expect(screen.queryByText('Saved rentals')).not.toBeInTheDocument();
  });

  it('shows an empty state with a public browsing action', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url) => {
        if (url.endsWith('/auth/me')) return profileResponse();
        if (url.includes('/tenant/saved-listings?')) return savedListResponse();
        throw new Error(`Unexpected URL ${url}`);
      }),
    );
    renderApp({ route: '/tenant/saved-listings', client: sessionClient() });
    expect(await screen.findByText('No saved rentals yet')).toBeVisible();
    expect(
      screen.getAllByRole('link', { name: 'Browse rentals' })[0],
    ).toHaveAttribute('href', '/listings');
  });

  it('renders an AVAILABLE save using the public listing card', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url) => {
        if (url.endsWith('/auth/me')) return profileResponse();
        if (url.includes('/tenant/saved-listings?')) {
          return savedListResponse([availableSave()]);
        }
        throw new Error(`Unexpected URL ${url}`);
      }),
    );
    renderApp({ route: '/tenant/saved-listings', client: sessionClient() });
    expect(
      await screen.findByRole('heading', {
        name: 'Modern apartment in Moka',
      }),
    ).toBeVisible();
    expect(screen.getByText('Rs 18,000/month')).toBeVisible();
    expect(screen.getByAltText(/Cover photo/)).toHaveAttribute(
      'src',
      'https://storage.test/signed-cover',
    );
  });

  it('renders only a minimal unavailable state without former private fields', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url) => {
        if (url.endsWith('/auth/me')) return profileResponse();
        if (url.includes('/tenant/saved-listings?')) {
          return savedListResponse([unavailableSave()]);
        }
        throw new Error(`Unexpected URL ${url}`);
      }),
    );
    renderApp({ route: '/tenant/saved-listings', client: sessionClient() });
    expect(
      await screen.findByRole('heading', {
        name: 'This rental is no longer available',
      }),
    ).toBeVisible();
    expect(screen.getByText(/listing details are private now/i)).toBeVisible();
    expect(
      screen.queryByText('Private former listing title'),
    ).not.toBeInTheDocument();
    expect(document.body.textContent).not.toContain('private/former/path.jpg');
  });

  it('removes an unavailable save after backend confirmation', async () => {
    let removed = false;
    const fetchMock = vi.fn(async (url, options = {}) => {
      if (url.endsWith('/auth/me')) return profileResponse();
      if (url.includes('/tenant/saved-listings?')) {
        return savedListResponse(removed ? [] : [unavailableSave()]);
      }
      if (
        url.endsWith(`/listings/${LISTING_ID}/save`) &&
        options.method === 'DELETE'
      ) {
        removed = true;
        return { ok: true, status: 204 };
      }
      throw new Error(`Unexpected URL ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);
    renderApp({ route: '/tenant/saved-listings', client: sessionClient() });
    await screen.findByText('This rental is no longer available');
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }));
    expect(await screen.findByText('No saved rentals yet')).toBeVisible();
    expect(
      fetchMock.mock.calls.some(
        ([url, options]) =>
          url.endsWith(`/listings/${LISTING_ID}/save`) &&
          options.method === 'DELETE' &&
          options.headers.Authorization === 'Bearer verified-access-token',
      ),
    ).toBe(true);
  });

  it('shows loading and safe API error states with retry', async () => {
    let resolveList;
    const pending = new Promise((resolve) => {
      resolveList = resolve;
    });
    vi.stubGlobal(
      'fetch',
      vi.fn((url) => {
        if (url.endsWith('/auth/me')) return Promise.resolve(profileResponse());
        if (url.includes('/tenant/saved-listings?')) return pending;
        throw new Error(`Unexpected URL ${url}`);
      }),
    );
    renderApp({ route: '/tenant/saved-listings', client: sessionClient() });
    expect(await screen.findByText('Loading saved rentals...')).toBeVisible();
    resolveList(
      jsonResponse(503, {
        success: false,
        error: {
          code: 'UNAVAILABLE',
          message: 'Saved rentals are unavailable.',
        },
      }),
    );
    expect(
      await screen.findByText('Saved rentals are unavailable.'),
    ).toBeVisible();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeEnabled();
  });

  it('supports saved-list pagination', async () => {
    const fetchMock = vi.fn(async (url) => {
      if (url.endsWith('/auth/me')) return profileResponse();
      if (url.includes('/tenant/saved-listings?')) {
        return savedListResponse([availableSave()], {
          page: url.includes('page=2') ? 2 : 1,
          limit: 20,
          total: 21,
          total_pages: 2,
        });
      }
      throw new Error(`Unexpected URL ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);
    renderApp({ route: '/tenant/saved-listings', client: sessionClient() });
    expect(await screen.findByText('Page 1 of 2')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    await waitFor(() =>
      expect(fetchMock.mock.calls.some(([url]) => url.includes('page=2'))).toBe(
        true,
      ),
    );
  });
});

describe('public listing detail saved control', () => {
  it('offers logged-out visitors a login affordance without blocking detail', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          jsonResponse(200, { success: true, data: publicDetail() }),
        ),
    );
    renderApp({ route: `/listings/${LISTING_ID}` });
    expect(
      await screen.findByRole('heading', {
        name: 'Modern apartment in Moka',
      }),
    ).toBeVisible();
    expect(
      screen.getByRole('link', { name: 'Log in to save' }),
    ).toHaveAttribute('href', '/login');
  });

  it('loads initial TENANT saved state and supports unsave then save', async () => {
    let saved = true;
    const fetchMock = vi.fn(async (url, options = {}) => {
      if (url.endsWith('/auth/me')) return profileResponse();
      if (url.endsWith(`/listings/${LISTING_ID}`)) {
        return jsonResponse(200, { success: true, data: publicDetail() });
      }
      if (url.endsWith(`/tenant/saved-listings/${LISTING_ID}/status`)) {
        return jsonResponse(200, {
          success: true,
          data: { listing_id: LISTING_ID, saved },
        });
      }
      if (url.endsWith(`/listings/${LISTING_ID}/save`)) {
        saved = options.method === 'POST';
        return options.method === 'DELETE'
          ? { ok: true, status: 204 }
          : jsonResponse(200, {
              success: true,
              data: { listing_id: LISTING_ID, saved: true },
            });
      }
      throw new Error(`Unexpected URL ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);
    renderApp({ route: `/listings/${LISTING_ID}`, client: sessionClient() });
    const remove = await screen.findByRole('button', {
      name: 'Saved — remove',
    });
    expect(remove).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(remove);
    expect(
      await screen.findByText('Removed from saved rentals.'),
    ).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Save rental' }));
    expect(await screen.findByText('Rental saved.')).toBeVisible();
    expect(
      screen.getByRole('button', { name: 'Saved — remove' }),
    ).toBeVisible();
  });

  it('does not render tenant save controls for a LANDLORD', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url) => {
        if (url.endsWith('/auth/me')) return profileResponse(landlordProfile);
        if (url.endsWith(`/listings/${LISTING_ID}`)) {
          return jsonResponse(200, { success: true, data: publicDetail() });
        }
        throw new Error(`Unexpected URL ${url}`);
      }),
    );
    renderApp({ route: `/listings/${LISTING_ID}`, client: sessionClient() });
    expect(
      await screen.findByRole('heading', {
        name: 'Modern apartment in Moka',
      }),
    ).toBeVisible();
    await waitFor(() =>
      expect(
        screen.queryByText('Checking saved status...'),
      ).not.toBeInTheDocument(),
    );
    expect(
      screen.queryByRole('button', { name: /save/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: 'Log in to save' }),
    ).not.toBeInTheDocument();
  });

  it('shows a safe failure if the listing becomes unavailable before save', async () => {
    const fetchMock = vi.fn(async (url, options = {}) => {
      if (url.endsWith('/auth/me')) return profileResponse();
      if (url.endsWith(`/listings/${LISTING_ID}`) && options.method === 'GET') {
        return jsonResponse(200, { success: true, data: publicDetail() });
      }
      if (url.endsWith(`/tenant/saved-listings/${LISTING_ID}/status`)) {
        return jsonResponse(200, {
          success: true,
          data: { listing_id: LISTING_ID, saved: false },
        });
      }
      if (
        url.endsWith(`/listings/${LISTING_ID}/save`) &&
        options.method === 'POST'
      ) {
        return jsonResponse(404, {
          success: false,
          error: { code: 'LISTING_NOT_FOUND', message: 'Listing not found.' },
        });
      }
      throw new Error(`Unexpected URL ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);
    renderApp({ route: `/listings/${LISTING_ID}`, client: sessionClient() });
    fireEvent.click(await screen.findByRole('button', { name: 'Save rental' }));
    expect(
      await screen.findByText('This rental is no longer available to save.'),
    ).toBeVisible();
    expect(screen.getByRole('button', { name: 'Save rental' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });
});
