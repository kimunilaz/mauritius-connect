import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';

export default function AccountPage() {
  const navigate = useNavigate();
  const { profile, signOut } = useAuth();
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleLogout() {
    setSubmitting(true);
    setMessage('');

    try {
      await signOut();
      navigate('/login', { replace: true });
    } catch {
      setMessage('Logout could not be completed. Please try again.');
      setSubmitting(false);
    }
  }

  return (
    <main className="page-shell">
      <section className="account-card" aria-labelledby="account-title">
        <p className="eyebrow">Authenticated account</p>
        <h1 id="account-title">
          {profile.first_name} {profile.last_name}
        </h1>
        <dl className="account-summary">
          <div>
            <dt>Role</dt>
            <dd>
              {profile.role === 'TENANT'
                ? 'Tenant'
                : profile.role === 'LANDLORD'
                  ? 'Landlord'
                  : 'Admin'}
            </dd>
          </div>
          <div>
            <dt>Account status</dt>
            <dd>{profile.account_status}</dd>
          </div>
        </dl>
        <p>Manage the profile details used for your platform experience.</p>
        {profile.role === 'TENANT' ? (
          <div className="account-actions">
            <Link className="primary-link-button" to="/tenant/profile">
              Manage tenant profile
            </Link>
            <Link className="primary-link-button" to="/tenant/saved-listings">
              Saved rentals
            </Link>
            <Link className="primary-link-button" to="/tenant/applications">
              My applications
            </Link>
          </div>
        ) : null}
        {profile.role === 'LANDLORD' ? (
          <div className="account-actions">
            <Link className="primary-link-button" to="/landlord/profile">
              Manage landlord profile
            </Link>
            <Link className="primary-link-button" to="/landlord/properties">
              Manage properties
            </Link>
            <Link className="primary-link-button" to="/landlord/listings">
              Manage listings
            </Link>
          </div>
        ) : null}
        {message ? (
          <p className="form-message" role="alert">
            {message}
          </p>
        ) : null}
        <button
          className="secondary-button"
          type="button"
          onClick={handleLogout}
          disabled={submitting}
        >
          {submitting ? 'Logging out…' : 'Log out'}
        </button>
      </section>
    </main>
  );
}
