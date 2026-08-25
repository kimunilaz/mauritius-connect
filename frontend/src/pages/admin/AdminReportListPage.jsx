import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { ApiError } from '../../services/apiClient.js';
import { listAdminReports } from '../../services/reportService.js';

export default function AdminReportListPage() {
  const { session } = useAuth();
  const [reports, setReports] = useState([]);
  const [status, setStatus] = useState('');
  const [targetType, setTargetType] = useState('');
  const [meta, setMeta] = useState({
    page: 1,
    limit: 20,
    total: 0,
    total_pages: 0,
  });
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  const load = useCallback(
    async (page = 1, signal) => {
      setLoading(true);
      try {
        const result = await listAdminReports(session.access_token, {
          page,
          status,
          targetType,
          signal,
        });
        setReports(result.reports);
        setMeta(result.meta);
        setMessage('');
      } catch (error) {
        if (error.name !== 'AbortError')
          setMessage(
            error instanceof ApiError
              ? error.message
              : 'Reports could not be loaded.',
          );
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [session.access_token, status, targetType],
  );

  useEffect(() => {
    const controller = new AbortController();
    void load(1, controller.signal);
    return () => controller.abort();
  }, [load]);

  return (
    <main className="management-shell conversation-shell">
      <header className="profile-header">
        <div>
          <p className="eyebrow">Admin</p>
          <h1>Reports</h1>
          <p>Review submitted listing and message reports.</p>
        </div>
      </header>
      <div className="report-filters">
        <label htmlFor="report-status">Status</label>
        <select
          id="report-status"
          value={status}
          onChange={(event) => setStatus(event.target.value)}
        >
          <option value="">All statuses</option>
          <option value="OPEN">Open</option>
          <option value="UNDER_REVIEW">Under review</option>
          <option value="RESOLVED">Resolved</option>
          <option value="DISMISSED">Dismissed</option>
        </select>
        <label htmlFor="report-target">Target</label>
        <select
          id="report-target"
          value={targetType}
          onChange={(event) => setTargetType(event.target.value)}
        >
          <option value="">All targets</option>
          <option value="LISTING">Listing</option>
          <option value="MESSAGE">Message</option>
        </select>
      </div>
      {loading ? <p aria-live="polite">Loading reports...</p> : null}
      {message ? (
        <p className="form-message" role="alert">
          {message}
        </p>
      ) : null}
      {!loading && !message && reports.length === 0 ? (
        <section className="empty-state">
          <h2>No reports found</h2>
          <p>There are no reports matching these filters.</p>
        </section>
      ) : null}
      {!loading && !message && reports.length ? (
        <ul className="notification-list" aria-label="Reports">
          {reports.map((report) => (
            <li key={report.id}>
              <Link to={`/admin/reports/${report.id}`}>
                <strong>
                  {report.target_type} · {report.reason}
                </strong>
                <span>{report.status}</span>
                <small>
                  {report.reporter
                    ? `${report.reporter.first_name} ${report.reporter.last_name}`
                    : 'Reporter'}
                </small>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
      {!loading && meta.total_pages > 1 ? (
        <nav className="pagination" aria-label="Report pages">
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
