import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import ListingForm from '../../components/listing/ListingForm.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { ApiError } from '../../services/apiClient.js';
import { createListing } from '../../services/listingService.js';
import { listLandlordProperties } from '../../services/propertyService.js';

export default function CreateListingPage() {
  const { session } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = session.access_token;
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const selectedPropertyId = searchParams.get('propertyId') ?? '';

  useEffect(() => {
    let active = true;
    listLandlordProperties(token, { page: 1, limit: 100, archived: false })
      .then((result) => active && setProperties(result.properties))
      .catch(
        (error) =>
          active &&
          setMessage(
            error instanceof ApiError
              ? error.message
              : "We couldn't load your properties. Try again.",
          ),
      )
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [token]);

  async function save(fields) {
    setSubmitting(true);
    setMessage('');
    setFieldErrors({});
    try {
      const listing = await createListing(token, fields);
      navigate(`/landlord/listings/${listing.id}`, { replace: true });
    } catch (error) {
      setMessage(
        error instanceof ApiError
          ? error.message
          : 'The listing could not be created.',
      );
      setFieldErrors(error instanceof ApiError ? (error.fields ?? {}) : {});
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="management-shell">
      <header className="profile-header">
        <div>
          <p className="eyebrow">Listing management</p>
          <h1>Create a draft listing</h1>
        </div>
        <Link to="/landlord/listings">Back to listings</Link>
      </header>
      <p>
        Save the rental-cycle details as a private draft. Submitting for review
        is a separate action.
      </p>
      {message ? (
        <p className="form-message" role="alert">
          {message}
        </p>
      ) : null}
      {loading ? <p aria-live="polite">Loading properties...</p> : null}
      {!loading && properties.length === 0 ? (
        <section className="empty-state">
          <h2>Add an active property first</h2>
          <p>A listing must belong to one of your non-archived properties.</p>
          <Link className="primary-link-button" to="/landlord/properties/new">
            Add property
          </Link>
        </section>
      ) : null}
      {!loading && properties.length > 0 ? (
        <ListingForm
          selectedPropertyId={selectedPropertyId}
          properties={properties}
          onSubmit={save}
          submitting={submitting}
          submitLabel="Save draft"
          serverErrors={fieldErrors}
        />
      ) : null}
    </main>
  );
}
