import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { jsonResponse, renderApp } from '../helpers/authTestUtils.jsx';

const LISTING_ID = '80000000-0000-4000-8000-000000000001';

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
      property_information_verified: true,
      address_line_1: 'must not be rendered',
      latitude: -20.22,
      longitude: 57.53,
      landlord_phone: '+23050000000',
    },
    ...overrides,
  };
}

function listResponse({ listings = [publicListing()], meta } = {}) {
  return jsonResponse(200, {
    success: true,
    data: listings,
    meta: meta ?? {
      page: 1,
      limit: 20,
      total: listings.length,
      total_pages: listings.length ? 1 : 0,
    },
  });
}

function detailResponse() {
  return jsonResponse(200, {
    success: true,
    data: {
      ...publicListing(),
      description: 'A bright and comfortable long-term home.',
      deposit_amount: 18000,
      images: [
        {
          id: '60000000-0000-4000-8000-000000000001',
          url: 'https://storage.test/signed-detail',
          display_order: 0,
          is_cover: true,
          storage_path: 'must-not-render/private.jpg',
        },
      ],
    },
  });
}

describe('public rental search', () => {
  beforeEach(() => {
    vi.stubGlobal('scrollTo', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('is accessible while logged out and renders public listing cards', async () => {
    const fetchMock = vi.fn().mockResolvedValue(listResponse());
    vi.stubGlobal('fetch', fetchMock);
    renderApp({ route: '/listings' });

    expect(
      screen.getByRole('heading', {
        name: 'Find a rental that fits your life',
      }),
    ).toBeVisible();
    expect(
      await screen.findByRole('heading', {
        name: 'Modern apartment in Moka',
      }),
    ).toBeVisible();
    expect(screen.getByText('Helvetia, Saint Pierre, Moka')).toBeVisible();
    expect(screen.getByText('Rs 18,000/month')).toBeVisible();
    expect(screen.getByText('1 rental found')).toBeVisible();
    expect(fetchMock.mock.calls[0][1].headers).not.toHaveProperty(
      'Authorization',
    );
  });

  it('submits structured filters once and reflects them in the request URL', async () => {
    const fetchMock = vi.fn().mockResolvedValue(listResponse());
    vi.stubGlobal('fetch', fetchMock);
    renderApp({ route: '/listings' });
    await screen.findByText('1 rental found');

    fireEvent.click(screen.getByRole('button', { name: 'Show filters' }));
    fireEvent.change(screen.getByLabelText('District'), {
      target: { value: 'Moka' },
    });
    fireEvent.change(screen.getByLabelText('Minimum rent (Rs)'), {
      target: { value: '10000' },
    });
    fireEvent.change(screen.getByLabelText('Property type'), {
      target: { value: 'APARTMENT' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Search rentals' }));

    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some(
          ([url]) =>
            url.includes('district=Moka') &&
            url.includes('min_rent=10000') &&
            url.includes('property_type=APARTMENT'),
        ),
      ).toBe(true),
    );
    expect(
      screen.getByRole('button', { name: 'Show filters' }),
    ).toHaveAttribute('aria-expanded', 'false');
  });

  it('updates sorting through the URL-backed request', async () => {
    const fetchMock = vi.fn().mockResolvedValue(listResponse());
    vi.stubGlobal('fetch', fetchMock);
    renderApp({ route: '/listings' });
    await screen.findByText('1 rental found');
    fireEvent.change(screen.getByLabelText('Sort by'), {
      target: { value: 'rent_low' },
    });
    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some(([url]) => url.includes('sort=rent_low')),
      ).toBe(true),
    );
  });

  it('requests the next page and renders pagination feedback', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      listResponse({
        meta: { page: 1, limit: 20, total: 21, total_pages: 2 },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);
    renderApp({ route: '/listings' });
    expect(await screen.findByText('Page 1 of 2')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    await waitFor(() =>
      expect(fetchMock.mock.calls.some(([url]) => url.includes('page=2'))).toBe(
        true,
      ),
    );
  });

  it('shows a useful empty state and clears filters', async () => {
    const fetchMock = vi.fn().mockResolvedValue(listResponse({ listings: [] }));
    vi.stubGlobal('fetch', fetchMock);
    renderApp({ route: '/listings?district=Unknown' });
    expect(
      await screen.findByRole('heading', {
        name: 'No rentals match these filters',
      }),
    ).toBeVisible();
    const emptyState = screen
      .getByRole('heading', { name: 'No rentals match these filters' })
      .closest('section');
    fireEvent.click(
      within(emptyState).getByRole('button', { name: 'Clear filters' }),
    );
    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some(([url]) => url.endsWith('/listings')),
      ).toBe(true),
    );
  });

  it('does not retain stale cards while loading a changed search', async () => {
    let resolveRequest;
    const pending = new Promise((resolve) => {
      resolveRequest = resolve;
    });
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(pending));
    renderApp({ route: '/listings' });
    expect(screen.getByText('Loading rentals...')).toBeVisible();
    expect(
      screen.queryByRole('heading', { name: 'Modern apartment in Moka' }),
    ).not.toBeInTheDocument();
    resolveRequest(listResponse());
    expect(
      await screen.findByRole('heading', {
        name: 'Modern apartment in Moka',
      }),
    ).toBeVisible();
  });

  it('shows a safe API error with a retry action', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse(503, {
          success: false,
          error: {
            code: 'UNAVAILABLE',
            message: 'Rental search is unavailable.',
          },
        }),
      ),
    );
    renderApp({ route: '/listings' });
    expect(
      await screen.findByRole('heading', {
        name: "We couldn't load rentals",
      }),
    ).toBeVisible();
    expect(screen.getByText('Rental search is unavailable.')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeEnabled();
  });

  it('provides a touch-friendly collapsible filter control', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(listResponse()));
    renderApp({ route: '/listings' });
    const toggle = screen.getByRole('button', { name: 'Show filters' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(toggle);
    expect(
      screen.getByRole('button', { name: 'Hide filters' }),
    ).toHaveAttribute('aria-expanded', 'true');
    expect(document.querySelector('#public-search-filters')).toHaveClass(
      'is-open',
    );
  });
});

describe('public rental detail', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders the public detail, gallery, rental facts, and safe trust copy', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(detailResponse()));
    renderApp({ route: `/listings/${LISTING_ID}` });
    expect(
      await screen.findByRole('heading', {
        name: 'Modern apartment in Moka',
      }),
    ).toBeVisible();
    expect(
      screen.getByRole('img', { name: /property photo 1/i }),
    ).toHaveAttribute('src', 'https://storage.test/signed-detail');
    expect(screen.getByText('About this rental')).toBeVisible();
    expect(screen.getByText(/Property information verified/)).toBeVisible();
    expect(screen.getByText(/exact address.*remain private/i)).toBeVisible();
  });

  it('never renders private address, coordinate, contact, or storage fields', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(detailResponse()));
    renderApp({ route: `/listings/${LISTING_ID}` });
    const heading = await screen.findByRole('heading', {
      name: 'Modern apartment in Moka',
    });
    const article = heading.closest('article');
    expect(article).not.toBeNull();
    const content = within(article).queryByText(
      /must not be rendered|-20\.22|57\.53|\+23050000000|must-not-render/i,
    );
    expect(content).not.toBeInTheDocument();
  });

  it('handles a non-public or missing listing as unavailable', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse(404, {
          success: false,
          error: { code: 'LISTING_NOT_FOUND', message: 'Listing not found.' },
        }),
      ),
    );
    renderApp({ route: `/listings/${LISTING_ID}` });
    expect(
      await screen.findByRole('heading', { name: 'Rental unavailable' }),
    ).toBeVisible();
    expect(
      screen.getByText('This rental is no longer publicly available.'),
    ).toBeVisible();
    expect(
      screen.getByRole('link', { name: 'Browse available rentals' }),
    ).toHaveAttribute('href', '/listings');
  });
});
