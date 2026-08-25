import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import PublicHeader from '../../components/public/PublicHeader.jsx';
import PublicApplicationQuestions from '../../components/public/PublicApplicationQuestions.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { ApiError } from '../../services/apiClient.js';
import { getPublicListing } from '../../services/listingService.js';
import { createConversation } from '../../services/conversationService.js';
import { createReport } from '../../services/reportService.js';
import {
  getSavedListingStatus,
  removeSavedListing,
  saveListing,
} from '../../services/savedListingService.js';
import {
  formatDate,
  formatPublicRent,
  publicLocation,
  publicPropertyTypeLabel,
} from '../../utils/listing.js';

export default function PublicListingDetailPage() {
  const { listingId } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated, loading: authLoading, profile, session } = useAuth();
  const [listing, setListing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [saved, setSaved] = useState(false);
  const [savedLoading, setSavedLoading] = useState(false);
  const [savedMessage, setSavedMessage] = useState('');
  const [savedSubmitting, setSavedSubmitting] = useState(false);
  const [conversationSubmitting, setConversationSubmitting] = useState(false);
  const [conversationMessage, setConversationMessage] = useState('');
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState('FRAUD_OR_SCAM');
  const [reportDetails, setReportDetails] = useState('');
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [reportMessage, setReportMessage] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setListing(null);
    setMessage('');
    getPublicListing(listingId, { signal: controller.signal })
      .then(setListing)
      .catch((error) => {
        if (error.name === 'AbortError') return;
        setMessage(
          error instanceof ApiError && error.status === 404
            ? 'This rental is no longer publicly available.'
            : "We couldn't load this rental. Try again.",
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [listingId]);

  useEffect(() => {
    if (authLoading || profile?.role !== 'TENANT' || !session?.access_token) {
      setSaved(false);
      setSavedLoading(false);
      setSavedMessage('');
      return undefined;
    }
    const controller = new AbortController();
    setSaved(false);
    setSavedLoading(true);
    setSavedMessage('');
    getSavedListingStatus(session.access_token, listingId, {
      signal: controller.signal,
    })
      .then((result) => setSaved(result.saved))
      .catch((error) => {
        if (error.name !== 'AbortError') {
          setSavedMessage('Saved status could not be loaded. Try again.');
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setSavedLoading(false);
      });
    return () => controller.abort();
  }, [authLoading, listingId, profile?.role, session?.access_token]);

  async function toggleSaved() {
    setSavedSubmitting(true);
    setSavedMessage('');
    try {
      if (saved) {
        await removeSavedListing(session.access_token, listingId);
        setSaved(false);
        setSavedMessage('Removed from saved rentals.');
      } else {
        await saveListing(session.access_token, listingId);
        setSaved(true);
        setSavedMessage('Rental saved.');
      }
    } catch (error) {
      setSavedMessage(
        error instanceof ApiError && error.code === 'LISTING_NOT_FOUND'
          ? 'This rental is no longer available to save.'
          : error instanceof ApiError
            ? error.message
            : 'The saved-rental action could not be completed.',
      );
    } finally {
      setSavedSubmitting(false);
    }
  }

  async function startConversation() {
    setConversationSubmitting(true);
    setConversationMessage('');
    try {
      const conversation = await createConversation(
        session.access_token,
        listingId,
      );
      navigate(`/conversations/${conversation.id}`);
    } catch (error) {
      setConversationMessage(
        error instanceof ApiError && error.code === 'LISTING_NOT_FOUND'
          ? 'This rental is no longer available for a new conversation.'
          : error instanceof ApiError
            ? error.message
            : 'The conversation could not be started. Try again.',
      );
    } finally {
      setConversationSubmitting(false);
    }
  }

  async function submitReport(event) {
    event.preventDefault();
    setReportSubmitting(true);
    setReportMessage('');
    try {
      const result = await createReport(session.access_token, {
        target_type: 'LISTING',
        target_id: listingId,
        reason: reportReason,
        details: reportDetails,
      });
      setReportMessage(
        result.created
          ? 'Thanks. Your report was submitted.'
          : 'This listing is already reported by you.',
      );
      setReportOpen(false);
      setReportDetails('');
    } catch (error) {
      setReportMessage(
        error instanceof ApiError
          ? error.message
          : 'The report could not be submitted.',
      );
    } finally {
      setReportSubmitting(false);
    }
  }

  return (
    <div className="public-page">
      <PublicHeader />
      <main className="public-detail-shell">
        <Link className="public-back-link" to="/listings">
          Back to rentals
        </Link>
        {loading ? <p aria-live="polite">Loading rental...</p> : null}
        {!loading && !listing ? (
          <section className="public-state" role="alert">
            <h1>Rental unavailable</h1>
            <p>{message}</p>
            <Link className="primary-link-button" to="/listings">
              Browse available rentals
            </Link>
          </section>
        ) : null}
        {!loading && listing ? (
          <article className="public-listing-detail">
            {listing.images.length ? (
              <section
                className="public-detail-gallery"
                aria-label="Property photos"
              >
                {listing.images.map((image, index) => (
                  <img
                    key={image.id}
                    src={image.url}
                    alt={`${listing.title}, property photo ${index + 1}${image.is_cover ? ', cover photo' : ''}`}
                  />
                ))}
              </section>
            ) : (
              <div className="public-image-placeholder public-detail-placeholder">
                Property photos are temporarily unavailable
              </div>
            )}

            <header className="public-detail-heading">
              <div>
                <p className="public-listing-location">
                  {publicLocation(listing.property)}
                </p>
                <h1>{listing.title}</h1>
                {listing.landlord_verified ||
                listing.property_authority_verified ? (
                  <p className="trust-indicators">
                    {listing.landlord_verified ? 'Identity reviewed' : null}
                    {listing.landlord_verified &&
                    listing.property_authority_verified
                      ? ' Â· '
                      : null}
                    {listing.property_authority_verified
                      ? 'Property evidence reviewed'
                      : null}
                  </p>
                ) : null}
              </div>
              <p className="public-detail-rent">
                {formatPublicRent(listing.monthly_rent)}
              </p>
            </header>

            {!authLoading && !isAuthenticated ? (
              <div className="public-listing-actions">
                <Link to="/login" state={{ from: `/listings/${listingId}` }}>
                  Log in to save
                </Link>
                <Link
                  className="primary-link-button"
                  to="/login"
                  state={{ from: `/listings/${listingId}/apply` }}
                >
                  Log in to apply
                </Link>
                <Link to="/login" state={{ from: `/listings/${listingId}` }}>
                  Log in to contact landlord
                </Link>
              </div>
            ) : null}
            {!authLoading && profile?.role === 'TENANT' ? (
              <div className="public-listing-actions">
                <button
                  className={saved ? 'secondary-button' : 'primary-button'}
                  type="button"
                  disabled={savedLoading || savedSubmitting}
                  aria-pressed={saved}
                  onClick={toggleSaved}
                >
                  {savedLoading
                    ? 'Checking saved status...'
                    : savedSubmitting
                      ? 'Updating...'
                      : saved
                        ? 'Saved — remove'
                        : 'Save rental'}
                </button>
                <Link
                  className="primary-link-button"
                  to={`/listings/${listingId}/apply`}
                >
                  Start or continue application
                </Link>
                <button
                  className="secondary-button"
                  type="button"
                  disabled={conversationSubmitting}
                  onClick={startConversation}
                >
                  {conversationSubmitting
                    ? 'Starting conversation...'
                    : 'Contact landlord'}
                </button>
                {savedMessage ? (
                  <p className="form-message" role="status">
                    {savedMessage}
                  </p>
                ) : null}
                {conversationMessage ? (
                  <p className="form-message" role="alert">
                    {conversationMessage}
                  </p>
                ) : null}
              </div>
            ) : null}
            {!authLoading &&
            (profile?.role === 'TENANT' || profile?.role === 'LANDLORD') ? (
              <section
                className="report-panel"
                aria-labelledby="report-listing-title"
              >
                <button
                  type="button"
                  className="text-button"
                  onClick={() => setReportOpen((open) => !open)}
                >
                  Report listing
                </button>
                {reportOpen ? (
                  <form onSubmit={submitReport}>
                    <h2 id="report-listing-title">Report listing</h2>
                    <label htmlFor="listing-report-reason">Reason</label>
                    <select
                      id="listing-report-reason"
                      value={reportReason}
                      onChange={(event) => setReportReason(event.target.value)}
                    >
                      <option value="FRAUD_OR_SCAM">Fraud or scam</option>
                      <option value="MISLEADING_INFORMATION">
                        Misleading information
                      </option>
                      <option value="INAPPROPRIATE_CONTENT">
                        Inappropriate content
                      </option>
                      <option value="DUPLICATE">Duplicate listing</option>
                      <option value="OTHER">Other</option>
                    </select>
                    <label htmlFor="listing-report-details">
                      Details (optional)
                    </label>
                    <textarea
                      id="listing-report-details"
                      maxLength={1000}
                      value={reportDetails}
                      onChange={(event) => setReportDetails(event.target.value)}
                    />
                    <button type="submit" disabled={reportSubmitting}>
                      {reportSubmitting ? 'Submitting...' : 'Submit report'}
                    </button>
                  </form>
                ) : null}
                {reportMessage ? (
                  <p className="form-message" role="status">
                    {reportMessage}
                  </p>
                ) : null}
              </section>
            ) : null}

            <section aria-labelledby="key-facts-title">
              <h2 id="key-facts-title">Key facts</h2>
              <dl className="public-facts-grid">
                <div>
                  <dt>Property type</dt>
                  <dd>
                    {publicPropertyTypeLabel(listing.property.property_type)}
                  </dd>
                </div>
                <div>
                  <dt>Bedrooms</dt>
                  <dd>{listing.property.bedrooms}</dd>
                </div>
                <div>
                  <dt>Bathrooms</dt>
                  <dd>{listing.property.bathrooms}</dd>
                </div>
                <div>
                  <dt>Furnished</dt>
                  <dd>{listing.property.furnished ? 'Yes' : 'No'}</dd>
                </div>
                <div>
                  <dt>Parking spaces</dt>
                  <dd>{listing.property.parking_spaces}</dd>
                </div>
                <div>
                  <dt>Pets allowed</dt>
                  <dd>{listing.pets_allowed ? 'Yes' : 'No'}</dd>
                </div>
              </dl>
            </section>

            <section aria-labelledby="availability-title">
              <h2 id="availability-title">Availability and conditions</h2>
              <dl className="public-facts-grid">
                <div>
                  <dt>Available from</dt>
                  <dd>{formatDate(listing.available_from)}</dd>
                </div>
                <div>
                  <dt>Deposit</dt>
                  <dd>
                    {listing.deposit_amount === null
                      ? 'Not specified'
                      : `Rs ${new Intl.NumberFormat('en-MU').format(listing.deposit_amount)}`}
                  </dd>
                </div>
                <div>
                  <dt>Minimum lease</dt>
                  <dd>
                    {listing.minimum_lease_months === null
                      ? 'Not specified'
                      : `${listing.minimum_lease_months} months`}
                  </dd>
                </div>
                <div>
                  <dt>Maximum occupants</dt>
                  <dd>{listing.maximum_occupants ?? 'Not specified'}</dd>
                </div>
              </dl>
            </section>

            <section
              className="public-description"
              aria-labelledby="description-title"
            >
              <h2 id="description-title">About this rental</h2>
              <p>{listing.description}</p>
            </section>

            <PublicApplicationQuestions listingId={listingId} />

            {listing.property.property_information_verified ? (
              <p className="public-trust-indicator">
                Property information verified by the platform. This is not a
                guarantee of tenancy or property condition.
              </p>
            ) : null}
            <p className="privacy-note">
              The exact address and landlord contact details remain private.
              Contact is handled through private platform conversations.
            </p>
          </article>
        ) : null}
      </main>
    </div>
  );
}
