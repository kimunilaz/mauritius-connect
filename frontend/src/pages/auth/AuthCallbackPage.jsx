import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import AuthLayout from '../../components/auth/AuthLayout.jsx';
import { useAuth } from '../../context/AuthContext.jsx';

const allowedNextPaths = new Set([
  '/account',
  '/onboarding',
  '/reset-password',
]);

export default function AuthCallbackPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { client, configurationError, establishSession } = useAuth();
  const [message, setMessage] = useState('Completing authentication…');

  useEffect(() => {
    let active = true;

    async function completeCallback() {
      if (!client) {
        setMessage(configurationError);
        return;
      }

      if (searchParams.has('error')) {
        setMessage(
          'The authentication link is invalid or expired. Request a new link and try again.',
        );
        return;
      }

      try {
        const code = searchParams.get('code');
        let session;

        if (code) {
          const { data, error } =
            await client.auth.exchangeCodeForSession(code);

          if (error) {
            throw error;
          }

          session = data.session;
        } else {
          const { data, error } = await client.auth.getSession();

          if (error) {
            throw error;
          }

          session = data.session;
        }

        if (!session) {
          throw new Error('No authenticated session was established.');
        }

        const result = await establishSession(session);

        if (!active) {
          return;
        }

        const requestedNext = searchParams.get('next');
        const destination = allowedNextPaths.has(requestedNext)
          ? requestedNext
          : result.onboardingRequired
            ? '/onboarding'
            : '/account';

        navigate(destination, { replace: true });
      } catch {
        if (active) {
          setMessage(
            'The authentication link is invalid or expired. Request a new link and try again.',
          );
        }
      }
    }

    void completeCallback();
    return () => {
      active = false;
    };
  }, [client, configurationError, establishSession, navigate, searchParams]);

  return (
    <AuthLayout title="Authentication">
      <p className="form-message" role="status">
        {message}
      </p>
    </AuthLayout>
  );
}
