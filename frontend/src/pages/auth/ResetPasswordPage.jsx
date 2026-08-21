import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AuthLayout from '../../components/auth/AuthLayout.jsx';
import FormField from '../../components/auth/FormField.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import {
  MIN_PASSWORD_LENGTH,
  validatePassword,
} from '../../utils/authValidation.js';

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const { client, onboardingRequired } = useAuth();
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    const errors = validatePassword(password, passwordConfirmation);
    setFieldErrors(errors);
    setMessage('');

    if (Object.keys(errors).length > 0) {
      return;
    }

    setSubmitting(true);

    try {
      const { error } = await client.auth.updateUser({ password });

      if (error) {
        setMessage(
          'Your password could not be updated. Request a new recovery link and try again.',
        );
        return;
      }

      navigate(onboardingRequired ? '/onboarding' : '/account', {
        replace: true,
      });
    } catch {
      setMessage(
        'Password reset is temporarily unavailable. Please try again.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout
      title="Choose a new password"
      intro="Your recovery session is active. Set a new password to continue."
    >
      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        <FormField
          id="new-password"
          label="New password"
          error={fieldErrors.password}
          hint={`Use at least ${MIN_PASSWORD_LENGTH} characters.`}
        >
          <input
            id="new-password"
            type="password"
            autoComplete="new-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            aria-invalid={Boolean(fieldErrors.password)}
            aria-describedby={
              fieldErrors.password ? 'new-password-error' : 'new-password-hint'
            }
          />
        </FormField>
        <FormField
          id="new-password-confirmation"
          label="Confirm new password"
          error={fieldErrors.passwordConfirmation}
        >
          <input
            id="new-password-confirmation"
            type="password"
            autoComplete="new-password"
            required
            value={passwordConfirmation}
            onChange={(event) => setPasswordConfirmation(event.target.value)}
            aria-invalid={Boolean(fieldErrors.passwordConfirmation)}
            aria-describedby={
              fieldErrors.passwordConfirmation
                ? 'new-password-confirmation-error'
                : undefined
            }
          />
        </FormField>
        {message ? (
          <p className="form-message" role="alert">
            {message}
          </p>
        ) : null}
        <button className="primary-button" type="submit" disabled={submitting}>
          {submitting ? 'Updating password…' : 'Update password'}
        </button>
      </form>
    </AuthLayout>
  );
}
