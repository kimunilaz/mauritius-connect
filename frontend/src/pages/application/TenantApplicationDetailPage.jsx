import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import PublicListingCard from '../../components/public/PublicListingCard.jsx';
import ViewingSection from '../../components/application/ViewingSection.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { ApiError } from '../../services/apiClient.js';
import {
  getTenantApplication,
  withdrawApplication,
} from '../../services/applicationService.js';
import {
  applicationDate,
  applicationStatusLabel,
} from '../../utils/application.js';

function value(value) {
  return value === null || value === '' ? 'Not provided' : value;
}

export default function TenantApplicationDetailPage() {
  const { applicationId } = useParams();
  const { session } = useAuth();
  const [application, setApplication] = useState(null);
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [actionPending, setActionPending] = useState(false);
  const [actionMessage, setActionMessage] = useState('');

  const canWithdraw = ['SUBMITTED', 'UNDER_REVIEW', 'SHORTLISTED'].includes(
    application?.status,
  );

  async function handleWithdraw() {
    if (
      !globalThis.confirm(
        'Withdraw this application? This action cannot be undone.',
      )
    )
      return;
    setActionPending(true);
    setActionMessage('');
    try {
      await withdrawApplication(session.access_token, applicationId);
      const result = await getTenantApplication(
        session.access_token,
        applicationId,
      );
      setApplication(result.application);
      setMeta(result.meta);
      setActionMessage('Application withdrawn.');
    } catch (error) {
      setActionMessage(
        error instanceof ApiError
          ? error.message
          : "We couldn't withdraw this application. Try again.",
      );
    } finally {
      setActionPending(false);
    }
  }

  async function refreshApplication() {
    const result = await getTenantApplication(
      session.access_token,
      applicationId,
    );
    setApplication(result.application);
    setMeta(result.meta);
  }

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setMessage('');
    getTenantApplication(session.access_token, applicationId, {
      signal: controller.signal,
    })
      .then((result) => {
        setApplication(result.application);
        setMeta(result.meta);
      })
      .catch((error) => {
        if (error.name === 'AbortError') return;
        setMessage(
          error instanceof ApiError
            ? error.message
            : "We couldn't load this application. Try again.",
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [applicationId, session.access_token]);

  return (
    <main className="management-shell tenant-application-detail">
      <header className="profile-header">
        <div>
          <p className="eyebrow">Tenant application</p>
          <h1>Application details</h1>
        </div>
        <Link to="/tenant/applications">Back to applications</Link>
      </header>
      {loading ? <p aria-live="polite">Loading application...</p> : null}
      {message ? (
        <p className="form-message" role="alert">
          {message}
        </p>
      ) : null}

      {!loading && application ? (
        <>
          <section
            className="management-panel application-overview"
            aria-labelledby="application-overview-title"
          >
            <h2 id="application-overview-title">Overview</h2>
            <dl className="application-detail-grid">
              <div>
                <dt>Status</dt>
                <dd>{applicationStatusLabel(application.status)}</dd>
              </div>
              <div>
                <dt>Listing availability</dt>
                <dd>
                  {application.availability === 'AVAILABLE'
                    ? 'Available'
                    : 'Unavailable'}
                </dd>
              </div>
              <div>
                <dt>Move-in date</dt>
                <dd>{applicationDate(application.move_in_date)}</dd>
              </div>
              <div>
                <dt>Lease duration</dt>
                <dd>
                  {application.requested_lease_duration_months
                    ? `${application.requested_lease_duration_months} months`
                    : 'Not provided'}
                </dd>
              </div>
              <div>
                <dt>Occupants</dt>
                <dd>{value(application.number_of_occupants)}</dd>
              </div>
              <div>
                <dt>Updated</dt>
                <dd>{applicationDate(application.updated_at)}</dd>
              </div>
            </dl>
            <h3>Introduction</h3>
            <p>{value(application.introductory_message)}</p>
            {meta?.editable ? (
              <Link
                className="primary-link-button"
                to={`/listings/${application.listing_id}/apply`}
              >
                Continue editing
              </Link>
            ) : (
              <p className="read-only-notice">This application is read-only.</p>
            )}
            {canWithdraw ? (
              <div className="application-review-actions">
                <button
                  className="danger-button"
                  type="button"
                  disabled={actionPending}
                  onClick={handleWithdraw}
                >
                  {actionPending ? 'Withdrawing...' : 'Withdraw application'}
                </button>
              </div>
            ) : null}
            {actionMessage ? (
              <p className="form-message" role="status">
                {actionMessage}
              </p>
            ) : null}
          </section>

          {['VIEWING_INVITED', 'VIEWING_COMPLETED'].includes(
            application.status,
          ) ? (
            <ViewingSection
              accessToken={session.access_token}
              applicationId={applicationId}
              applicationStatus={application.status}
              role="TENANT"
              onApplicationChanged={refreshApplication}
            />
          ) : null}

          {application.availability === 'AVAILABLE' && application.listing ? (
            <section aria-labelledby="application-rental-title">
              <h2 id="application-rental-title">Rental</h2>
              <PublicListingCard listing={application.listing} />
            </section>
          ) : (
            <section
              className="management-panel unavailable-application-detail"
              aria-labelledby="unavailable-rental-title"
            >
              <h2 id="unavailable-rental-title">Rental unavailable</h2>
              <p>
                The listing is no longer public, so its private details are not
                shown here.
              </p>
            </section>
          )}

          <section
            className="management-panel"
            aria-labelledby="application-answers-title"
          >
            <h2 id="application-answers-title">Answers</h2>
            {application.answers.length ? (
              <dl className="application-answer-list">
                {application.answers.map((answer) => (
                  <div key={answer.question_id}>
                    <dt>{answer.question_text ?? 'Saved answer'}</dt>
                    <dd>{value(answer.answer_text)}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p>No answers saved.</p>
            )}
          </section>

          <section
            className="management-panel"
            aria-labelledby="application-timeline-title"
          >
            <h2 id="application-timeline-title">Status timeline</h2>
            {application.history.length ? (
              <ol className="application-timeline">
                {application.history.map((event, index) => (
                  <li key={`${event.created_at}-${index}`}>
                    <strong>{applicationStatusLabel(event.to_status)}</strong>
                    <span>{applicationDate(event.created_at)}</span>
                  </li>
                ))}
              </ol>
            ) : (
              <p>No status changes recorded yet.</p>
            )}
          </section>
        </>
      ) : null}
    </main>
  );
}
