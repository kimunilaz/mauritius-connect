import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import PropertyForm from '../../components/property/PropertyForm.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { ApiError } from '../../services/apiClient.js';
import { createProperty } from '../../services/propertyService.js';

export default function CreatePropertyPage() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});

  async function submit(property) {
    setSubmitting(true);
    setMessage('');
    setFieldErrors({});
    try {
      const created = await createProperty(session.access_token, property);
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
        Record the physical property now. Photos and rental listing details are
        added in later steps.
      </p>
      {message ? (
        <p className="form-message" role="alert">
          {message}
        </p>
      ) : null}
      <PropertyForm
        onSubmit={submit}
        submitting={submitting}
        submitLabel="Create property"
        serverErrors={fieldErrors}
      />
    </main>
  );
}
