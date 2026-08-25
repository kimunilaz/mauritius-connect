import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { ApiError } from '../../services/apiClient.js';
import {
  getAdminVerification,
  moderateVerification,
} from '../../services/verificationService.js';

export default function AdminVerificationDetailPage() {
  const { verificationId } = useParams();
  const { session } = useAuth();
  const [item, setItem] = useState(null);
  const [message, setMessage] = useState('');
  const [pending, setPending] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    void getAdminVerification(session.access_token, verificationId)
      .then((result) => !controller.signal.aborted && setItem(result))
      .catch((error) => {
        if (!controller.signal.aborted)
          setMessage(
            error instanceof ApiError
              ? error.message
              : 'Verification could not be loaded.',
          );
      });
    return () => controller.abort();
  }, [session.access_token, verificationId]);

  async function act(action) {
    setPending(true);
    setMessage('');
    try {
      const result = await moderateVerification(
        session.access_token,
        verificationId,
        action,
        action === 'reject'
          ? { reason: 'Evidence requires further review.' }
          : {},
      );
      setItem((current) => ({ ...current, status: result.status }));
      setMessage(
        action === 'approve'
          ? 'Verification approved.'
          : 'Verification rejected.',
      );
    } catch (error) {
      setMessage(
        error instanceof ApiError
          ? error.message
          : 'Verification action failed.',
      );
    } finally {
      setPending(false);
    }
  }

  if (!item)
    return (
      <main className="management-shell">
        <p role={message ? 'alert' : undefined}>
          {message || 'Loading verification...'}
        </p>
      </main>
    );

  return (
    <main className="management-shell">
      <Link className="public-back-link" to="/admin/verifications">
        Back to verifications
      </Link>
      <h1>{item.type}</h1>
      <p>Status: {item.status}</p>
      {message ? <p role="status">{message}</p> : null}
      <div className="card-actions">
        <button
          type="button"
          disabled={pending || item.status !== 'PENDING'}
          onClick={() => act('approve')}
        >
          Approve
        </button>
        <button
          type="button"
          disabled={pending || item.status !== 'PENDING'}
          onClick={() => act('reject')}
        >
          Reject
        </button>
      </div>
    </main>
  );
}
