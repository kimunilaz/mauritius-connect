import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import PublicListingCard from '../../components/public/PublicListingCard.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { ApiError } from '../../services/apiClient.js';
import {
  listSavedListings,
  removeSavedListing,
} from '../../services/savedListingService.js';

function savedDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return value;
  return new Intl.DateTimeFormat('en-MU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

export default function SavedListingListPage() {
  const { session } = useAuth();
  const token = session.access_token;
  const [saves, setSaves] = useState([]);
  const [meta, setMeta] = useState({
    page: 1,
    limit: 20,
    total: 0,
    total_pages: 0,
  });
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [removingId, setRemovingId] = useState(null);

  const load = useCallback(
    async (page, signal) => {
      setLoading(true);
      setMessage('');
      setSaves([]);
      try {
        const result = await listSavedListings(token, { page, signal });
        setSaves(result.saves);
        setMeta(result.meta);
      } catch (error) {
        if (error.name === 'AbortError') return;
        setMessage(
          error instanceof ApiError
            ? error.message
            : "We couldn't load your saved rentals. Try again.",
        );
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [token],
  );

  useEffect(() => {
    const controller = new AbortController();
    void load(1, controller.signal);
    return () => controller.abort();
  }, [load]);

  async function remove(listingId) {
    setRemovingId(listingId);
    setMessage('');
    try {
      await removeSavedListing(token, listingId);
      const nextPage =
        saves.length === 1 && meta.page > 1 ? meta.page - 1 : meta.page;
      await load(nextPage);
    } catch (error) {
      setMessage(
        error instanceof ApiError
          ? error.message
          : 'The saved rental could not be removed.',
      );
    } finally {
      setRemovingId(null);
    }
  }

  return (
    <main className="management-shell saved-listings-shell">
      <header className="profile-header">
        <div>
          <p className="eyebrow">Tenant</p>
          <h1>Saved rentals</h1>
          <p>
            Places you want to revisit, including unavailable saved items you
            can remove.
          </p>
        </div>
        <Link to="/listings">Browse rentals</Link>
      </header>

      {message ? (
        <p className="form-message" role="alert">
          {message}
        </p>
      ) : null}
      {loading ? <p aria-live="polite">Loading saved rentals...</p> : null}
      {!loading && message ? (
        <button
          className="secondary-button"
          type="button"
          onClick={() => load(meta.page)}
        >
          Try again
        </button>
      ) : null}
      {!loading && !message && saves.length === 0 ? (
        <section className="empty-state">
          <h2>No saved rentals yet</h2>
          <p>Browse rentals and save places you want to revisit.</p>
          <Link className="primary-link-button" to="/listings">
            Browse rentals
          </Link>
        </section>
      ) : null}

      {!loading && !message && saves.length ? (
        <ul className="saved-listing-grid" aria-label="Saved rentals">
          {saves.map((save) => (
            <li key={save.listing_id}>
              {save.availability === 'AVAILABLE' && save.listing ? (
                <PublicListingCard listing={save.listing}>
                  <div className="saved-card-actions">
                    <span>Saved {savedDate(save.saved_at)}</span>
                    <button
                      className="secondary-button"
                      type="button"
                      disabled={removingId === save.listing_id}
                      onClick={() => remove(save.listing_id)}
                    >
                      {removingId === save.listing_id
                        ? 'Removing...'
                        : 'Remove'}
                    </button>
                  </div>
                </PublicListingCard>
              ) : (
                <article className="unavailable-saved-card">
                  <p className="status-label">Unavailable</p>
                  <h2>This rental is no longer available</h2>
                  <p>Saved {savedDate(save.saved_at)}</p>
                  <p>
                    Its listing details are private now. You can safely remove
                    it from this list.
                  </p>
                  <button
                    className="secondary-button"
                    type="button"
                    disabled={removingId === save.listing_id}
                    onClick={() => remove(save.listing_id)}
                  >
                    {removingId === save.listing_id ? 'Removing...' : 'Remove'}
                  </button>
                </article>
              )}
            </li>
          ))}
        </ul>
      ) : null}

      {!loading && !message && meta.total_pages > 1 ? (
        <nav className="pagination" aria-label="Saved rental pages">
          <button
            type="button"
            disabled={meta.page <= 1 || removingId !== null}
            onClick={() => load(meta.page - 1)}
          >
            Previous
          </button>
          <span>
            Page {meta.page} of {meta.total_pages}
          </span>
          <button
            type="button"
            disabled={meta.page >= meta.total_pages || removingId !== null}
            onClick={() => load(meta.page + 1)}
          >
            Next
          </button>
        </nav>
      ) : null}
    </main>
  );
}
