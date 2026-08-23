import ApiStatus from '../../components/common/ApiStatus.jsx';
import PublicHeader from '../../components/public/PublicHeader.jsx';
import { Link } from 'react-router-dom';

export default function HomePage() {
  return (
    <div className="public-page">
      <PublicHeader />
      <main className="page-shell">
        <section className="bootstrap-card" aria-labelledby="page-title">
          <p className="eyebrow">Rent with clarity</p>
          <h1 id="page-title">Mauritius Rental Platform</h1>
          <p>Platform foundation is running.</p>
          <p>
            Explore active rental homes with practical filters and location
            privacy built in.
          </p>
          <nav className="auth-links" aria-label="Get started">
            <Link className="primary-link-button" to="/listings">
              Browse rentals
            </Link>
            <Link to="/register">Create account</Link>
            <Link to="/login">Log in</Link>
          </nav>
          <ApiStatus />
        </section>
      </main>
    </div>
  );
}
