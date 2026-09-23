import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import PublicListingCard from '../../components/public/PublicListingCard.jsx';
import PublicHeader from '../../components/public/PublicHeader.jsx';
import { ApiError } from '../../services/apiClient.js';
import { listPublicListings } from '../../services/listingService.js';
import RentalSearchForm from '../../components/public/RentalSearchForm.jsx';

const FILTER_FIELDS = ['locality', 'max_rent', 'bedrooms'];

function formFromParams(params) {
  return Object.fromEntries(
    FILTER_FIELDS.map((field) => [field, params.get(field) ?? '']),
  );
}

export default function PublicListingSearchPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const queryKey = searchParams.toString();
  const [form, setForm] = useState(() => formFromParams(searchParams));
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
      if (form[field].trim() !== '') next.set(field, form[field].trim());
    }
    if (selectedSort !== 'newest') next.set('sort', selectedSort);
    setSearchParams(next);
  }

  function clearFilters() {
    setSearchParams({});
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
    <div className="public-page marketplace-page">
      <PublicHeader />
      <main className="search-shell rental-search-shell">
        <section className="marketplace-search" aria-labelledby="search-title">
          <h1 id="search-title">Find a rental that fits your life</h1>
          <RentalSearchForm
            idPrefix="search"
            values={form}
            onChange={updateField}
            onSubmit={submitFilters}
          />
        </section>

        <div className="public-results-toolbar">
          <button
            className="secondary-button"
            type="button"
            onClick={clearFilters}
          >
            Clear filters
          </button>
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
            <p>Try changing the location, maximum rent, or bedrooms.</p>
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
