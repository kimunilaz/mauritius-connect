import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import PublicListingCard from '../../components/public/PublicListingCard.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { ApiError } from '../../services/apiClient.js';
import { listTenantApplications } from '../../services/applicationService.js';
import {
  APPLICATION_STATUSES,
  applicationDate,
  applicationStatusLabel,
} from '../../utils/application.js';

function ApplicationAction({ application }) {
  if (
    application.status === 'DRAFT' &&
    application.availability === 'AVAILABLE'
  ) {
    return (
      <Link
        className="primary-link-button"
        to={`/listings/${application.listing_id}/apply`}
      >
        Continue application
      </Link>
    );
  }
  return (
    <Link
      className="primary-link-button"
      to={`/tenant/applications/${application.id}`}
    >
      View application
    </Link>
  );
}

export default function TenantApplicationListPage() {
  const { session } = useAuth();
  const [applications, setApplications] = useState([]);
  const [meta, setMeta] = useState({
    page: 1,
    limit: 20,
    total: 0,
    total_pages: 0,
  });
  const [selectedStatus, setSelectedStatus] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  const load = useCallback(
    async (page, signal) => {
      setLoading(true);
      setMessage('');
      try {
        const result = await listTenantApplications(session.access_token, {
          page,
          status: status || undefined,
          signal,
        });
        setApplications(result.applications);
        setMeta(result.meta);
      } catch (error) {
        if (error.name === 'AbortError') return;
        setApplications([]);
        setMessage(
          error instanceof ApiError
            ? error.message
            : "We couldn't load your applications. Try again.",
        );
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

  function filter(event) {
    event.preventDefault();
    setStatus(selectedStatus);
  }

  return (
    <main className="management-shell tenant-applications-shell">
      <header className="profile-header">
        <div>
          <p className="eyebrow">Tenant</p>
          <h1>My applications</h1>
          <p>Review drafts and submitted rental applications in one place.</p>
        </div>
        <Link to="/listings">Browse rentals</Link>
      </header>

      <form className="application-filter" onSubmit={filter}>
        <label htmlFor="application-status">Status</label>
        <select
          id="application-status"
          value={selectedStatus}
          onChange={(event) => setSelectedStatus(event.target.value)}
        >
          <option value="">All statuses</option>
          {APPLICATION_STATUSES.map((value) => (
            <option key={value} value={value}>
              {applicationStatusLabel(value)}
            </option>
          ))}
        </select>
        <button type="submit">Apply filter</button>
        {selectedStatus || status ? (
          <button
            className="secondary-button"
            type="button"
            onClick={() => {
              setSelectedStatus('');
              setStatus('');
            }}
          >
            Clear
          </button>
        ) : null}
      </form>

      {message ? (
        <p className="form-message" role="alert">
          {message}
        </p>
      ) : null}
      {loading ? <p aria-live="polite">Loading applications...</p> : null}
      {!loading && message ? (
        <button
          className="secondary-button"
          type="button"
          onClick={() => load(meta.page)}
        >
          Try again
        </button>
      ) : null}
      {!loading && !message && applications.length === 0 ? (
        <section className="empty-state">
          <h2>No applications found</h2>
          <p>
            {status
              ? 'No applications match this status.'
              : 'Start from an available rental listing.'}
          </p>
          <Link className="primary-link-button" to="/listings">
            Browse rentals
          </Link>
        </section>
      ) : null}

      {!loading && !message && applications.length ? (
        <ul
          className="tenant-application-grid"
          aria-label="Rental applications"
        >
          {applications.map((application) => (
            <li key={application.id}>
              {application.availability === 'AVAILABLE' &&
              application.listing ? (
                <PublicListingCard listing={application.listing}>
                  <div className="application-card-summary">
                    <p>
                      <strong>Status:</strong>{' '}
                      {applicationStatusLabel(application.status)}
                    </p>
                    <p>
                      {application.submitted_at ? 'Submitted' : 'Updated'}{' '}
                      {applicationDate(
                        application.submitted_at ?? application.updated_at,
                      )}
                    </p>
                    <ApplicationAction application={application} />
                  </div>
                </PublicListingCard>
              ) : (
                <article className="unavailable-saved-card application-unavailable-card">
                  <p className="status-label">Unavailable rental</p>
                  <h2>
                    {applicationStatusLabel(application.status)} application
                  </h2>
                  <p>
                    {application.submitted_at ? 'Submitted' : 'Updated'}{' '}
                    {applicationDate(
                      application.submitted_at ?? application.updated_at,
                    )}
                  </p>
                  <p>
                    The listing is no longer public. Your application is
                    preserved without exposing its private listing details.
                  </p>
                  <ApplicationAction application={application} />
                </article>
              )}
            </li>
          ))}
        </ul>
      ) : null}

      {!loading && !message && meta.total_pages > 1 ? (
        <nav className="pagination" aria-label="Application pages">
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
