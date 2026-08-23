import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import PublicListingCard from '../../components/public/PublicListingCard.jsx';
import PublicHeader from '../../components/public/PublicHeader.jsx';
import { ApiError } from '../../services/apiClient.js';
import { listPublicListings } from '../../services/listingService.js';
import {
  publicPropertyTypeLabel,
  PUBLIC_PROPERTY_TYPES,
} from '../../utils/listing.js';

const FILTER_FIELDS = [
  'district',
  'locality',
  'neighbourhood',
  'property_type',
  'min_rent',
  'max_rent',
  'bedrooms',
  'bathrooms',
  'furnished',
  'pets_allowed',
  'available_from',
];

function formFromParams(params) {
  return Object.fromEntries(
    FILTER_FIELDS.map((field) => [field, params.get(field) ?? '']),
  );
}

export default function PublicListingSearchPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const queryKey = searchParams.toString();
  const [form, setForm] = useState(() => formFromParams(searchParams));
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [listings, setListings] = useState([]);
  const [meta, setMeta] = useState({
    page: 1,
    limit: 20,
    total: 0,
    total_pages: 0,
  });
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [reload, setReload] = useState(0);
  const selectedSort = searchParams.get('sort') ?? 'newest';
  const requestFilters = useMemo(
    () => Object.fromEntries(searchParams.entries()),
    [queryKey],
  );

  useEffect(() => {
    setForm(formFromParams(searchParams));
  }, [queryKey, searchParams]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setMessage('');
    setListings([]);
    listPublicListings(requestFilters, { signal: controller.signal })
      .then((result) => {
        setListings(result.listings);
        setMeta(result.meta);
      })
      .catch((error) => {
        if (error.name === 'AbortError') return;
        setMessage(
          error instanceof ApiError
            ? error.message
            : "We couldn't load rentals. Try again.",
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [requestFilters, reload]);

  const updateField = useCallback((event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }, []);

  function submitFilters(event) {
    event.preventDefault();
    const next = new globalThis.URLSearchParams();
    for (const field of FILTER_FIELDS) {
      if (form[field] !== '') next.set(field, form[field]);
    }
    if (selectedSort !== 'newest') next.set('sort', selectedSort);
    setSearchParams(next);
    setFiltersOpen(false);
  }

  function clearFilters() {
    setSearchParams({});
    setFiltersOpen(false);
  }

  function changeSort(event) {
    const next = new globalThis.URLSearchParams(searchParams);
    next.delete('page');
    if (event.target.value === 'newest') next.delete('sort');
    else next.set('sort', event.target.value);
    setSearchParams(next);
  }

  function changePage(page) {
    const next = new globalThis.URLSearchParams(searchParams);
    if (page === 1) next.delete('page');
    else next.set('page', String(page));
    setSearchParams(next);
    globalThis.scrollTo?.({ top: 0, behavior: 'smooth' });
  }

  return (
    <div className="public-page">
      <PublicHeader />
      <main className="search-shell">
        <section className="search-heading" aria-labelledby="search-title">
          <p className="eyebrow">Homes across Mauritius</p>
          <h1 id="search-title">Find a rental that fits your life</h1>
          <p>
            Browse currently available homes using approximate location and
            practical rental filters.
          </p>
        </section>

        <button
          className="filter-toggle"
          type="button"
          aria-expanded={filtersOpen}
          aria-controls="public-search-filters"
          onClick={() => setFiltersOpen((open) => !open)}
        >
          {filtersOpen ? 'Hide filters' : 'Show filters'}
        </button>
        <form
          id="public-search-filters"
          className={`public-search-filters${filtersOpen ? ' is-open' : ''}`}
          onSubmit={submitFilters}
        >
          <div className="form-field">
            <label htmlFor="search-district">District</label>
            <input
              id="search-district"
              name="district"
              value={form.district}
              onChange={updateField}
              maxLength={100}
            />
          </div>
          <div className="form-field">
            <label htmlFor="search-locality">Locality</label>
            <input
              id="search-locality"
              name="locality"
              value={form.locality}
              onChange={updateField}
              maxLength={100}
            />
          </div>
          <div className="form-field">
            <label htmlFor="search-neighbourhood">Neighbourhood</label>
            <input
              id="search-neighbourhood"
              name="neighbourhood"
              value={form.neighbourhood}
              onChange={updateField}
              maxLength={100}
            />
          </div>
          <div className="form-field">
            <label htmlFor="search-property-type">Property type</label>
            <select
              id="search-property-type"
              name="property_type"
              value={form.property_type}
              onChange={updateField}
            >
              <option value="">Any type</option>
              {PUBLIC_PROPERTY_TYPES.map((type) => (
                <option key={type} value={type}>
                  {publicPropertyTypeLabel(type)}
                </option>
              ))}
            </select>
          </div>
          <div className="form-field">
            <label htmlFor="search-min-rent">Minimum rent (Rs)</label>
            <input
              id="search-min-rent"
              name="min_rent"
              type="number"
              min="0"
              step="1"
              inputMode="numeric"
              value={form.min_rent}
              onChange={updateField}
            />
          </div>
          <div className="form-field">
            <label htmlFor="search-max-rent">Maximum rent (Rs)</label>
            <input
              id="search-max-rent"
              name="max_rent"
              type="number"
              min="0"
              step="1"
              inputMode="numeric"
              value={form.max_rent}
              onChange={updateField}
            />
          </div>
          <div className="form-field">
            <label htmlFor="search-bedrooms">Minimum bedrooms</label>
            <input
              id="search-bedrooms"
              name="bedrooms"
              type="number"
              min="0"
              step="1"
              inputMode="numeric"
              value={form.bedrooms}
              onChange={updateField}
            />
          </div>
          <div className="form-field">
            <label htmlFor="search-bathrooms">Minimum bathrooms</label>
            <input
              id="search-bathrooms"
              name="bathrooms"
              type="number"
              min="0"
              step="0.5"
              inputMode="decimal"
              value={form.bathrooms}
              onChange={updateField}
            />
          </div>
          <div className="form-field">
            <label htmlFor="search-furnished">Furnished</label>
            <select
              id="search-furnished"
              name="furnished"
              value={form.furnished}
              onChange={updateField}
            >
              <option value="">Any</option>
              <option value="true">Furnished</option>
              <option value="false">Unfurnished</option>
            </select>
          </div>
          <div className="form-field">
            <label htmlFor="search-pets">Pets allowed</label>
            <select
              id="search-pets"
              name="pets_allowed"
              value={form.pets_allowed}
              onChange={updateField}
            >
              <option value="">Any</option>
              <option value="true">Yes</option>
              <option value="false">No</option>
            </select>
          </div>
          <div className="form-field">
            <label htmlFor="search-available">Available on or before</label>
            <input
              id="search-available"
              name="available_from"
              type="date"
              value={form.available_from}
              onChange={updateField}
            />
          </div>
          <div className="public-filter-actions">
            <button className="primary-button" type="submit">
              Search rentals
            </button>
            <button
              className="secondary-button"
              type="button"
              onClick={clearFilters}
            >
              Clear filters
            </button>
          </div>
        </form>

        <div className="public-results-toolbar">
          <p aria-live="polite">
            {!loading && !message
              ? `${meta.total} rental${meta.total === 1 ? '' : 's'} found`
              : 'Searching rentals'}
          </p>
          <div className="form-field public-sort-field">
            <label htmlFor="public-listing-sort">Sort by</label>
            <select
              id="public-listing-sort"
              value={selectedSort}
              onChange={changeSort}
            >
              <option value="newest">Newest</option>
              <option value="rent_low">Rent: low to high</option>
              <option value="rent_high">Rent: high to low</option>
              <option value="available_soon">Available soonest</option>
            </select>
          </div>
        </div>

        {loading ? (
          <section className="public-loading" aria-live="polite">
            <p>Loading rentals...</p>
            <div className="public-listing-skeletons" aria-hidden="true">
              <div />
              <div />
              <div />
            </div>
          </section>
        ) : null}
        {!loading && message ? (
          <section className="public-state" role="alert">
            <h2>We couldn't load rentals</h2>
            <p>{message}</p>
            <button
              className="secondary-button"
              type="button"
              onClick={() => setReload((value) => value + 1)}
            >
              Try again
            </button>
          </section>
        ) : null}
        {!loading && !message && listings.length === 0 ? (
          <section className="public-state">
            <h2>No rentals match these filters</h2>
            <p>Try changing the location, price range, or property type.</p>
            <button
              className="secondary-button"
              type="button"
              onClick={clearFilters}
            >
              Clear filters
            </button>
          </section>
        ) : null}
        {!loading && !message && listings.length > 0 ? (
          <section aria-label="Rental results">
            <div className="public-listing-grid">
              {listings.map((listing) => (
                <PublicListingCard key={listing.id} listing={listing} />
              ))}
            </div>
            {meta.total_pages > 1 ? (
              <nav className="pagination" aria-label="Rental result pages">
                <button
                  type="button"
                  disabled={meta.page <= 1}
                  onClick={() => changePage(meta.page - 1)}
                >
                  Previous
                </button>
                <span>
                  Page {meta.page} of {meta.total_pages}
                </span>
                <button
                  type="button"
                  disabled={meta.page >= meta.total_pages}
                  onClick={() => changePage(meta.page + 1)}
                >
                  Next
                </button>
              </nav>
            ) : null}
          </section>
        ) : null}
      </main>
    </div>
  );
}
