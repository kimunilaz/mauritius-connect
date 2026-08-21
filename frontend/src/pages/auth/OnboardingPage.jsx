import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AuthLayout from '../../components/auth/AuthLayout.jsx';
import FormField from '../../components/auth/FormField.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { ApiError } from '../../services/apiClient.js';
import { registerApplicationProfile } from '../../services/profileService.js';

export default function OnboardingPage() {
  const navigate = useNavigate();
  const { refreshProfile, session } = useAuth();
  const [form, setForm] = useState({
    role: 'TENANT',
    first_name: '',
    last_name: '',
    phone: '',
  });
  const [fieldErrors, setFieldErrors] = useState({});
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  function updateField(event) {
    setForm((current) => ({
      ...current,
      [event.target.name]: event.target.value,
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const errors = {};

    if (!form.first_name.trim()) {
      errors.first_name = 'Enter your first name.';
    }

    if (!form.last_name.trim()) {
      errors.last_name = 'Enter your last name.';
    }

    setFieldErrors(errors);
    setMessage('');

    if (Object.keys(errors).length > 0) {
      return;
    }

    setSubmitting(true);

    try {
      await registerApplicationProfile(session.access_token, {
        role: form.role,
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        ...(form.phone.trim() ? { phone: form.phone.trim() } : {}),
      });
      await refreshProfile();
      navigate('/account', { replace: true });
    } catch (error) {
      if (error instanceof ApiError) {
        setFieldErrors(error.fields ?? {});
        setMessage(error.message);
      } else {
        setMessage('Profile onboarding is temporarily unavailable. Try again.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout
      title="Complete your profile"
      intro="Choose how you will use the platform. Detailed rental profiles come later."
    >
      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        <fieldset className="role-options">
          <legend>I am joining as</legend>
          <label>
            <input
              type="radio"
              name="role"
              value="TENANT"
              checked={form.role === 'TENANT'}
              onChange={updateField}
            />
            Tenant
          </label>
          <label>
            <input
              type="radio"
              name="role"
              value="LANDLORD"
              checked={form.role === 'LANDLORD'}
              onChange={updateField}
            />
            Landlord
          </label>
        </fieldset>
        <FormField
          id="onboarding-first-name"
          label="First name"
          error={fieldErrors.first_name}
        >
          <input
            id="onboarding-first-name"
            name="first_name"
            type="text"
            autoComplete="given-name"
            maxLength={100}
            required
            value={form.first_name}
            onChange={updateField}
            aria-invalid={Boolean(fieldErrors.first_name)}
            aria-describedby={
              fieldErrors.first_name ? 'onboarding-first-name-error' : undefined
            }
          />
        </FormField>
        <FormField
          id="onboarding-last-name"
          label="Last name"
          error={fieldErrors.last_name}
        >
          <input
            id="onboarding-last-name"
            name="last_name"
            type="text"
            autoComplete="family-name"
            maxLength={100}
            required
            value={form.last_name}
            onChange={updateField}
            aria-invalid={Boolean(fieldErrors.last_name)}
            aria-describedby={
              fieldErrors.last_name ? 'onboarding-last-name-error' : undefined
            }
          />
        </FormField>
        <FormField
          id="onboarding-phone"
          label="Phone (optional)"
          error={fieldErrors.phone}
        >
          <input
            id="onboarding-phone"
            name="phone"
            type="tel"
            autoComplete="tel"
            maxLength={30}
            value={form.phone}
            onChange={updateField}
            aria-invalid={Boolean(fieldErrors.phone)}
            aria-describedby={
              fieldErrors.phone ? 'onboarding-phone-error' : undefined
            }
          />
        </FormField>
        {message ? (
          <p className="form-message" role="alert">
            {message}
          </p>
        ) : null}
        <button className="primary-button" type="submit" disabled={submitting}>
          {submitting ? 'Saving profile…' : 'Continue'}
        </button>
      </form>
    </AuthLayout>
  );
}
