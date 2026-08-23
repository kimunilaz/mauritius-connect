import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';

export default function PublicHeader() {
  const { isAuthenticated, profile } = useAuth();

  return (
    <header className="public-header">
      <Link className="public-brand" to="/">
        Mauritius Connect
      </Link>
      <nav className="public-navigation" aria-label="Main navigation">
        <Link to="/listings">Browse rentals</Link>
        {profile?.role === 'TENANT' ? (
          <Link to="/tenant/saved-listings">Saved rentals</Link>
        ) : null}
        {profile?.role === 'TENANT' || profile?.role === 'LANDLORD' ? (
          <Link to="/conversations">Conversations</Link>
        ) : null}
        <Link to={isAuthenticated ? '/account' : '/login'}>
          {isAuthenticated ? 'Account' : 'Log in'}
        </Link>
        {!isAuthenticated ? <Link to="/register">Create account</Link> : null}
      </nav>
    </header>
  );
}
