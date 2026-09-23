import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import { apiRequest } from '../../services/apiClient.js';
import { statusLabel } from '../../utils/status.js';

// Read-only presentation of the existing, owner-scoped verification list.
export default function LandlordVerificationPage() {
  const { session } = useAuth();
  const [page, setPage] = useState(1);
  const [attempt, retry] = useState(0);
  const [state, setState] = useState({});
  useEffect(() => {
    const controller = new AbortController();
    setState({});
    apiRequest(`/landlord/verifications?page=${page}&limit=10`, {
      accessToken: session.access_token,
      signal: controller.signal,
      returnEnvelope: true,
    }).then(
      (value) => {
        if (!controller.signal.aborted) setState({ value });
      },
      () => {
        if (!controller.signal.aborted) setState({ error: true });
      },
    );
    return () => controller.abort();
  }, [session.access_token, page, attempt]);
  return (
    <main className="management-shell">
      <header className="profile-header">
        <h1>Verification</h1>
      </header>
      {state.error ? (
        <div role="alert">
          <p>Verification requests couldn't be loaded.</p>
          <button onClick={() => retry((n) => n + 1)}>Retry</button>
        </div>
      ) : !state.value ? (
        <p role="status">Loading verification requests...</p>
      ) : (
        <>
          {!state.value.data.length && <p>No verification requests yet.</p>}
          <ul className="notification-list">
            {state.value.data.map((item) => (
              <li key={item.id}>
                <strong>{statusLabel(item.type)}</strong>
                <span className="status-label" data-status={item.status}>
                  {statusLabel(item.status)}
                </span>
                {item.rejection_reason && <p>{item.rejection_reason}</p>}
              </li>
            ))}
          </ul>
          <nav className="pagination" aria-label="Verification pages">
            <button disabled={page === 1} onClick={() => setPage((n) => n - 1)}>
              Previous
            </button>
            <span>Page {page}</span>
            <button
              disabled={page * 10 >= state.value.meta.total}
              onClick={() => setPage((n) => n + 1)}
            >
              Next
            </button>
          </nav>
        </>
      )}
    </main>
  );
}
