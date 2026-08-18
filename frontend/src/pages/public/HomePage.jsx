import ApiStatus from '../../components/common/ApiStatus.jsx';

export default function HomePage() {
  return (
    <main className="page-shell">
      <section className="bootstrap-card" aria-labelledby="page-title">
        <h1 id="page-title">Mauritius Rental Platform</h1>
        <p>Platform foundation is running.</p>
        <ApiStatus />
      </section>
    </main>
  );
}
