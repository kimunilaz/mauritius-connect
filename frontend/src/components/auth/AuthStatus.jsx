import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import PageLoading from '../common/PageLoading.jsx';

export function AuthLoading() {
  return <PageLoading message="Loading your account…" />;
}

export function AccountUnavailable({ message }) {
  const { refreshProfile, signOut } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [recoveryError, setRecoveryError] = useState('');
  async function returnToLogin() {
    setBusy(true);
    setRecoveryError('');
    try {
      await signOut();
      navigate('/login', { replace: true });
    } catch {
      setRecoveryError('We couldn’t end this session. Please try again.');
      setBusy(false);
    }
  }
  return (
    <main className="page-shell">
      <section className="auth-card" role="alert">
        <h1>Account unavailable</h1>
        <p>{message ?? 'This account cannot access the platform right now.'}</p>
        <div className="card-actions">
          <button
            className="primary-button"
            onClick={refreshProfile}
            disabled={busy}
          >
            Try again
          </button>
          <button
            className="secondary-button"
            onClick={returnToLogin}
            disabled={busy}
          >
            {busy ? 'Returning to login…' : 'Return to login'}
          </button>
        </div>
        {recoveryError ? <p role="status">{recoveryError}</p> : null}
      </section>
    </main>
  );
}
