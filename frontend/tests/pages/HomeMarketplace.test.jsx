import { fireEvent, screen, within } from '@testing-library/react';
import { afterEach, it, expect, vi } from 'vitest';
import { renderApp, jsonResponse } from '../helpers/authTestUtils.jsx';
afterEach(() => vi.unstubAllGlobals());
const listing = {
  id: '27a00000-0000-4000-8000-000000002001',
  title: 'Compact studio near Rose Hill centre',
  monthly_rent: 11500,
  cover_image_url: 'https://example.test/cover.jpg',
  property: {
    locality: 'Rose Hill',
    district: 'Plaines Wilhems',
    bedrooms: 0,
    bathrooms: 1,
    furnished: true,
    property_type: 'STUDIO',
  },
};
it('renders backend inventory and sends supported section filters', async () => {
  const fetchMock = vi.fn(async () =>
    jsonResponse(200, { success: true, data: [listing], meta: { total: 1 } }),
  );
  vi.stubGlobal('fetch', fetchMock);
  renderApp();
  const homes = within(
    screen.getByRole('region', { name: 'Homes available now' }),
  );
  expect(
    await homes.findByRole('heading', { name: listing.title }),
  ).toBeInTheDocument();
  expect(homes.getByText('MUR 11,500 / month')).toBeInTheDocument();
  expect(homes.getByText(/Studio · 1 bathroom/)).toBeInTheDocument();
  expect(homes.getByRole('img').getAttribute('src')).toBe(
    listing.cover_image_url,
  );
  fireEvent.error(homes.getByRole('img'));
  expect(homes.getByText('Photo unavailable')).toBeInTheDocument();
  expect(homes.queryByRole('img')).not.toBeInTheDocument();
  expect(
    fetchMock.mock.calls.some(
      ([url]) => url.includes('limit=4') && url.includes('sort=newest'),
    ),
  ).toBe(true);
  expect(screen.getByRole('link', { name: 'Quatre Bornes' })).toHaveAttribute(
    'href',
    '/listings?locality=Quatre%20Bornes',
  );
});
it('offers recovery without fixture cards when the backend fails', async () => {
  let failed = true;
  vi.stubGlobal(
    'fetch',
    vi.fn(async () =>
      failed
        ? jsonResponse(503, {
            success: false,
            error: { code: 'UNAVAILABLE', message: 'Unavailable' },
          })
        : jsonResponse(200, { success: true, data: [], meta: { total: 0 } }),
    ),
  );
  renderApp();
  const homes = within(
    screen.getByRole('region', { name: 'Homes available now' }),
  );
  await homes.findByRole('button', { name: 'Try again' });
  failed = false;
  fireEvent.click(await homes.findByRole('button', { name: 'Try again' }));
  expect(await homes.findByText(/No homes available/)).toBeInTheDocument();
  expect(homes.queryByRole('img')).not.toBeInTheDocument();
});
