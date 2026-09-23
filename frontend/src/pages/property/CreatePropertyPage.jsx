import OwnerSelector from '../agent/OwnerSelector.jsx';
import { OwnerForm } from '../agent/OwnersPage.jsx';
import { ownerRequest } from '../../services/managedOwnerService.js';
import { useSearchParams } from 'react-router-dom';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import PropertyForm from '../../components/property/PropertyForm.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { ApiError } from '../../services/apiClient.js';
import { createProperty } from '../../services/propertyService.js';

export default function CreatePropertyPage() {
  const { session, profile } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [ownerId, setOwnerId] = useState(params.get('owner_id') ?? '');
  const [newOwner, setNewOwner] = useState(false);
  const [ownerRevision, setOwnerRevision] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});

  async function submit(property) {
    if (profile.role === 'AGENT' && !ownerId) {
      setMessage('Select or create a property owner.');
      return;
    }
    setSubmitting(true);
    setMessage('');
    setFieldErrors({});
    try {
      const created = await createProperty(session.access_token, {
        ...property,
        ...(profile.role === 'AGENT' ? { managed_owner_id: ownerId } : {}),
      });
      navigate(`/landlord/properties/${created.id}`, { replace: true });
    } catch (error) {
      setMessage(
        error instanceof ApiError
          ? error.message
          : 'The property could not be created. Your entries have been kept.',
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
          <p className="eyebrow">Property management</p>
          <h1>Add a property</h1>
        </div>
        <Link to="/landlord/properties">Back to properties</Link>
      </header>

      <p>
        Add the property whether it is vacant or already occupied. You can then
        add an existing tenancy, keep operational records, or prepare a listing.
      </p>
      {message ? (
        <p className="form-message" role="alert">
          {message}
        </p>
      ) : null}
      {profile.role === 'AGENT' && (
        <section className="operation-panel">
          <h2>Recorded property owner</h2>
          <OwnerSelector
            key={ownerRevision}
            value={ownerId}
            onChange={setOwnerId}
            required
          />
          <button type="button" onClick={() => setNewOwner(true)}>
            Create an owner
          </button>
          {newOwner && (
            <OwnerForm
              onCancel={() => setNewOwner(false)}
              onSave={async (fields) => {
                const o = await ownerRequest(session.access_token, '', {
                  method: 'POST',
                  body: fields,
                });
                setOwnerId(o.id);
                setOwnerRevision((v) => v + 1);
                setNewOwner(false);
              }}
            />
          )}
        </section>
      )}
      <PropertyForm
        onSubmit={submit}
        submitting={submitting}
        submitLabel="Create property"
        serverErrors={fieldErrors}
      />
    </main>
  );
}
