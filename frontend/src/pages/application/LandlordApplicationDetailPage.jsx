import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import ViewingSection from '../../components/application/ViewingSection.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { ApiError } from '../../services/apiClient.js';
import {
  acceptApplication,
  getLandlordApplication,
  rejectApplication,
  reviewApplication,
  shortlistApplication,
} from '../../services/landlordApplicationService.js';
import {
  applicationDate,
  applicationStatusLabel,
} from '../../utils/application.js';
import { publicPropertyTypeLabel } from '../../utils/listing.js';

function optional(value) {
  return value === null || value === '' ? 'Not provided' : value;
}

export default function LandlordApplicationDetailPage() {
  const { applicationId } = useParams();
  const { session } = useAuth();
  const [application, setApplication] = useState(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [actionPending, setActionPending] = useState(false);
  const [actionMessage, setActionMessage] = useState('');

  async function handleAction(action, successMessage, confirmation) {
    if (confirmation && !globalThis.confirm(confirmation)) return;
    setActionPending(true);
    setActionMessage('');
    try {
      await action(session.access_token, applicationId);
      setApplication(
        await getLandlordApplication(session.access_token, applicationId),
      );
      setActionMessage(successMessage);
    } catch (error) {
      setActionMessage(
        error instanceof ApiError
          ? error.message
          : "We couldn't update this application. Try again.",
      );
    } finally {
      setActionPending(false);
    }
  }

  useEffect(() => {
    const controller = new AbortController();
    getLandlordApplication(session.access_token, applicationId, {
      signal: controller.signal,
    })
      .then(setApplication)
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

  if (loading) {
    return (
      <main className="management-shell" aria-live="polite">
        Loading application...
      </main>
    );
  }
  if (!application) {
    return (
      <main className="management-shell">
        <h1>Application unavailable</h1>
        <p role="alert">{message}</p>
        <Link to="/landlord/listings">Back to listings</Link>
      </main>
    );
  }

  const applicantName = `${application.tenant.first_name} ${application.tenant.last_name}`;
  async function refreshApplication() {
    setApplication(
      await getLandlordApplication(session.access_token, applicationId),
    );
  }
  return (
    <main className="management-shell landlord-application-detail">
      <header className="profile-header">
        <div>
          <p className="eyebrow">Submitted application</p>
          <h1>{applicantName}</h1>
          <p>Review this application using the available workflow actions.</p>
        </div>
        <Link to={`/landlord/listings/${application.listing.id}/applications`}>
          Back to applicants
        </Link>
      </header>

      <section className="management-panel" aria-labelledby="applicant-title">
        <h2 id="applicant-title">Applicant</h2>
        <div className="applicant-identity">
          {application.tenant.profile_photo_url ? (
            <img
              src={application.tenant.profile_photo_url}
              alt={`${applicantName} profile`}
            />
          ) : null}
          <p>
            <strong>{applicantName}</strong>
          </p>
        </div>
        <p className="privacy-note">
          Contact and general tenant-profile details are not shared in this
          review.
        </p>
      </section>

      <section
        className="management-panel"
        aria-labelledby="landlord-application-title"
      >
        <h2 id="landlord-application-title">Application details</h2>
        <p className="status-label">
          {applicationStatusLabel(application.status)}
        </p>
        {['SUBMITTED', 'UNDER_REVIEW', 'SHORTLISTED'].includes(
          application.status,
        ) ? (
          <div className="application-review-actions">
            {application.status === 'SUBMITTED' ? (
              <button
                className="primary-button"
                type="button"
                disabled={actionPending}
                onClick={() =>
                  handleAction(
                    reviewApplication,
                    'Application marked under review.',
                  )
                }
              >
                Mark under review
              </button>
            ) : null}
            {application.status === 'UNDER_REVIEW' ? (
              <button
                className="primary-button"
                type="button"
                disabled={actionPending}
                onClick={() =>
                  handleAction(shortlistApplication, 'Application shortlisted.')
                }
              >
                Shortlist
              </button>
            ) : null}
            <button
              className="danger-button"
              type="button"
              disabled={actionPending}
              onClick={() =>
                handleAction(
                  rejectApplication,
                  'Application rejected.',
                  'Reject this application? This action cannot be undone.',
                )
              }
            >
              Reject application
            </button>
          </div>
        ) : application.status === 'VIEWING_COMPLETED' ? (
          <div className="application-review-actions">
            <button
              className="primary-button"
              type="button"
              disabled={actionPending}
              onClick={() =>
                handleAction(
                  acceptApplication,
                  'Application accepted and listing marked rented.',
                  'Accept this application? The listing will be marked rented and competing active applications will be rejected.',
                )
              }
            >
              Accept application
            </button>
          </div>
        ) : (
          <p className="read-only-notice">
            No further review actions are available.
          </p>
        )}
        {actionMessage ? (
          <p className="form-message" role="status">
            {actionMessage}
          </p>
        ) : null}
        <dl className="application-detail-grid">
          <div>
            <dt>Submitted</dt>
            <dd>{applicationDate(application.submitted_at)}</dd>
          </div>
          <div>
            <dt>Move-in</dt>
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
            <dd>{optional(application.number_of_occupants)}</dd>
          </div>
        </dl>
        <h3>Introduction</h3>
        <p>{optional(application.introductory_message)}</p>
      </section>

      {['SHORTLISTED', 'VIEWING_INVITED', 'VIEWING_COMPLETED'].includes(
        application.status,
      ) ? (
        <ViewingSection
          accessToken={session.access_token}
          applicationId={applicationId}
          applicationStatus={application.status}
          role="LANDLORD"
          onApplicationChanged={refreshApplication}
        />
      ) : null}

      <section
        className="management-panel"
        aria-labelledby="application-listing-title"
      >
        <h2 id="application-listing-title">Listing</h2>
        <p>
          <strong>{application.listing.title}</strong>
        </p>
        <p>
          {publicPropertyTypeLabel(application.listing.property.property_type)}{' '}
          · {application.listing.property.locality},{' '}
          {application.listing.property.district} ·{' '}
          {application.listing.property.bedrooms} bedrooms ·{' '}
          {application.listing.property.bathrooms} bathrooms
        </p>
        <p>Status: {applicationStatusLabel(application.listing.status)}</p>
      </section>

      <section
        className="management-panel"
        aria-labelledby="landlord-answers-title"
      >
        <h2 id="landlord-answers-title">Questions and answers</h2>
        {application.answers.length ? (
          <dl className="application-answer-list">
            {application.answers.map((answer, index) => (
              <div key={`${answer.question_text}-${index}`}>
                <dt>{answer.question_text}</dt>
                <dd>{optional(answer.answer_text)}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <p>No submitted answers.</p>
        )}
      </section>

      <section
        className="management-panel"
        aria-labelledby="landlord-timeline-title"
      >
        <h2 id="landlord-timeline-title">Status timeline</h2>
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
          <p>No status changes recorded.</p>
        )}
      </section>
    </main>
  );
}
