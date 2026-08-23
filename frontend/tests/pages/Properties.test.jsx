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
  address_line_1: '10 Test Road',
  address_line_2: null,
  district: 'Moka',
  locality: 'Moka',
  neighbourhood: null,
  latitude: -20.23,
  longitude: 57.5,
  bedrooms: 2,
  bathrooms: 1.5,
  furnished: true,
  parking_spaces: 1,
  verification_status: 'UNVERIFIED',
  archived_at: null,
  created_at: '2026-08-20T00:00:00.000Z',
  updated_at: '2026-08-20T00:00:00.000Z',
};

const images = [
  {
    id: '60000000-0000-4000-8000-000000000001',
    url: 'https://storage.test/signed-cover',
    display_order: 0,
    is_cover: true,
  },
  {
    id: '60000000-0000-4000-8000-000000000002',
    url: 'https://storage.test/signed-second',
    display_order: 1,
    is_cover: false,
  },
];

const sessionClient = () =>
  createFakeSupabaseClient({ session: createSession() });

function listResponse(properties = []) {
  return jsonResponse(200, {
    success: true,
    data: properties,
    meta: {
      page: 1,
      limit: 20,
      total: properties.length,
      total_pages: properties.length ? 1 : 0,
    },
  });
}

afterEach(() => vi.unstubAllGlobals());

describe('property route security and list', () => {
  it('redirects unauthenticated management access to login', async () => {
    renderApp({ route: '/landlord/properties' });
    expect(
      await screen.findByRole('heading', { name: 'Log in' }),
    ).toBeInTheDocument();
  });

  it('redirects a TENANT away from landlord property routes', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(profileResponse()));
    renderApp({ route: '/landlord/properties', client: sessionClient() });
    expect(
      await screen.findByRole('heading', { name: 'Jane Doe' }),
    ).toBeInTheDocument();
    expect(screen.queryByText('Your properties')).not.toBeInTheDocument();
  });

  it('shows the active-property empty state', async () => {
    const fetchMock = vi.fn(async (url) => {
      if (url.endsWith('/auth/me')) return profileResponse(landlordProfile);
      if (url.includes('/landlord/properties?')) return listResponse();
      throw new Error(`Unexpected URL ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);
    renderApp({ route: '/landlord/properties', client: sessionClient() });

    expect(await screen.findByText('No properties yet')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Add your first property to prepare it for a future rental listing.',
      ),
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole('link', { name: 'Add property' })[0],
    ).toHaveAttribute('href', '/landlord/properties/new');
  });

  it('renders physical property facts without listing fields', async () => {
    const fetchMock = vi.fn(async (url) => {
      if (url.endsWith('/auth/me')) return profileResponse(landlordProfile);
      if (url.includes('/landlord/properties?'))
        return listResponse([property]);
      throw new Error(`Unexpected URL ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);
    renderApp({ route: '/landlord/properties', client: sessionClient() });

    expect(await screen.findByText('Moka, Moka')).toBeInTheDocument();
    expect(screen.getByText('Apartment')).toBeInTheDocument();
    expect(screen.queryByText(/monthly rent/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/listing status/i)).not.toBeInTheDocument();
  });

  it('shows API failure with a retry action', async () => {
    const fetchMock = vi.fn(async (url) => {
      if (url.endsWith('/auth/me')) return profileResponse(landlordProfile);
      return jsonResponse(503, {
        success: false,
        error: { code: 'UNAVAILABLE', message: "We couldn't load properties." },
      });
    });
    vi.stubGlobal('fetch', fetchMock);
    renderApp({ route: '/landlord/properties', client: sessionClient() });
    expect(
      await screen.findByText("We couldn't load properties."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Try again' }),
    ).toBeInTheDocument();
  });
});

describe('property create and validation', () => {
  it('shows field-level validation without submitting invalid data', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(profileResponse(landlordProfile));
    vi.stubGlobal('fetch', fetchMock);
    renderApp({ route: '/landlord/properties/new', client: sessionClient() });
    await screen.findByRole('heading', { name: 'Add a property' });
    fireEvent.click(screen.getByRole('button', { name: 'Create property' }));
    expect(await screen.findByText('Enter a district.')).toBeInTheDocument();
    expect(screen.getByText('Enter a locality.')).toBeInTheDocument();
    expect(
      screen.getByText('Bedrooms must be zero or more.'),
    ).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('creates through the bearer-authenticated API without owner fields', async () => {
    const fetchMock = vi.fn(async (url, options = {}) => {
      if (url.endsWith('/auth/me')) return profileResponse(landlordProfile);
      if (url.endsWith('/properties') && options.method === 'POST') {
        return jsonResponse(201, { success: true, data: property });
      }
      if (url.endsWith(`/properties/${property.id}`)) {
        return jsonResponse(200, { success: true, data: property });
      }
      throw new Error(`Unexpected URL ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);
    renderApp({ route: '/landlord/properties/new', client: sessionClient() });

    fireEvent.change(await screen.findByLabelText('District *'), {
      target: { value: 'Moka' },
    });
    fireEvent.change(screen.getByLabelText('Locality *'), {
      target: { value: 'Moka' },
    });
    fireEvent.change(screen.getByLabelText('Bedrooms *'), {
      target: { value: '2' },
    });
    fireEvent.change(screen.getByLabelText('Bathrooms *'), {
      target: { value: '1.5' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Create property' }));

    expect(
      await screen.findByRole('heading', { name: 'Moka, Moka' }),
    ).toBeInTheDocument();
    const createCall = fetchMock.mock.calls.find(
      ([url, options]) =>
        url.endsWith('/properties') && options.method === 'POST',
    );
    expect(createCall[1].headers.Authorization).toBe(
      'Bearer verified-access-token',
    );
    const body = JSON.parse(createCall[1].body);
    expect(body.bathrooms).toBe(1.5);
    expect(body).not.toHaveProperty('landlord_id');
    expect(body).not.toHaveProperty('verification_status');
  });
});

describe('property detail, edit, and archive', () => {
  it('loads and edits a property', async () => {
    const updated = { ...property, bedrooms: 3 };
    const fetchMock = vi.fn(async (url, options = {}) => {
      if (url.endsWith('/auth/me')) return profileResponse(landlordProfile);
      if (
        url.endsWith(`/properties/${property.id}`) &&
        options.method === 'PATCH'
      ) {
        return jsonResponse(200, { success: true, data: updated });
      }
      if (url.endsWith(`/properties/${property.id}`)) {
        return jsonResponse(200, { success: true, data: property });
      }
      throw new Error(`Unexpected URL ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);
    renderApp({
      route: `/landlord/properties/${property.id}`,
      client: sessionClient(),
    });

    await screen.findByText('Property verification: Unverified');
    fireEvent.click(screen.getByRole('button', { name: 'Edit property' }));
    fireEvent.change(screen.getByLabelText('Bedrooms *'), {
      target: { value: '3' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save property' }));
    expect(
      await screen.findByText('Property details saved.'),
    ).toBeInTheDocument();
    const patchCall = fetchMock.mock.calls.find(
      ([url, options]) =>
        url.endsWith(`/properties/${property.id}`) &&
        options.method === 'PATCH',
    );
    expect(JSON.parse(patchCall[1].body).bedrooms).toBe(3);
  });

  it('requires confirmation and hides edit actions after archiving', async () => {
    const archived = { ...property, archived_at: '2026-08-21T12:00:00.000Z' };
    const fetchMock = vi.fn(async (url) => {
      if (url.endsWith('/auth/me')) return profileResponse(landlordProfile);
      if (url.endsWith(`/properties/${property.id}/archive`)) {
        return jsonResponse(200, { success: true, data: archived });
      }
      return jsonResponse(200, { success: true, data: property });
    });
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('confirm', vi.fn().mockReturnValue(true));
    renderApp({
      route: `/landlord/properties/${property.id}`,
      client: sessionClient(),
    });

    fireEvent.click(
      await screen.findByRole('button', { name: 'Archive property' }),
    );
    expect(globalThis.confirm).toHaveBeenCalledWith(
      'Archive this property? It will no longer appear in your active property list.',
    );
    expect(await screen.findByText('Archived')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Edit property' }),
    ).not.toBeInTheDocument();
  });

  it('renders a privacy-preserving not-found state', async () => {
    const fetchMock = vi.fn(async (url) => {
      if (url.endsWith('/auth/me')) return profileResponse(landlordProfile);
      return jsonResponse(404, {
        success: false,
        error: { code: 'PROPERTY_NOT_FOUND', message: 'Property not found.' },
      });
    });
    vi.stubGlobal('fetch', fetchMock);
    renderApp({
      route: `/landlord/properties/${property.id}`,
      client: sessionClient(),
    });
    expect(
      await screen.findByRole('heading', { name: 'Property unavailable' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Property not found.')).toBeInTheDocument();
  });
});

describe('private property image management', () => {
  function detailFetch(handler) {
    return vi.fn(async (url, options = {}) => {
      if (url.endsWith('/auth/me')) return profileResponse(landlordProfile);
      if (handler) {
        const handled = await handler(url, options);
        if (handled) return handled;
      }
      if (url.endsWith(`/properties/${property.id}`)) {
        return jsonResponse(200, {
          success: true,
          data: { ...property, images },
        });
      }
      throw new Error(`Unexpected URL ${url}`);
    });
  }

  it('renders ordered signed images with cover and accessible controls', async () => {
    vi.stubGlobal('fetch', detailFetch());
    renderApp({
      route: `/landlord/properties/${property.id}`,
      client: sessionClient(),
    });

    const photos = await screen.findAllByRole('img');
    expect(photos).toHaveLength(2);
    expect(photos[0]).toHaveAttribute('alt', 'Property photo 1 (cover)');
    expect(screen.getByText('Cover')).toBeInTheDocument();
    expect(
      screen.getByLabelText('Move property photo 1 earlier'),
    ).toBeDisabled();
    expect(screen.getByLabelText('Move property photo 2 later')).toBeDisabled();
  });

  it('uploads through multipart API with bearer authorization', async () => {
    const created = {
      id: '60000000-0000-4000-8000-000000000003',
      url: 'https://storage.test/signed-third',
      display_order: 2,
      is_cover: false,
    };
    const fetchMock = detailFetch((url) => {
      if (url.endsWith(`/properties/${property.id}/images`)) {
        return jsonResponse(201, { success: true, data: created });
      }
      return null;
    });
    vi.stubGlobal('fetch', fetchMock);
    renderApp({
      route: `/landlord/properties/${property.id}`,
      client: sessionClient(),
    });

    const input = await screen.findByLabelText('Upload image');
    const file = new globalThis.File(['safe image'], 'unsafe-name.jpg', {
      type: 'image/jpeg',
    });
    fireEvent.change(input, { target: { files: [file] } });
    expect(await screen.findByText('Image uploaded.')).toBeInTheDocument();
    expect(screen.getByAltText('Property photo 3')).toBeInTheDocument();

    const call = fetchMock.mock.calls.find(([url]) =>
      url.endsWith(`/properties/${property.id}/images`),
    );
    expect(call[1].headers.Authorization).toBe('Bearer verified-access-token');
    expect(call[1].headers).not.toHaveProperty('Content-Type');
    expect(call[1].body).toBeInstanceOf(globalThis.FormData);
    expect(call[1].body.get('image')).toBe(file);
  });

  it('shows a safe client error for an unsupported upload', async () => {
    const fetchMock = detailFetch();
    vi.stubGlobal('fetch', fetchMock);
    renderApp({
      route: `/landlord/properties/${property.id}`,
      client: sessionClient(),
    });
    const input = await screen.findByLabelText('Upload image');
    fireEvent.change(input, {
      target: {
        files: [
          new globalThis.File(['<svg></svg>'], 'unsafe.svg', {
            type: 'image/svg+xml',
          }),
        ],
      },
    });
    expect(
      await screen.findByText('Choose a JPEG, PNG, or WebP image.'),
    ).toBeInTheDocument();
    expect(
      fetchMock.mock.calls.some(([url]) =>
        url.endsWith(`/properties/${property.id}/images`),
      ),
    ).toBe(false);
  });

  it('sets cover, reorders, and confirms deletion', async () => {
    const fetchMock = detailFetch((url, options) => {
      if (options.method === 'PATCH') {
        const body = JSON.parse(options.body);
        const image = url.endsWith(images[0].id) ? images[0] : images[1];
        return jsonResponse(200, {
          success: true,
          data: { ...image, ...body },
        });
      }
      if (options.method === 'DELETE') {
        return jsonResponse(200, { success: true, data: [images[1]] });
      }
      return null;
    });
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('confirm', vi.fn().mockReturnValue(true));
    renderApp({
      route: `/landlord/properties/${property.id}`,
      client: sessionClient(),
    });

    fireEvent.click(
      await screen.findByRole('button', { name: 'Set as cover' }),
    );
    expect(await screen.findByText('Cover image updated.')).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Move property photo 2 earlier'));
    expect(await screen.findByText('Image order updated.')).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('button', { name: 'Delete' })[0]);
    expect(globalThis.confirm).toHaveBeenCalledWith(
      'Delete this property image permanently?',
    );
    expect(await screen.findByText('Image deleted.')).toBeInTheDocument();

    await waitFor(() => {
      expect(
        fetchMock.mock.calls.some(([, options]) => options.method === 'DELETE'),
      ).toBe(true);
    });
  });

  it('keeps archived images visible but disables new uploads', async () => {
    vi.stubGlobal('fetch', detailFetch());
    const archived = { ...property, archived_at: '2026-08-21T00:00:00.000Z' };
    const fetchMock = vi.fn(async (url) => {
      if (url.endsWith('/auth/me')) return profileResponse(landlordProfile);
      return jsonResponse(200, {
        success: true,
        data: { ...archived, images },
      });
    });
    vi.stubGlobal('fetch', fetchMock);
    renderApp({
      route: `/landlord/properties/${property.id}`,
      client: sessionClient(),
    });
    expect(
      await screen.findByAltText('Property photo 1 (cover)'),
    ).toBeVisible();
    expect(screen.queryByLabelText('Upload image')).not.toBeInTheDocument();
  });
});
