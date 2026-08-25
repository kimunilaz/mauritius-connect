import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { ApiError } from '../../services/apiClient.js';
import {
  changeAdminUserStatus,
  getAdminUser,
} from '../../services/adminService.js';

export default function AdminUserDetailPage() {
  const { userId } = useParams();
  const { session } = useAuth();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    getAdminUser(session.access_token, userId)
      .then((result) => !controller.signal.aborted && setUser(result))
      .catch((error) => {
        if (!controller.signal.aborted) {
          setMessage(
            error instanceof ApiError
              ? error.message
              : 'User could not be loaded.',
          );
        }
      })
      .finally(() => !controller.signal.aborted && setLoading(false));
    return () => controller.abort();
  }, [session.access_token, userId]);

  async function change(action) {
    if (
      action === 'suspend' &&
      !globalThis.confirm(
        'Suspend this account? Protected access will be blocked and active landlord listings will be paused.',
      )
    )
      return;
    setPending(true);
    setMessage('');
    try {
      const result = await changeAdminUserStatus(
        session.access_token,
        userId,
        action,
      );
      setUser((current) => ({
        ...current,
        account_status: result.account_status,
      }));
      setMessage(
        action === 'suspend' ? 'Account suspended.' : 'Account reactivated.',
      );
    } catch (error) {
      setMessage(
        error instanceof ApiError ? error.message : 'Account action failed.',
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="management-shell">
      <Link className="public-back-link" to="/admin/users">
        Back to users
      </Link>
      {loading ? <p aria-live="polite">Loading user...</p> : null}
      {message ? (
        <p className="form-message" role="status">
          {message}
        </p>
      ) : null}
      {!loading && user ? (
        <article className="management-panel">
          <p className="eyebrow">{user.role}</p>
          <h1>
            {user.first_name} {user.last_name}
          </h1>
          <p>Account status: {user.account_status}</p>
          {user.account_status === 'ACTIVE' ? (
            <button
              className="danger-button"
              type="button"
              disabled={pending}
              onClick={() => change('suspend')}
            >
              Suspend account
            </button>
          ) : null}
          {user.account_status === 'SUSPENDED' ? (
            <button
              className="primary-button"
              type="button"
              disabled={pending}
              onClick={() => change('reactivate')}
            >
              Reactivate account
            </button>
          ) : null}
        </article>
      ) : null}
    </main>
  );
}
