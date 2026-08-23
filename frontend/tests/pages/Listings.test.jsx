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

const landlordProfile = { ...activeProfile, role: 'LANDLORD' };
const property = {
  id: '50000000-0000-4000-8000-000000000001',
  property_type: 'APARTMENT',
  district: 'Moka',
  locality: 'Moka',
  bedrooms: 2,
  bathrooms: 1,
  furnished: true,
  parking_spaces: 1,
  verification_status: 'UNVERIFIED',
  archived_at: null,
};
const image = {
  id: '60000000-0000-4000-8000-000000000001',
  url: 'https://storage.test/private-cover',
  display_order: 0,
  is_cover: true,
};
const listing = {
  id: '80000000-0000-4000-8000-000000000001',
  property_id: property.id,
  title: 'Modern apartment in Moka',
  description: 'Bright and comfortable home.',
  monthly_rent: 18000,
  deposit_amount: 18000,
  available_from: '2026-10-01',
  minimum_lease_months: 6,
  maximum_occupants: 3,
  pets_allowed: false,
  status: 'DRAFT',
  published_at: null,
  closed_at: null,
  created_at: '2026-08-21T00:00:00.000Z',
  updated_at: '2026-08-21T00:00:00.000Z',
  property,
  images: [image],
  cover_image: image,
};

const sessionClient = () =>
  createFakeSupabaseClient({ session: createSession() });

function listResponse(listings = []) {
  return jsonResponse(200, {
    success: true,
    data: listings,
    meta: {
      page: 1,
      limit: 20,
      total: listings.length,
      total_pages: listings.length ? 1 : 0,
    },
  });
}

function propertyListResponse(properties = [property]) {
  return jsonResponse(200, {
    success: true,
    data: properties,
    meta: {
      page: 1,
      limit: 100,
      total: properties.length,
      total_pages: properties.length ? 1 : 0,
    },
  });
}

function detailFetch(currentListing = listing, handler) {
  return vi.fn(async (url, options = {}) => {
    if (url.endsWith('/auth/me')) return profileResponse(landlordProfile);
    if (handler) {
      const handled = await handler(url, options);
      if (handled) return handled;
    }
    if (url.endsWith(`/landlord/listings/${listing.id}`)) {
      return jsonResponse(200, { success: true, data: currentListing });
    }
    throw new Error(`Unexpected URL ${url}`);
  });
}

afterEach(() => vi.unstubAllGlobals());

describe('landlord listing route protection and list', () => {
  it('redirects unauthenticated listing access to login', async () => {
    renderApp({ route: '/landlord/listings' });
    expect(
      await screen.findByRole('heading', { name: 'Log in' }),
    ).toBeVisible();
  });

  it('redirects TENANT users away from landlord listings', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(profileResponse()));
    renderApp({ route: '/landlord/listings', client: sessionClient() });
    expect(
      await screen.findByRole('heading', { name: 'Jane Doe' }),
    ).toBeVisible();
    expect(screen.queryByText('Your listings')).not.toBeInTheDocument();
  });

  it('shows the listing empty state', async () => {
    const fetchMock = vi.fn(async (url) => {
      if (url.endsWith('/auth/me')) return profileResponse(landlordProfile);
      if (url.includes('/landlord/listings?')) return listResponse();
      throw new Error(`Unexpected URL ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);
    renderApp({ route: '/landlord/listings', client: sessionClient() });
    expect(await screen.findByText('No listings found')).toBeVisible();
    expect(screen.getByText(/Drafts remain private/i)).toBeVisible();
  });

  it('renders owned listing status, cover, rent, and filter', async () => {
    const fetchMock = vi.fn(async (url) => {
      if (url.endsWith('/auth/me')) return profileResponse(landlordProfile);
      if (url.includes('/landlord/listings?')) return listResponse([listing]);
      throw new Error(`Unexpected URL ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);
    renderApp({ route: '/landlord/listings', client: sessionClient() });
    expect(await screen.findByText(listing.title)).toBeVisible();
    expect(screen.getAllByText('Draft')).toHaveLength(2);
    expect(screen.getByText('Rs 18,000 / month')).toBeVisible();
    expect(screen.getByAltText('Property cover')).toHaveAttribute(
      'src',
      image.url,
    );
    fireEvent.change(screen.getByLabelText('Status'), {
      target: { value: 'PAUSED' },
    });
    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some(([url]) => url.includes('status=PAUSED')),
      ).toBe(true),
    );
  });

  it('shows a safe load error and retry action', async () => {
    const fetchMock = vi.fn(async (url) => {
      if (url.endsWith('/auth/me')) return profileResponse(landlordProfile);
      return jsonResponse(503, {
        success: false,
        error: { code: 'UNAVAILABLE', message: "We couldn't load listings." },
      });
    });
    vi.stubGlobal('fetch', fetchMock);
    renderApp({ route: '/landlord/listings', client: sessionClient() });
    expect(await screen.findByText("We couldn't load listings.")).toBeVisible();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeVisible();
  });
});

describe('listing creation', () => {
  it('preselects an owned property and creates a DRAFT payload', async () => {
    const created = { ...listing, images: undefined };
    const fetchMock = vi.fn(async (url, options = {}) => {
      if (url.endsWith('/auth/me')) return profileResponse(landlordProfile);
      if (url.includes('/landlord/properties?')) return propertyListResponse();
      if (url.endsWith('/listings') && options.method === 'POST') {
        return jsonResponse(201, { success: true, data: created });
      }
      if (url.endsWith(`/landlord/listings/${listing.id}`)) {
        return jsonResponse(200, { success: true, data: listing });
      }
      throw new Error(`Unexpected URL ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);
    renderApp({
      route: `/landlord/listings/new?propertyId=${property.id}`,
      client: sessionClient(),
    });
    expect(await screen.findByLabelText('Property *')).toHaveValue(property.id);
    fireEvent.change(screen.getByLabelText('Title *'), {
      target: { value: listing.title },
    });
    fireEvent.change(screen.getByLabelText('Description *'), {
      target: { value: listing.description },
    });
    fireEvent.change(screen.getByLabelText('Monthly rent (Rs) *'), {
      target: { value: '18000' },
    });
    fireEvent.change(screen.getByLabelText('Available from *'), {
      target: { value: listing.available_from },
    });
    fireEvent.click(await screen.findByRole('button', { name: 'Save draft' }));

    expect(await screen.findByText('Status: Draft')).toBeVisible();
    const createCall = fetchMock.mock.calls.find(
      ([url, options]) =>
        url.endsWith('/listings') && options.method === 'POST',
    );
    expect(createCall[1].headers.Authorization).toBe(
      'Bearer verified-access-token',
    );
    const body = JSON.parse(createCall[1].body);
    expect(body.property_id).toBe(property.id);
    expect(body.monthly_rent).toBe(18000);
    expect(body).not.toHaveProperty('status');
  });

  it('shows field validation without creating invalid data', async () => {
    const fetchMock = vi.fn(async (url) => {
      if (url.endsWith('/auth/me')) return profileResponse(landlordProfile);
      if (url.includes('/landlord/properties?')) return propertyListResponse();
      throw new Error(`Unexpected URL ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);
    renderApp({ route: '/landlord/listings/new', client: sessionClient() });
    await screen.findByRole('heading', { name: 'Create a draft listing' });
    fireEvent.click(await screen.findByRole('button', { name: 'Save draft' }));
    expect(await screen.findByText('Choose a property.')).toBeVisible();
    expect(screen.getByText('Enter a listing title.')).toBeVisible();
    expect(
      screen.getByText('Monthly rent must be greater than zero.'),
    ).toBeVisible();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('shows an add-property path when no active property exists', async () => {
    const fetchMock = vi.fn(async (url) => {
      if (url.endsWith('/auth/me')) return profileResponse(landlordProfile);
      return propertyListResponse([]);
    });
    vi.stubGlobal('fetch', fetchMock);
    renderApp({ route: '/landlord/listings/new', client: sessionClient() });
    expect(
      await screen.findByText('Add an active property first'),
    ).toBeVisible();
    expect(screen.getByRole('link', { name: 'Add property' })).toHaveAttribute(
      'href',
      '/landlord/properties/new',
    );
  });
});

describe('listing state-specific management', () => {
  it('edits a DRAFT without sending protected fields', async () => {
    const updated = { ...listing, title: 'Updated title', images: undefined };
    const fetchMock = detailFetch(listing, (url, options) => {
      if (
        url.endsWith(`/listings/${listing.id}`) &&
        options.method === 'PATCH'
      ) {
        return jsonResponse(200, { success: true, data: updated });
      }
      return null;
    });
    vi.stubGlobal('fetch', fetchMock);
    renderApp({
      route: `/landlord/listings/${listing.id}`,
      client: sessionClient(),
    });
    fireEvent.click(
      await screen.findByRole('button', { name: 'Edit listing' }),
    );
    fireEvent.change(screen.getByLabelText('Title *'), {
      target: { value: 'Updated title' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save listing' }));
    expect(await screen.findByText('Listing details saved.')).toBeVisible();
    const call = fetchMock.mock.calls.find(
      ([url, options]) =>
        url.endsWith(`/listings/${listing.id}`) && options.method === 'PATCH',
    );
    const body = JSON.parse(call[1].body);
    expect(body.title).toBe('Updated title');
    expect(body).not.toHaveProperty('status');
    expect(body).not.toHaveProperty('property_id');
  });

  it('submits a DRAFT for review without claiming public activation', async () => {
    const pending = {
      ...listing,
      status: 'PENDING_REVIEW',
      published_at: '2026-08-21T12:00:00.000Z',
      images: undefined,
    };
    const fetchMock = detailFetch(listing, (url) => {
      if (url.endsWith(`/listings/${listing.id}/publish`)) {
        return jsonResponse(200, { success: true, data: pending });
      }
      return null;
    });
    vi.stubGlobal('fetch', fetchMock);
    renderApp({
      route: `/landlord/listings/${listing.id}`,
      client: sessionClient(),
    });
    fireEvent.click(
      await screen.findByRole('button', { name: 'Submit for review' }),
    );
    expect(
      await screen.findByText(
        'Listing submitted for review. It is not publicly active yet.',
      ),
    ).toBeVisible();
    expect(screen.getByText('Status: Pending review')).toBeVisible();
    expect(
      screen.queryByRole('button', { name: 'Activate listing' }),
    ).not.toBeInTheDocument();
  });

  it('shows backend publication readiness reasons', async () => {
    const noImages = { ...listing, images: [] };
    const fetchMock = detailFetch(noImages, (url) => {
      if (url.endsWith(`/listings/${listing.id}/publish`)) {
        return jsonResponse(409, {
          success: false,
          error: {
            code: 'LISTING_NOT_READY',
            message: 'Complete the listing requirements before submitting it.',
            fields: {
              readiness: ['PROPERTY_IMAGE_REQUIRED', 'COVER_IMAGE_REQUIRED'],
            },
          },
        });
      }
      return null;
    });
    vi.stubGlobal('fetch', fetchMock);
    renderApp({
      route: `/landlord/listings/${listing.id}`,
      client: sessionClient(),
    });
    expect(
      await screen.findByText('Add at least one property photo.'),
    ).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Submit for review' }));
    expect(
      await screen.findByText(
        'Complete the listing requirements before submitting it.',
      ),
    ).toBeVisible();
    expect(screen.getByText('Set a cover photo.')).toBeVisible();
    expect(
      screen.getByRole('link', { name: 'Manage property photos' }),
    ).toHaveAttribute('href', `/landlord/properties/${property.id}`);
  });

  it('pauses ACTIVE and then offers PAUSED edit/activate actions', async () => {
    const active = { ...listing, status: 'ACTIVE' };
    const paused = { ...active, status: 'PAUSED', images: undefined };
    const fetchMock = detailFetch(active, (url) => {
      if (url.endsWith(`/listings/${listing.id}/pause`)) {
        return jsonResponse(200, { success: true, data: paused });
      }
      return null;
    });
    vi.stubGlobal('fetch', fetchMock);
    renderApp({
      route: `/landlord/listings/${listing.id}`,
      client: sessionClient(),
    });
    expect(
      await screen.findByText(
        'Pause the listing before editing it. Pausing does not close the listing.',
      ),
    ).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Pause listing' }));
    expect(await screen.findByText('Listing paused.')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Edit listing' })).toBeVisible();
    expect(
      screen.getByRole('button', { name: 'Activate listing' }),
    ).toBeVisible();
  });

  it.each([
    ['PENDING_REVIEW', ['Close listing'], ['Edit listing', 'Activate listing']],
    ['RENTED', [], ['Edit listing', 'Close listing', 'Activate listing']],
    ['CLOSED', [], ['Edit listing', 'Close listing', 'Activate listing']],
  ])(
    'shows correct read-only actions for %s',
    async (status, shown, hidden) => {
      vi.stubGlobal('fetch', detailFetch({ ...listing, status }));
      renderApp({
        route: `/landlord/listings/${listing.id}`,
        client: sessionClient(),
      });
      await screen.findByText(
        `Status: ${status === 'PENDING_REVIEW' ? 'Pending review' : status === 'RENTED' ? 'Rented' : 'Closed'}`,
      );
      for (const name of shown)
        expect(screen.getByRole('button', { name })).toBeVisible();
      for (const name of hidden)
        expect(screen.queryByRole('button', { name })).not.toBeInTheDocument();
    },
  );

  it('requires confirmation before closing and preserves the property', async () => {
    const closed = {
      ...listing,
      status: 'CLOSED',
      closed_at: '2026-08-21T12:00:00.000Z',
      images: undefined,
    };
    const fetchMock = detailFetch(listing, (url) => {
      if (url.endsWith(`/listings/${listing.id}/close`)) {
        return jsonResponse(200, { success: true, data: closed });
      }
      return null;
    });
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('confirm', vi.fn().mockReturnValue(true));
    renderApp({
      route: `/landlord/listings/${listing.id}`,
      client: sessionClient(),
    });
    fireEvent.click(
      await screen.findByRole('button', { name: 'Close listing' }),
    );
    expect(globalThis.confirm).toHaveBeenCalledWith(
      'Close this listing? It will no longer continue through the rental workflow. The underlying property will remain available for future listings.',
    );
    expect(
      await screen.findByText('Listing closed. The property was not archived.'),
    ).toBeVisible();
    expect(screen.getByRole('link', { name: 'View property' })).toHaveAttribute(
      'href',
      `/landlord/properties/${property.id}`,
    );
  });
});
