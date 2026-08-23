import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { ApiError } from '../../services/apiClient.js';
import { listLandlordApplications } from '../../services/landlordApplicationService.js';
import {
  applicationDate,
  applicationStatusLabel,
} from '../../utils/application.js';

const FILTERS = [
  ['', 'All'],
  ['SUBMITTED', 'Submitted'],
  ['UNDER_REVIEW', 'Under review'],
  ['SHORTLISTED', 'Shortlisted'],
  ['VIEWING_INVITED', 'Viewing invited'],
  ['VIEWING_COMPLETED', 'Viewing completed'],
  ['ACCEPTED', 'Accepted'],
  ['REJECTED', 'Rejected'],
  ['WITHDRAWN', 'Withdrawn'],
];

export default function LandlordApplicantListPage() {
  const { listingId } = useParams();
  const { session } = useAuth();
  const [applications, setApplications] = useState([]);
  const [meta, setMeta] = useState({
    page: 1,
    limit: 20,
    total: 0,
    total_pages: 0,
    listing: null,
  });
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  const load = useCallback(
    async (page, signal) => {
      setLoading(true);
      setMessage('');
      try {
        const result = await listLandlordApplications(
          session.access_token,
          listingId,
          { page, status: status || undefined, signal },
        );
        setApplications(result.applications);
        setMeta(result.meta);
      } catch (error) {
        if (error.name === 'AbortError') return;
        setApplications([]);
        setMessage(
          error instanceof ApiError
            ? error.message
            : "We couldn't load the applicants. Try again.",
        );
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [listingId, session.access_token, status],
  );

  useEffect(() => {
    const controller = new AbortController();
    void load(1, controller.signal);
    return () => controller.abort();
  }, [load]);

  return (
    <main className="management-shell applicant-pipeline-shell">
      <header className="profile-header">
        <div>
          <p className="eyebrow">Applicant pipeline</p>
          <h1>{meta.listing?.title ?? 'Listing applications'}</h1>
          <p>Review submitted applications without changing their status.</p>
        </div>
        <Link to={`/landlord/listings/${listingId}`}>Back to listing</Link>
      </header>

      <nav
        className="applicant-status-tabs"
        aria-label="Applicant status filters"
      >
        {FILTERS.map(([value, label]) => (
          <button
            key={value || 'all'}
            type="button"
            aria-pressed={status === value}
            onClick={() => setStatus(value)}
          >
            {label}
          </button>
        ))}
      </nav>

      {message ? (
        <p className="form-message" role="alert">
          {message}
        </p>
      ) : null}
      {loading ? (
        <p aria-live="polite">Loading submitted applications...</p>
      ) : null}
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
          <h2>No submitted applications yet</h2>
          <p>
            {status
              ? 'No applications currently match this status.'
              : 'Applications will appear here after tenants submit them.'}
          </p>
        </section>
      ) : null}

      {!loading && !message && applications.length ? (
        <ul className="applicant-card-grid" aria-label="Submitted applicants">
          {applications.map((application) => {
            const name = `${application.tenant.first_name} ${application.tenant.last_name}`;
            return (
              <li key={application.application_id}>
                <article className="applicant-card">
                  <header>
                    {application.tenant.profile_photo_url ? (
                      <img
                        src={application.tenant.profile_photo_url}
                        alt={`${name} profile`}
                      />
                    ) : (
                      <span className="applicant-avatar" aria-hidden="true">
                        {application.tenant.first_name.charAt(0)}
                        {application.tenant.last_name.charAt(0)}
                      </span>
                    )}
                    <div>
                      <h2>{name}</h2>
                      <p className="status-label">
                        {applicationStatusLabel(application.status)}
                      </p>
                    </div>
                  </header>
                  <dl>
                    <div>
                      <dt>Move-in</dt>
                      <dd>{applicationDate(application.move_in_date)}</dd>
                    </div>
                    <div>
                      <dt>Lease</dt>
                      <dd>
                        {application.requested_lease_duration_months
                          ? `${application.requested_lease_duration_months} months`
                          : 'Not provided'}
                      </dd>
                    </div>
                    <div>
                      <dt>Occupants</dt>
                      <dd>
                        {application.number_of_occupants ?? 'Not provided'}
                      </dd>
                    </div>
                    <div>
                      <dt>Submitted</dt>
                      <dd>{applicationDate(application.submitted_at)}</dd>
                    </div>
                  </dl>
                  <Link
                    className="primary-link-button"
                    to={`/landlord/applications/${application.application_id}`}
                  >
                    View application
                  </Link>
                </article>
              </li>
            );
          })}
        </ul>
      ) : null}

      {!loading && !message && meta.total_pages > 1 ? (
        <nav className="pagination" aria-label="Applicant pages">
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
