import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { ApiError } from '../../services/apiClient.js';
import {
  archiveProperty,
  listLandlordProperties,
} from '../../services/propertyService.js';

const typeLabel = (value) =>
  value
    .toLowerCase()
    .replaceAll('_', ' ')
    .replace(/^./, (letter) => letter.toUpperCase());

export default function PropertyListPage() {
  const { session } = useAuth();
  const token = session.access_token;
  const [properties, setProperties] = useState([]);
  const [meta, setMeta] = useState({
    page: 1,
    limit: 20,
    total: 0,
    total_pages: 0,
  });
  const [archived, setArchived] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  const load = useCallback(
    async (page, showArchived) => {
      setLoading(true);
      setMessage('');
      try {
        const result = await listLandlordProperties(token, {
          page,
          archived: showArchived,
        });
        setProperties(result.properties);
        setMeta(result.meta);
      } catch (error) {
        setMessage(
          error instanceof ApiError
            ? error.message
            : "We couldn't load your properties. Try again.",
        );
      } finally {
        setLoading(false);
      }
    },
    [token],
  );

  useEffect(() => {
    void load(1, archived);
  }, [archived, load]);

  function switchArchive(showArchived) {
    setArchived(showArchived);
  }

  async function archive(property) {
    if (
      !globalThis.confirm(
        'Archive this property? It will no longer appear in your active property list.',
      )
    )
      return;
    try {
      await archiveProperty(token, property.id);
      setProperties((current) =>
        current.filter((item) => item.id !== property.id),
      );
      setMeta((current) => ({
        ...current,
        total: Math.max(0, current.total - 1),
      }));
      setMessage('Property archived.');
    } catch (error) {
      setMessage(
        error instanceof ApiError
          ? error.message
          : 'The property could not be archived.',
      );
    }
  }

  return (
    <main className="management-shell">
      <header className="profile-header">
        <div>
          <p className="eyebrow">Landlord</p>
          <h1>Your properties</h1>
        </div>
        <Link className="primary-link-button" to="/landlord/properties/new">
          Add property
        </Link>
      </header>
      <div className="filter-tabs" aria-label="Property archive filter">
        <button
          type="button"
          aria-pressed={!archived}
          onClick={() => switchArchive(false)}
        >
          Active
        </button>
        <button
          type="button"
          aria-pressed={archived}
          onClick={() => switchArchive(true)}
        >
          Archived
        </button>
      </div>
      {message ? (
        <p className="form-message" role="status">
          {message}
        </p>
      ) : null}
      {loading ? <p aria-live="polite">Loading properties...</p> : null}
      {!loading && message && properties.length === 0 ? (
        <button
          className="secondary-button"
          type="button"
          onClick={() => load(meta.page, archived)}
        >
          Try again
        </button>
      ) : null}
      {!loading && !message && properties.length === 0 ? (
        <section className="empty-state">
          <h2>{archived ? 'No archived properties' : 'No properties yet'}</h2>
          <p>
            {archived
              ? 'Archived properties will appear here.'
              : 'Add your first property to prepare it for a future rental listing.'}
          </p>
          {!archived ? (
            <Link className="primary-link-button" to="/landlord/properties/new">
              Add property
            </Link>
          ) : null}
        </section>
      ) : null}
      <ul className="property-grid">
        {properties.map((property) => (
          <li className="property-card" key={property.id}>
            <p className="eyebrow">{typeLabel(property.property_type)}</p>
            <h2>
              {property.locality}, {property.district}
            </h2>
            <dl>
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
            </dl>
            <div className="card-actions">
              <Link to={`/landlord/properties/${property.id}`}>View</Link>
              {!property.archived_at ? (
                <>
                  <Link to={`/landlord/properties/${property.id}?edit=true`}>
                    Edit
                  </Link>
                  <button
                    className="text-button"
                    type="button"
                    onClick={() => archive(property)}
                  >
                    Archive
                  </button>
                </>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
      {meta.total_pages > 1 ? (
        <nav className="pagination" aria-label="Property pages">
          <button
            type="button"
            disabled={meta.page <= 1 || loading}
            onClick={() => load(meta.page - 1, archived)}
          >
            Previous
          </button>
          <span>
            Page {meta.page} of {meta.total_pages}
          </span>
          <button
            type="button"
            disabled={meta.page >= meta.total_pages || loading}
            onClick={() => load(meta.page + 1, archived)}
          >
            Next
          </button>
        </nav>
      ) : null}
    </main>
  );
}
