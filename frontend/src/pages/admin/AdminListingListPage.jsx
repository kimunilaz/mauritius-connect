import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { ApiError } from '../../services/apiClient.js';
import { listAdminListings } from '../../services/adminService.js';

export default function AdminListingListPage() {
  const { session } = useAuth();
  const [items, setItems] = useState([]);
  const [status, setStatus] = useState('PENDING_REVIEW');
  const [meta, setMeta] = useState({ page: 1, total_pages: 0 });
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  const load = useCallback(
    async (page = 1, signal) => {
      setLoading(true);
      try {
        const result = await listAdminListings(session.access_token, {
          page,
          limit: 20,
          status,
        });
        if (!signal?.aborted) {
          setItems(result.data);
          setMeta(result.meta);
          setMessage('');
        }
      } catch (error) {
        if (error.name !== 'AbortError') {
          setMessage(
            error instanceof ApiError
              ? error.message
              : 'Listings could not be loaded.',
          );
        }
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [session.access_token, status],
  );

  useEffect(() => {
    const controller = new AbortController();
    void load(1, controller.signal);
    return () => controller.abort();
  }, [load]);

  return (
    <main className="management-shell">
      <header className="profile-header">
        <div>
          <p className="eyebrow">Admin</p>
          <h1>Listing review</h1>
          <p>Review landlord submissions before they become public.</p>
        </div>
        <Link to="/account">Admin home</Link>
      </header>
      <label htmlFor="admin-listing-status">Status</label>
      <select
        id="admin-listing-status"
        value={status}
        onChange={(event) => setStatus(event.target.value)}
      >
        <option value="PENDING_REVIEW">Pending review</option>
        <option value="DRAFT">Draft</option>
        <option value="ACTIVE">Active</option>
        <option value="PAUSED">Paused</option>
        <option value="RENTED">Rented</option>
        <option value="CLOSED">Closed</option>
        <option value="">All statuses</option>
      </select>
      {loading ? <p aria-live="polite">Loading listings...</p> : null}
      {message ? (
        <p className="form-message" role="alert">
          {message}
        </p>
      ) : null}
      {!loading && !message && items.length === 0 ? (
        <section className="empty-state">
          <h2>No listings found</h2>
          <p>There are no listings matching this status.</p>
        </section>
      ) : null}
      {!loading && !message && items.length > 0 ? (
        <ul className="notification-list" aria-label="Admin listings">
          {items.map((item) => (
            <li key={item.id}>
              <Link to={`/admin/listings/${item.id}`}>
                <strong>{item.title}</strong>
                <span>{item.status}</span>
                <small>
                  {item.property.locality}, {item.property.district}
                </small>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
      {!loading && meta.total_pages > 1 ? (
        <nav className="pagination" aria-label="Listing review pages">
          <button
            type="button"
            disabled={meta.page <= 1}
            onClick={() => load(meta.page - 1)}
          >
            Previous
          </button>
          <span>
            Page {meta.page} of {meta.total_pages}
          </span>
          <button
            type="button"
            disabled={meta.page >= meta.total_pages}
            onClick={() => load(meta.page + 1)}
          >
            Next
          </button>
        </nav>
      ) : null}
    </main>
  );
}
