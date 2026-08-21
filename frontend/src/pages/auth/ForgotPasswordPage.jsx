import { useState } from 'react';
import { Link } from 'react-router-dom';
import AuthLayout from '../../components/auth/AuthLayout.jsx';
import FormField from '../../components/auth/FormField.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { authRedirectUrl } from '../../utils/authValidation.js';

const neutralConfirmation =
  'If an account is associated with that email, check your inbox for password reset instructions.';

export default function ForgotPasswordPage() {
  const { client, configurationError } = useAuth();
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();

    if (!email.trim()) {
      setMessage('Enter your email address.');
      return;
    }

    if (!client) {
      setMessage(configurationError);
      return;
    }

    setSubmitting(true);

    try {
      await client.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: authRedirectUrl('/reset-password'),
      });
      setMessage(neutralConfirmation);
    } catch {
      setMessage('Password recovery is temporarily unavailable. Try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout
      title="Reset your password"
      intro="Enter your email to request secure password reset instructions."
      footer={<Link to="/login">Return to login</Link>}
    >
      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        <FormField id="recovery-email" label="Email">
          <input
            id="recovery-email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </FormField>
        {message ? (
          <p className="form-message" role="status">
            {message}
          </p>
        ) : null}
        <button className="primary-button" type="submit" disabled={submitting}>
          {submitting ? 'Sending instructions…' : 'Send reset instructions'}
        </button>
      </form>
    </AuthLayout>
  );
}
