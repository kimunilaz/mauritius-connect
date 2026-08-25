import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { ApiError } from '../../services/apiClient.js';
import { listAdminVerifications } from '../../services/verificationService.js';

export default function AdminVerificationListPage() {
  const { session } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    void listAdminVerifications(session.access_token, '?status=PENDING')
      .then((result) => !controller.signal.aborted && setItems(result ?? []))
      .catch((error) => {
        if (!controller.signal.aborted)
          setMessage(
            error instanceof ApiError
              ? error.message
              : 'Verifications could not be loaded.',
          );
      })
      .finally(() => !controller.signal.aborted && setLoading(false));
    return () => controller.abort();
  }, [session.access_token]);

  return (
    <main className="management-shell">
      <header className="profile-header">
        <div>
          <p className="eyebrow">Admin</p>
          <h1>Verification queue</h1>
        </div>
        <Link to="/account">Admin home</Link>
      </header>
      {loading ? <p aria-live="polite">Loading verifications...</p> : null}
      {message ? <p role="alert">{message}</p> : null}
      {!loading && !message && items.length === 0 ? (
        <section className="empty-state">
          <h2>No pending verifications</h2>
          <p>The verification queue is clear.</p>
        </section>
      ) : null}
      {!loading && !message && items.length > 0 ? (
        <ul aria-label="Pending verifications">
          {items.map((item) => (
            <li key={item.id}>
              <Link to={`/admin/verifications/${item.id}`}>
                {item.type} · {item.status}
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </main>
  );
}
