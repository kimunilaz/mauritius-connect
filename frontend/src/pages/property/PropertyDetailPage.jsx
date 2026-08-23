import { useEffect, useState } from 'react';
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from 'react-router-dom';
import PropertyForm from '../../components/property/PropertyForm.jsx';
import PropertyImageManager from '../../components/property/PropertyImageManager.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { ApiError } from '../../services/apiClient.js';
import {
  archiveProperty,
  getProperty,
  updateProperty,
} from '../../services/propertyService.js';

const display = (value) => value ?? 'Not provided';
const enumLabel = (value) =>
  value
    .toLowerCase()
    .replaceAll('_', ' ')
    .replace(/^./, (letter) => letter.toUpperCase());

export default function PropertyDetailPage() {
  const { propertyId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { session } = useAuth();
  const token = session.access_token;
  const [property, setProperty] = useState(null);
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const editing = searchParams.get('edit') === 'true' && !property?.archived_at;

  useEffect(() => {
    let active = true;
    getProperty(token, propertyId)
      .then((data) => {
        if (active) {
          setProperty(data);
          setImages(data.images ?? []);
        }
      })
      .catch(
        (error) =>
          active &&
          setMessage(
            error instanceof ApiError
              ? error.message
              : "We couldn't load this property. Try again.",
          ),
      )
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [propertyId, token]);

  async function save(fields) {
    setSubmitting(true);
    setMessage('');
    setFieldErrors({});
    try {
      const updated = await updateProperty(token, propertyId, fields);
      setProperty(updated);
      setSearchParams({});
      setMessage('Property details saved.');
    } catch (error) {
      setMessage(
        error instanceof ApiError
          ? error.message
          : 'The property could not be saved.',
      );
      setFieldErrors(error instanceof ApiError ? (error.fields ?? {}) : {});
    } finally {
      setSubmitting(false);
    }
  }

  async function archive() {
    if (
      !globalThis.confirm(
        'Archive this property? It will no longer appear in your active property list.',
      )
    )
      return;
    setSubmitting(true);
    try {
      const archived = await archiveProperty(token, propertyId);
      setProperty(archived);
      setSearchParams({});
      setMessage('Property archived.');
    } catch (error) {
      setMessage(
        error instanceof ApiError
          ? error.message
          : 'The property could not be archived.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (loading)
    return (
      <main className="management-shell" aria-live="polite">
        Loading property...
      </main>
    );
  if (!property)
    return (
      <main className="management-shell">
        <h1>Property unavailable</h1>
        <p role="alert">{message}</p>
        <button
          className="secondary-button"
          type="button"
          onClick={() => navigate('/landlord/properties')}
        >
          Back to properties
        </button>
      </main>
    );

  return (
    <main className="management-shell">
      <header className="profile-header">
        <div>
          <p className="eyebrow">Property management</p>
          <h1>
            {property.locality}, {property.district}
          </h1>
        </div>
        <Link to="/landlord/properties">Back to properties</Link>
      </header>
      {message ? (
        <p className="form-message" role="status">
          {message}
        </p>
      ) : null}
      {editing ? (
        <PropertyForm
          initialProperty={property}
          onSubmit={save}
          submitting={submitting}
          submitLabel="Save property"
          serverErrors={fieldErrors}
        />
      ) : (
        <>
          <section className="property-detail">
            <p>
              <strong>
                Property verification: {enumLabel(property.verification_status)}
              </strong>
            </p>
            {property.archived_at ? (
              <p className="archive-badge">Archived</p>
            ) : null}
            <dl>
              <div>
                <dt>Property type</dt>
                <dd>{enumLabel(property.property_type)}</dd>
              </div>
              <div>
                <dt>Address</dt>
                <dd>
                  {[property.address_line_1, property.address_line_2]
                    .filter(Boolean)
                    .join(', ') || 'Not provided'}
                </dd>
              </div>
              <div>
                <dt>District</dt>
                <dd>{property.district}</dd>
              </div>
              <div>
                <dt>Locality</dt>
                <dd>{property.locality}</dd>
              </div>
              <div>
                <dt>Neighbourhood</dt>
                <dd>{display(property.neighbourhood)}</dd>
              </div>
              <div>
                <dt>Coordinates</dt>
                <dd>
                  {[property.latitude, property.longitude]
                    .filter((value) => value !== null)
                    .join(', ') || 'Not provided'}
                </dd>
              </div>
              <div>
                <dt>Bedrooms</dt>
                <dd>{property.bedrooms}</dd>
              </div>
              <div>
                <dt>Bathrooms</dt>
                <dd>{property.bathrooms}</dd>
              </div>
              <div>
                <dt>Furnished</dt>
                <dd>{property.furnished ? 'Yes' : 'No'}</dd>
              </div>
              <div>
                <dt>Parking spaces</dt>
                <dd>{property.parking_spaces}</dd>
              </div>
            </dl>
            {!property.archived_at ? (
              <div className="card-actions">
                <button
                  className="primary-button"
                  type="button"
                  onClick={() => setSearchParams({ edit: 'true' })}
                >
                  Edit property
                </button>
                <button
                  className="danger-button"
                  type="button"
                  disabled={submitting}
                  onClick={archive}
                >
                  Archive property
                </button>
                <Link
                  className="primary-link-button"
                  to={`/landlord/listings/new?propertyId=${property.id}`}
                >
                  Create listing
                </Link>
              </div>
            ) : null}
          </section>
          <PropertyImageManager
            accessToken={token}
            propertyId={propertyId}
            images={images}
            archived={Boolean(property.archived_at)}
            onChange={setImages}
          />
        </>
      )}
    </main>
  );
}
