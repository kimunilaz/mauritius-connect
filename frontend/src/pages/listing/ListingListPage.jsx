import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { ApiError } from '../../services/apiClient.js';
import { listLandlordListings } from '../../services/listingService.js';
import {
  formatRent,
  LISTING_STATUSES,
  listingStatusLabel,
} from '../../utils/listing.js';

export default function ListingListPage() {
  const { session } = useAuth();
  const token = session.access_token;
  const [listings, setListings] = useState([]);
  const [status, setStatus] = useState('');
  const [meta, setMeta] = useState({
    page: 1,
    limit: 20,
    total: 0,
    total_pages: 0,
  });
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  const load = useCallback(
    async (page, selectedStatus) => {
      setLoading(true);
      setMessage('');
      try {
        const result = await listLandlordListings(token, {
          page,
          status: selectedStatus || undefined,
        });
        setListings(result.listings);
        setMeta(result.meta);
      } catch (error) {
        setMessage(
          error instanceof ApiError
            ? error.message
            : "We couldn't load your listings. Try again.",
        );
      } finally {
        setLoading(false);
      }
    },
    [token],
  );

  useEffect(() => {
    void load(1, status);
  }, [load, status]);

  return (
    <main className="management-shell">
      <header className="profile-header">
        <div>
          <p className="eyebrow">Landlord</p>
          <h1>Your listings</h1>
        </div>
        <Link className="primary-link-button" to="/landlord/listings/new">
          Create listing
        </Link>
      </header>
      <div className="listing-filter">
        <label htmlFor="listing-status-filter">Status</label>
        <select
          id="listing-status-filter"
          value={status}
          onChange={(event) => setStatus(event.target.value)}
        >
          <option value="">All statuses</option>
          {LISTING_STATUSES.map((value) => (
            <option key={value} value={value}>
              {listingStatusLabel(value)}
            </option>
          ))}
        </select>
      </div>
      {message ? (
        <p className="form-message" role="status">
          {message}
        </p>
      ) : null}
      {loading ? <p aria-live="polite">Loading listings...</p> : null}
      {!loading && message && listings.length === 0 ? (
        <button
          className="secondary-button"
          type="button"
          onClick={() => load(meta.page, status)}
        >
          Try again
        </button>
      ) : null}
      {!loading && !message && listings.length === 0 ? (
        <section className="empty-state">
          <h2>No listings found</h2>
          <p>
            Create a draft listing for one of your properties. Drafts remain
            private until submitted for review.
          </p>
          <Link className="primary-link-button" to="/landlord/listings/new">
            Create listing
          </Link>
        </section>
      ) : null}
      <ul className="listing-grid">
        {listings.map((listing) => (
          <li className="listing-card" key={listing.id}>
            {listing.cover_image ? (
              <img src={listing.cover_image.url} alt="Property cover" />
            ) : (
              <div className="listing-cover-placeholder">No cover photo</div>
            )}
            <div className="listing-card-content">
              <p className="status-label">
                {listingStatusLabel(listing.status)}
              </p>
              <h2>{listing.title}</h2>
              <p>{formatRent(listing.monthly_rent)}</p>
              <p>
                {listing.property.locality}, {listing.property.district} ·
                Available {listing.available_from}
              </p>
              <Link to={`/landlord/listings/${listing.id}`}>
                Manage listing
              </Link>
            </div>
          </li>
        ))}
      </ul>
      {meta.total_pages > 1 ? (
        <nav className="pagination" aria-label="Listing pages">
          <button
            type="button"
            disabled={meta.page <= 1 || loading}
            onClick={() => load(meta.page - 1, status)}
          >
            Previous
          </button>
          <span>
            Page {meta.page} of {meta.total_pages}
          </span>
          <button
            type="button"
            disabled={meta.page >= meta.total_pages || loading}
            onClick={() => load(meta.page + 1, status)}
          >
            Next
          </button>
        </nav>
      ) : null}
    </main>
  );
}
