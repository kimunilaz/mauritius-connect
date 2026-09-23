export default function PageLoading({ message = 'Loading your page…' }) {
  return (
    <main className="page-loading" aria-busy="true">
      <div role="status">
        <span className="loading-indicator" aria-hidden="true" />
        <p>{message}</p>
      </div>
    </main>
  );
}
