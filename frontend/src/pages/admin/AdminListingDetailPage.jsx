import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { ApiError } from '../../services/apiClient.js';
import {
  getAdminListing,
  reviewAdminListing,
} from '../../services/adminService.js';

export default function AdminListingDetailPage() {
  const { listingId } = useParams();
  const { session } = useAuth();
  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [reason, setReason] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    getAdminListing(session.access_token, listingId)
      .then((result) => !controller.signal.aborted && setItem(result))
      .catch((error) => {
        if (!controller.signal.aborted) {
          setMessage(
            error instanceof ApiError
              ? error.message
              : 'Listing could not be loaded.',
          );
        }
      })
      .finally(() => !controller.signal.aborted && setLoading(false));
    return () => controller.abort();
  }, [listingId, session.access_token]);

  async function act(action) {
    if (
      action === 'return-to-draft' &&
      !globalThis.confirm('Return this listing to draft for the landlord?')
    )
      return;
    setPending(true);
    setMessage('');
    try {
      const result = await reviewAdminListing(
        session.access_token,
        listingId,
        action,
        reason.trim(),
      );
      setItem((current) => ({ ...current, status: result.status }));
      setReason('');
      setMessage(
        action === 'approve'
          ? 'Listing approved and made active.'
          : 'Listing returned to draft.',
      );
    } catch (error) {
      setMessage(
        error instanceof ApiError ? error.message : 'Listing action failed.',
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="management-shell">
      <Link className="public-back-link" to="/admin/listings">
        Back to listing review
      </Link>
      {loading ? <p aria-live="polite">Loading listing...</p> : null}
      {message ? (
        <p className="form-message" role="status">
          {message}
        </p>
      ) : null}
      {!loading && item ? (
        <article className="management-panel">
          <p className="eyebrow">Listing review</p>
          <h1>{item.title}</h1>
          <p>Status: {item.status}</p>
          <p>{item.description}</p>
          {item.status === 'PENDING_REVIEW' ? (
            <>
              <label htmlFor="listing-review-reason">
                Feedback when returning to draft
              </label>
              <textarea
                id="listing-review-reason"
                maxLength={1000}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
              />
              <div className="card-actions">
                <button
                  className="primary-button"
                  type="button"
                  disabled={pending}
                  onClick={() => act('approve')}
                >
                  Approve listing
                </button>
                <button
                  className="danger-button"
                  type="button"
                  disabled={pending || !reason.trim()}
                  onClick={() => act('return-to-draft')}
                >
                  Return to draft
                </button>
              </div>
            </>
          ) : null}
        </article>
      ) : null}
    </main>
  );
}
