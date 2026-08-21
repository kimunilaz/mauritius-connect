import ApiStatus from '../../components/common/ApiStatus.jsx';
import { Link } from 'react-router-dom';

export default function HomePage() {
  return (
    <main className="page-shell">
      <section className="bootstrap-card" aria-labelledby="page-title">
        <h1 id="page-title">Mauritius Rental Platform</h1>
        <p>Platform foundation is running.</p>
        <nav className="auth-links" aria-label="Account">
          <Link to="/register">Create account</Link>
          <Link to="/login">Log in</Link>
        </nav>
        <ApiStatus />
      </section>
    </main>
  );
}
