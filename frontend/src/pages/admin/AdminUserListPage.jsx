import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { ApiError } from '../../services/apiClient.js';
import { listAdminUsers } from '../../services/adminService.js';

export default function AdminUserListPage() {
  const { session } = useAuth();
  const [items, setItems] = useState([]);
  const [query, setQuery] = useState('');
  const [meta, setMeta] = useState({ page: 1, total_pages: 0 });
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  const load = useCallback(
    async (page = 1, signal) => {
      setLoading(true);
      try {
        const result = await listAdminUsers(session.access_token, {
          page,
          limit: 20,
          q: query.trim(),
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
              : 'Users could not be loaded.',
          );
        }
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [query, session.access_token],
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
          <h1>User administration</h1>
          <p>Inspect and control access for platform accounts.</p>
        </div>
        <Link to="/account">Admin home</Link>
      </header>
      <form
        className="report-filters"
        onSubmit={(event) => {
          event.preventDefault();
          void load(1);
        }}
      >
        <label htmlFor="admin-user-search">Name</label>
        <input
          id="admin-user-search"
          value={query}
          maxLength={100}
          onChange={(event) => setQuery(event.target.value)}
        />
        <button type="submit">Search users</button>
      </form>
      {loading ? <p aria-live="polite">Loading users...</p> : null}
      {message ? (
        <p className="form-message" role="alert">
          {message}
        </p>
      ) : null}
      {!loading && !message && items.length === 0 ? (
        <section className="empty-state">
          <h2>No users found</h2>
          <p>No account matches this search.</p>
        </section>
      ) : null}
      {!loading && !message && items.length > 0 ? (
        <ul className="notification-list" aria-label="Admin users">
          {items.map((item) => (
            <li key={item.id}>
              <Link to={`/admin/users/${item.id}`}>
                <strong>
                  {item.first_name} {item.last_name}
                </strong>
                <span>
                  {item.role} · {item.account_status}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
      {!loading && meta.total_pages > 1 ? (
        <nav className="pagination" aria-label="User pages">
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
