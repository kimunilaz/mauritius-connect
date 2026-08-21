import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import FormField from '../../components/auth/FormField.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { ApiError } from '../../services/apiClient.js';
import {
  getLandlordProfile,
  updateLandlordProfile,
} from '../../services/roleProfileService.js';

function safeMessage(error, fallback) {
  if (error instanceof ApiError && error.fields) {
    return Object.values(error.fields).join(' ');
  }
  return error instanceof ApiError ? error.message : fallback;
}

const statusCopy = {
  UNVERIFIED: 'Verification has not been started.',
  PENDING: 'Verification is under review.',
  VERIFIED: 'Your landlord profile is verified.',
  REJECTED: 'Verification was not approved. Support can provide next steps.',
};

export default function LandlordProfilePage() {
  const { session, refreshProfile } = useAuth();
  const token = session.access_token;
  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    phone: '',
  });
  const [verificationStatus, setVerificationStatus] = useState('UNVERIFIED');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    let active = true;
    getLandlordProfile(token)
      .then((data) => {
        if (!active) return;
        setForm({
          first_name: data.first_name,
          last_name: data.last_name,
          phone: data.phone ?? '',
        });
        setVerificationStatus(data.verification_status);
      })
      .catch(
        (error) =>
          active &&
          setMessage(
            safeMessage(
              error,
              'The profile service is temporarily unavailable.',
            ),
          ),
      )
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [token]);

  function updateField(event) {
    setForm((current) => ({
      ...current,
      [event.target.name]: event.target.value,
    }));
  }

  async function submit(event) {
    event.preventDefault();
    setSubmitting(true);
    setMessage('');
    try {
      const updated = await updateLandlordProfile(token, {
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        phone: form.phone.trim() || null,
      });
      setForm({
        first_name: updated.first_name,
        last_name: updated.last_name,
        phone: updated.phone ?? '',
      });
      setVerificationStatus(updated.verification_status);
      await refreshProfile();
      setMessage('Landlord profile saved.');
    } catch (error) {
      setMessage(safeMessage(error, 'The profile could not be saved.'));
    } finally {
      setSubmitting(false);
    }
  }

  if (loading)
    return (
      <main className="profile-shell" aria-live="polite">
        Loading your landlord profile...
      </main>
    );

  return (
    <main className="profile-shell">
      <header className="profile-header">
        <div>
          <p className="eyebrow">Landlord profile</p>
          <h1>Your landlord details</h1>
        </div>
        <Link to="/account">Back to account</Link>
      </header>
      {message ? (
        <p className="form-message" role="status">
          {message}
        </p>
      ) : null}
      <section className="profile-section" aria-labelledby="verification-title">
        <h2 id="verification-title">Verification status</h2>
        <p>
          <strong>{verificationStatus}</strong>
        </p>
        <p>{statusCopy[verificationStatus]}</p>
        <p className="field-hint">
          This status is managed by the platform and cannot be changed from your
          profile.
        </p>
      </section>
      <section className="profile-section" aria-labelledby="details-title">
        <h2 id="details-title">Personal details</h2>
        <form className="profile-form" onSubmit={submit}>
          <FormField id="landlord-first-name" label="First name">
            <input
              id="landlord-first-name"
              name="first_name"
              required
              maxLength={100}
              value={form.first_name}
              onChange={updateField}
            />
          </FormField>
          <FormField id="landlord-last-name" label="Last name">
            <input
              id="landlord-last-name"
              name="last_name"
              required
              maxLength={100}
              value={form.last_name}
              onChange={updateField}
            />
          </FormField>
          <FormField id="landlord-phone" label="Phone (optional)">
            <input
              id="landlord-phone"
              name="phone"
              type="tel"
              maxLength={30}
              value={form.phone}
              onChange={updateField}
            />
          </FormField>
          <button className="primary-button" disabled={submitting}>
            Save landlord profile
          </button>
        </form>
      </section>
    </main>
  );
}
