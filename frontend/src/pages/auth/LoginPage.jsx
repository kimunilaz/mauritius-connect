import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AuthLayout from '../../components/auth/AuthLayout.jsx';
import FormField from '../../components/auth/FormField.jsx';
import { useAuth } from '../../context/AuthContext.jsx';

export default function LoginPage() {
  const navigate = useNavigate();
  const { client, configurationError, establishSession } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setMessage('');

    if (!email.trim() || !password) {
      setMessage('Enter your email and password.');
      return;
    }

    if (!client) {
      setMessage(configurationError);
      return;
    }

    setSubmitting(true);

    try {
      const { data, error } = await client.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error || !data.session) {
        setMessage(
          'Email or password is incorrect, or the account is not ready.',
        );
        return;
      }

      const result = await establishSession(data.session);
      navigate(result.onboardingRequired ? '/onboarding' : '/account', {
        replace: true,
      });
    } catch {
      setMessage('Login is temporarily unavailable. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout
      title="Log in"
      intro="Use the email and password managed by Supabase Auth."
      footer={
        <p>
          Need an account? <Link to="/register">Sign up</Link>
        </p>
      }
    >
      <h2>Welcome back</h2>
      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        <FormField id="login-email" label="Email">
          <input
            id="login-email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </FormField>
        <FormField id="login-password" label="Password">
          <input
            id="login-password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </FormField>
        <div className="form-link-row">
          <Link to="/forgot-password">Forgot password?</Link>
        </div>
        {message ? (
          <p className="form-message" role="alert">
            {message}
          </p>
        ) : null}
        <button className="primary-button" type="submit" disabled={submitting}>
          {submitting ? 'Logging in…' : 'Log in'}
        </button>
      </form>
    </AuthLayout>
  );
}
