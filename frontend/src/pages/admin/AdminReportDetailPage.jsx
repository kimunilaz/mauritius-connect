import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { ApiError } from '../../services/apiClient.js';
import {
  getAdminReport,
  moderateReport,
} from '../../services/reportService.js';

export default function AdminReportDetailPage() {
  const { reportId } = useParams();
  const { session } = useAuth();
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [reason, setReason] = useState('');
  const [message, setMessage] = useState('');
  const [pending, setPending] = useState(null);

  useEffect(() => {
    const controller = new AbortController();
    getAdminReport(session.access_token, reportId, {
      signal: controller.signal,
    })
      .then(setReport)
      .catch((error) => {
        if (error.name !== 'AbortError')
          setMessage(
            error instanceof ApiError
              ? error.message
              : 'Report could not be loaded.',
          );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [reportId, session.access_token]);

  async function action(actionName) {
    setPending(actionName);
    try {
      await moderateReport(session.access_token, reportId, actionName, reason);
      setReport(await getAdminReport(session.access_token, reportId));
      setReason('');
      setMessage('Report updated.');
    } catch (error) {
      setMessage(
        error instanceof ApiError ? error.message : 'Report action failed.',
      );
    } finally {
      setPending(null);
    }
  }

  return (
    <main className="management-shell conversation-shell">
      <Link className="public-back-link" to="/admin/reports">
        Back to reports
      </Link>
      {loading ? <p>Loading report...</p> : null}
      {message ? (
        <p className="form-message" role="status">
          {message}
        </p>
      ) : null}
      {!loading && report ? (
        <article className="management-panel">
          <header className="profile-header">
            <div>
              <p className="eyebrow">{report.target_type} report</p>
              <h1>{report.reason}</h1>
              <p>Status: {report.status}</p>
            </div>
          </header>
          <p>{report.details || 'No reporter details provided.'}</p>
          {report.target?.type === 'LISTING' ? (
            <section>
              <h2>Listing context</h2>
              <p>{report.target.listing.title}</p>
              <p>
                {report.target.listing.property.district},{' '}
                {report.target.listing.property.locality}
              </p>
              <p>Status: {report.target.listing.status}</p>
            </section>
          ) : null}
          {report.target?.type === 'MESSAGE' ? (
            <section>
              <h2>Reported message</h2>
              <p>{report.target.message.content}</p>
              <p>
                Sent by{' '}
                {report.target.message.sender?.first_name ?? 'participant'}
              </p>
            </section>
          ) : null}
          <label htmlFor="moderation-reason">Moderation note (optional)</label>
          <textarea
            id="moderation-reason"
            maxLength={1000}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
          <div className="public-listing-actions">
            <button
              type="button"
              disabled={pending !== null || report.status !== 'OPEN'}
              onClick={() => action('review')}
            >
              Mark under review
            </button>
            <button
              type="button"
              disabled={
                pending !== null ||
                !['OPEN', 'UNDER_REVIEW'].includes(report.status)
              }
              onClick={() => action('resolve')}
            >
              Resolve
            </button>
            <button
              type="button"
              disabled={
                pending !== null ||
                !['OPEN', 'UNDER_REVIEW'].includes(report.status)
              }
              onClick={() => action('dismiss')}
            >
              Dismiss
            </button>
          </div>
        </article>
      ) : null}
    </main>
  );
}
