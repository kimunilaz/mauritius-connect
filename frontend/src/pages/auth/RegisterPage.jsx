import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AuthLayout from '../../components/auth/AuthLayout.jsx';
import FormField from '../../components/auth/FormField.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import {
  authRedirectUrl,
  MIN_PASSWORD_LENGTH,
  validatePassword,
} from '../../utils/authValidation.js';

export default function RegisterPage() {
  const navigate = useNavigate();
  const { client, configurationError, establishSession } = useAuth();
  const [form, setForm] = useState({
    email: '',
    password: '',
    passwordConfirmation: '',
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
    const errors = validatePassword(form.password, form.passwordConfirmation);

    if (!form.email.trim()) {
      errors.email = 'Enter your email address.';
    }

    setFieldErrors(errors);
    setMessage('');

    if (Object.keys(errors).length > 0) {
      return;
    }

    if (!client) {
      setMessage(configurationError);
      return;
    }

    setSubmitting(true);

    try {
      const { data, error } = await client.auth.signUp({
        email: form.email.trim(),
        password: form.password,
        options: { emailRedirectTo: authRedirectUrl() },
      });

      if (error) {
        setMessage(
          'Registration could not be completed. Check your details and try again.',
        );
        return;
      }

      if (!data.session) {
        setMessage('Check your email to confirm your account.');
        return;
      }

      const result = await establishSession(data.session);
      navigate(result.onboardingRequired ? '/onboarding' : '/account', {
        replace: true,
      });
    } catch {
      setMessage('Registration is temporarily unavailable. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout
      title="Create your account"
      intro="Register securely with your email. You will choose a tenant or landlord profile after authentication."
      footer={
        <p>
          Already registered? <Link to="/login">Log in</Link>
        </p>
      }
    >
      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        <FormField id="register-email" label="Email" error={fieldErrors.email}>
          <input
            id="register-email"
            name="email"
            type="email"
            autoComplete="email"
            required
            value={form.email}
            onChange={updateField}
            aria-invalid={Boolean(fieldErrors.email)}
            aria-describedby={
              fieldErrors.email ? 'register-email-error' : undefined
            }
          />
        </FormField>
        <FormField
          id="register-password"
          label="Password"
          error={fieldErrors.password}
          hint={`Use at least ${MIN_PASSWORD_LENGTH} characters.`}
        >
          <input
            id="register-password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            value={form.password}
            onChange={updateField}
            aria-invalid={Boolean(fieldErrors.password)}
            aria-describedby={
              fieldErrors.password
                ? 'register-password-error'
                : 'register-password-hint'
            }
          />
        </FormField>
        <FormField
          id="register-password-confirmation"
          label="Confirm password"
          error={fieldErrors.passwordConfirmation}
        >
          <input
            id="register-password-confirmation"
            name="passwordConfirmation"
            type="password"
            autoComplete="new-password"
            required
            value={form.passwordConfirmation}
            onChange={updateField}
            aria-invalid={Boolean(fieldErrors.passwordConfirmation)}
            aria-describedby={
              fieldErrors.passwordConfirmation
                ? 'register-password-confirmation-error'
                : undefined
            }
          />
        </FormField>
        {message ? (
          <p className="form-message" role="status">
            {message}
          </p>
        ) : null}
        <button className="primary-button" type="submit" disabled={submitting}>
          {submitting ? 'Creating account…' : 'Create account'}
        </button>
      </form>
    </AuthLayout>
  );
}
