import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import ListingForm from '../../components/listing/ListingForm.jsx';
import ApplicationQuestionManager from '../../components/listing/ApplicationQuestionManager.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { ApiError } from '../../services/apiClient.js';
import {
  activateListing,
  closeListing,
  getLandlordListing,
  pauseListing,
  publishListing,
  updateListing,
} from '../../services/listingService.js';
import { formatRent, listingStatusLabel } from '../../utils/listing.js';

const readinessMessages = {
  PROPERTY_ARCHIVED: 'Use a non-archived property.',
  TITLE_INVALID: 'Enter a valid title.',
  DESCRIPTION_INVALID: 'Enter a valid description.',
  MONTHLY_RENT_REQUIRED: 'Enter a monthly rent greater than zero.',
  DEPOSIT_INVALID: 'Enter a valid deposit amount.',
  AVAILABLE_FROM_INVALID: 'Choose a valid availability date.',
  MINIMUM_LEASE_INVALID: 'Enter a valid minimum lease duration.',
  MAXIMUM_OCCUPANTS_INVALID: 'Enter a valid maximum occupant count.',
  PROPERTY_IMAGE_REQUIRED: 'Add at least one property photo.',
  COVER_IMAGE_REQUIRED: 'Set a cover photo.',
};

export default function ListingDetailPage() {
  const { listingId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const { session } = useAuth();
  const token = session.access_token;
  const [listing, setListing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [readiness, setReadiness] = useState([]);
  const [fieldErrors, setFieldErrors] = useState({});
  const editable = ['DRAFT', 'PAUSED'].includes(listing?.status);
  const editing = searchParams.get('edit') === 'true' && editable;
  const knownReadiness =
    readiness.length > 0
      ? readiness
      : listing?.status === 'DRAFT'
        ? [
            ...(listing.property.archived_at ? ['PROPERTY_ARCHIVED'] : []),
            ...(!listing.images?.length ? ['PROPERTY_IMAGE_REQUIRED'] : []),
            ...(!listing.images?.some((image) => image.is_cover)
              ? ['COVER_IMAGE_REQUIRED']
              : []),
          ]
        : [];

  useEffect(() => {
    let active = true;
    getLandlordListing(token, listingId)
      .then((data) => active && setListing(data))
      .catch(
        (error) =>
          active &&
          setMessage(
            error instanceof ApiError
              ? error.message
              : "We couldn't load this listing. Try again.",
          ),
      )
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [listingId, token]);

  function preserveDetail(updated) {
    setListing((current) => ({
      ...updated,
      images: current?.images ?? [],
    }));
  }

  async function save(fields) {
    setSubmitting(true);
    setMessage('');
    setFieldErrors({});
    try {
      preserveDetail(await updateListing(token, listingId, fields));
      setSearchParams({});
      setMessage('Listing details saved.');
    } catch (error) {
      setMessage(
        error instanceof ApiError
          ? error.message
          : 'The listing could not be saved.',
      );
      setFieldErrors(error instanceof ApiError ? (error.fields ?? {}) : {});
    } finally {
      setSubmitting(false);
    }
  }

  async function action(name, operation) {
    if (name === 'close') {
      const confirmed = globalThis.confirm(
        'Close this listing? It will no longer continue through the rental workflow. The underlying property will remain available for future listings.',
      );
      if (!confirmed) return;
    }
    setSubmitting(true);
    setMessage('');
    setReadiness([]);
    try {
      preserveDetail(await operation(token, listingId));
      setSearchParams({});
      setMessage(
        name === 'publish'
          ? 'Listing submitted for review. It is not publicly active yet.'
          : name === 'pause'
            ? 'Listing paused.'
            : name === 'activate'
              ? 'Listing activated.'
              : 'Listing closed. The property was not archived.',
      );
    } catch (error) {
      setMessage(
        error instanceof ApiError
          ? error.message
          : 'The listing action could not be completed.',
      );
      setReadiness(
        error instanceof ApiError ? (error.fields?.readiness ?? []) : [],
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (loading)
    return (
      <main className="management-shell" aria-live="polite">
        Loading listing...
      </main>
    );
  if (!listing)
    return (
      <main className="management-shell">
        <h1>Listing unavailable</h1>
        <p role="alert">{message}</p>
        <Link to="/landlord/listings">Back to listings</Link>
      </main>
    );

  return (
    <main className="management-shell">
      <header className="profile-header">
        <div>
          <p className="eyebrow">Listing management</p>
          <h1>{listing.title}</h1>
        </div>
        <Link to="/landlord/listings">Back to listings</Link>
      </header>
      <p className="status-label">
        Status: {listingStatusLabel(listing.status)}
      </p>
      {message ? (
        <p className="form-message" role="status">
          {message}
        </p>
      ) : null}
      {knownReadiness.length ? (
        <section className="readiness-panel" aria-labelledby="readiness-title">
          <h2 id="readiness-title">Before submitting</h2>
          <ul>
            {knownReadiness.map((reason) => (
              <li key={reason}>
                {readinessMessages[reason] ?? 'Review this listing.'}
              </li>
            ))}
          </ul>
          {knownReadiness.some((reason) =>
            ['PROPERTY_IMAGE_REQUIRED', 'COVER_IMAGE_REQUIRED'].includes(
              reason,
            ),
          ) ? (
            <Link to={`/landlord/properties/${listing.property_id}`}>
              Manage property photos
            </Link>
          ) : null}
        </section>
      ) : null}
      {editing ? (
        <ListingForm
          initialListing={listing}
          onSubmit={save}
          submitting={submitting}
          submitLabel="Save listing"
          serverErrors={fieldErrors}
        />
      ) : (
        <>
          <section className="listing-detail">
            {listing.images?.length ? (
              <div className="listing-detail-images">
                {listing.images.map((image, index) => (
                  <img
                    key={image.id}
                    src={image.url}
                    alt={`Property photo ${index + 1}${image.is_cover ? ' (cover)' : ''}`}
                  />
                ))}
              </div>
            ) : (
              <p className="privacy-note">
                No property photos have been added.
              </p>
            )}
            <h2>Rental details</h2>
            <p>{listing.description}</p>
            <dl>
              <div>
                <dt>Monthly rent</dt>
                <dd>{formatRent(listing.monthly_rent)}</dd>
              </div>
              <div>
                <dt>Deposit</dt>
                <dd>
                  {listing.deposit_amount === null
                    ? 'Not specified'
                    : `Rs ${listing.deposit_amount}`}
                </dd>
              </div>
              <div>
                <dt>Available from</dt>
                <dd>{listing.available_from}</dd>
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
              <div>
                <dt>Pets allowed</dt>
                <dd>{listing.pets_allowed ? 'Yes' : 'No'}</dd>
              </div>
            </dl>
            <h2>Property</h2>
            <p>
              {listing.property.locality}, {listing.property.district} ·{' '}
              {listing.property.bedrooms} bedrooms ·{' '}
              {listing.property.bathrooms} bathrooms
            </p>
            <Link to={`/landlord/properties/${listing.property_id}`}>
              View property
            </Link>
          </section>
          <section className="listing-actions" aria-label="Listing actions">
            <Link
              className="primary-link-button"
              to={`/landlord/listings/${listingId}/applications`}
            >
              View applications
            </Link>
            {editable ? (
              <button
                className="primary-button"
                type="button"
                disabled={submitting}
                onClick={() => setSearchParams({ edit: 'true' })}
              >
                Edit listing
              </button>
            ) : null}
            {listing.status === 'DRAFT' ? (
              <button
                className="primary-button"
                type="button"
                disabled={submitting}
                onClick={() => action('publish', publishListing)}
              >
                Submit for review
              </button>
            ) : null}
            {listing.status === 'ACTIVE' ? (
              <button
                className="secondary-button"
                type="button"
                disabled={submitting}
                onClick={() => action('pause', pauseListing)}
              >
                Pause listing
              </button>
            ) : null}
            {listing.status === 'PAUSED' ? (
              <button
                className="primary-button"
                type="button"
                disabled={submitting}
                onClick={() => action('activate', activateListing)}
              >
                Activate listing
              </button>
            ) : null}
            {['DRAFT', 'PENDING_REVIEW', 'ACTIVE', 'PAUSED'].includes(
              listing.status,
            ) ? (
              <button
                className="danger-button"
                type="button"
                disabled={submitting}
                onClick={() => action('close', closeListing)}
              >
                Close listing
              </button>
            ) : null}
          </section>
          {listing.status === 'DRAFT' ? (
            <p className="privacy-note">
              Submit for review sends this draft to the future moderation
              workflow. It will not become publicly active immediately.
            </p>
          ) : null}
          {listing.status === 'ACTIVE' ? (
            <p className="privacy-note">
              Pause the listing before editing it. Pausing does not close the
              listing.
            </p>
          ) : null}
        </>
      )}
      <ApplicationQuestionManager listingId={listingId} token={token} />
    </main>
  );
}
