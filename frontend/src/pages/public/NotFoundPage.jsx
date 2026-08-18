import { Link } from 'react-router-dom';

export default function NotFoundPage() {
  return (
    <main className="page-shell">
      <section className="bootstrap-card" aria-labelledby="not-found-title">
        <h1 id="not-found-title">Page not found</h1>
        <p>The requested page does not exist.</p>
        <Link to="/">Return to the platform foundation</Link>
      </section>
    </main>
  );
}
