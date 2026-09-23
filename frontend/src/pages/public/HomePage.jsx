import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import RentalSearchForm from '../../components/public/RentalSearchForm.jsx';
import PublicHeader from '../../components/public/PublicHeader.jsx';
import PublicListingCard from '../../components/public/PublicListingCard.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import Brand from '../../components/common/Brand.jsx';
import { listPublicListings } from '../../services/listingService.js';
import '../../marketplace.css';

const areas = [
  'Quatre Bornes',
  'Rose Hill',
  'Moka',
  'Ebene',
  'Vacoas',
  'Curepipe',
];
const sections = [
  {
    title: 'Homes available now',
    filters: [{ limit: 4, sort: 'newest' }],
    href: '/listings',
  },
];

function InventorySection({ section, first = false }) {
  const [state, setState] = useState({
    loading: true,
    listings: [],
    error: false,
  });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setState({ loading: true, listings: [], error: false });
    Promise.all(
      section.filters.map((filters) =>
        listPublicListings(filters, { signal: controller.signal }),
      ),
    )
      .then((results) => {
        if (!controller.signal.aborted)
          setState({
            loading: false,
            error: false,
            listings: [
              ...new Map(
                results
                  .flatMap((result) => result.listings)
                  .map((listing) => [listing.id, listing]),
              ).values(),
            ],
          });
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setState({ loading: false, listings: [], error: true });
      });
    return () => controller.abort();
  }, [section, attempt]);
  return (
    <section className="marketplace-section" aria-label={section.title}>
      <div className="marketplace-section-heading">
        <h2>{section.title}</h2>
        <Link to={section.href}>
          See all rentals <span aria-hidden="true">→</span>
        </Link>
      </div>
      {state.loading ? (
        <div className="inventory-loading" aria-busy="true">
          <p role="status">Loading available homes…</p>
          <div className="marketplace-grid" aria-hidden="true">
            {Array.from({ length: 4 }, (_, index) => (
              <div className="listing-skeleton" key={index}>
                <div className="listing-skeleton-image" />
                <div className="listing-skeleton-body">
                  <span />
                  <span />
                  <span />
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : state.error ? (
        <div role="alert">
          <p>We couldn’t load these rentals.</p>
          <button
            className="secondary-button"
            onClick={() => setAttempt((value) => value + 1)}
          >
            Try again
          </button>
        </div>
      ) : state.listings.length ? (
        <div className="marketplace-grid">
          {state.listings.map((listing, index) => (
            <PublicListingCard
              key={listing.id}
              listing={listing}
              compact
              eager={first && index < 4}
            />
          ))}
        </div>
      ) : (
        <p>
          No homes available in this selection yet.{' '}
          <Link to="/listings">Browse all rentals</Link>
        </p>
      )}
    </section>
  );
}

export default function HomePage() {
  const navigate = useNavigate();
  const { isAuthenticated, profile } = useAuth();
  const landlordHref = !isAuthenticated
    ? '/register'
    : ['LANDLORD', 'AGENT'].includes(profile?.role)
      ? '/landlord/properties'
      : '/account';
  function search(event) {
    event.preventDefault();
    const query = new globalThis.URLSearchParams();
    for (const [key, value] of new globalThis.FormData(event.currentTarget)) {
      if (value.trim()) query.set(key, value.trim());
    }
    navigate(`/listings${query.size ? `?${query}` : ''}`);
  }
  return (
    <div className="public-page marketplace-page">
      <PublicHeader />
      <main className="marketplace-main">
        <section className="owner-hero" aria-labelledby="owner-title">
          <div className="owner-hero-copy">
            <p className="eyebrow">
              FOR PROPERTY OWNERS AND AGENCIES IN MAURITIUS
            </p>
            <h1 id="owner-title">
              Manage your properties <span>with clarity.</span>
            </h1>
            <p>
              Asserta is property-management software for your own rentals or an
              agency portfolio. Keep property records, rental activity and
              tenant conversations organised.
            </p>
            <div className="owner-actions">
              <Link className="primary-button" to={landlordHref}>
                {isAuthenticated &&
                !['LANDLORD', 'AGENT'].includes(profile?.role)
                  ? 'Open your overview'
                  : 'Manage your properties'}
              </Link>
              <Link className="secondary-button" to="/listings">
                Browse rentals
              </Link>
            </div>
          </div>
          <figure className="owner-hero-visual">
            <img
              src="/images/asserta-property.jpg"
              alt="A residential building with a shaded balcony and tropical palms"
              width="1200"
              height="800"
              fetchPriority="high"
            />
          </figure>
        </section>
        <section
          className="owner-benefits"
          aria-label="Property management tools"
        >
          <div>
            <span className="eyebrow">PROPERTY RECORDS</span>
            <h2>Keep your rental records together</h2>
            <p>
              Maintain property details and photos, prepare listings and see
              their current status.
            </p>
          </div>
          <div>
            <span className="eyebrow">RENTAL ACTIVITY</span>
            <h2>See what needs your attention</h2>
            <p>
              Review submitted applications, arrange viewings and follow each
              applicant’s progress.
            </p>
          </div>
          <div>
            <span className="eyebrow">TENANT COMMUNICATION</span>
            <h2>Keep conversations in context</h2>
            <p>
              Exchange messages about each listing and check notifications for
              rental activity.
            </p>
          </div>
        </section>
        <section
          className="owner-audiences"
          aria-label="For owners and agencies"
        >
          <div>
            <p className="eyebrow">FOR PROPERTY OWNERS</p>
            <h2>Your properties, with the details close at hand</h2>
            <p>
              Manage one rental or several. Keep property details, photos and
              rental activity organised, and follow conversations with
              prospective tenants.
            </p>
          </div>
          <div>
            <p className="eyebrow">FOR PROPERTY AGENCIES</p>
            <h2>A clear view across your rental portfolio</h2>
            <p>
              Organise properties, listings and applications across your
              portfolio. Follow viewing arrangements and tenant communication as
              activity progresses.
            </p>
          </div>
        </section>
        <section
          className="owner-experience"
          aria-labelledby="experience-title"
        >
          <p className="eyebrow">YOUR PROPERTY WORKSPACE</p>
          <div>
            <h2 id="experience-title">
              Start with the property. Keep its activity in view.
            </h2>
            <p>
              Return to property details and photos, check listing status, and
              follow applications and messages from your workspace.
            </p>
            <Link to={landlordHref}>
              Explore your workspace <span aria-hidden="true">&rarr;</span>
            </Link>
          </div>
        </section>
        <section className="rental-workflow" aria-labelledby="workflow-title">
          <p className="eyebrow">WHEN A PROPERTY BECOMES AVAILABLE</p>
          <h2 id="workflow-title">From available to rented</h2>
          <ol>
            <li>
              <span className="workflow-step" aria-hidden="true">
                01
              </span>
              <div>
                <strong>Prepare your listing</strong>
                <p>Add property details, photos and rental terms.</p>
              </div>
            </li>
            <li>
              <span className="workflow-step" aria-hidden="true">
                02
              </span>
              <div>
                <strong>Review applications</strong>
                <p>Read submissions and shortlist applicants.</p>
              </div>
            </li>
            <li>
              <span className="workflow-step" aria-hidden="true">
                03
              </span>
              <div>
                <strong>Arrange viewings</strong>
                <p>Propose a time and follow up in messages.</p>
              </div>
            </li>
            <li>
              <span className="workflow-step" aria-hidden="true">
                04
              </span>
              <div>
                <strong>Choose your tenant</strong>
                <p>Accept an eligible applicant after the viewing.</p>
              </div>
            </li>
          </ol>
          <p className="workflow-preview-note">
            You choose the tenant. Asserta keeps the process organised.
          </p>
        </section>
        <section className="marketplace-search" aria-label="Find a rental">
          <p className="eyebrow">LOOKING FOR A HOME?</p>
          <h2>Find a place to rent in Mauritius</h2>
          <RentalSearchForm onSubmit={search} />
          <p>
            Browse available homes, compare what fits your needs, and apply
            directly through Asserta.
          </p>
        </section>
        <InventorySection section={sections[0]} first />
        <section className="marketplace-section" aria-label="Browse by area">
          <h2>Browse by area</h2>
          <div className="marketplace-areas">
            {areas.map((area) => (
              <Link
                key={area}
                to={`/listings?locality=${encodeURIComponent(area)}`}
              >
                {area}
                <span aria-hidden="true">↗</span>
              </Link>
            ))}
          </div>
        </section>
        <section
          className="marketplace-explanation"
          aria-label="Renting through Asserta"
        >
          <div>
            <h2>Your rental search, with progress you can follow</h2>
            <ol>
              <li>Find a rental</li>
              <li>Send your application</li>
              <li>Arrange a viewing directly</li>
            </ol>
          </div>
          <div>
            <h2>Save homes and track your applications</h2>
            <p>
              Create a tenant account to save listings, apply for rentals,
              respond to viewing invitations and message landlords.
            </p>
            <Link to={isAuthenticated ? '/account' : '/register'}>
              {isAuthenticated
                ? 'Open your overview'
                : 'Create a tenant account'}{' '}
              <span aria-hidden="true">→</span>
            </Link>
          </div>
        </section>
        <section className="marketplace-landlord">
          <div>
            <h2>Manage your properties with Asserta</h2>
            <p>
              For independent owners and property agencies in Mauritius. Add
              your properties and keep rental activity organised.
            </p>
          </div>
          <Link className="primary-button" to={landlordHref}>
            {isAuthenticated && !['LANDLORD', 'AGENT'].includes(profile?.role)
              ? 'Open your overview'
              : 'Manage your properties'}
          </Link>
        </section>
      </main>
      <footer className="marketplace-footer">
        <Brand />
        <nav aria-label="Footer">
          <Link to="/listings">Browse rentals</Link>
          <Link to={landlordHref}>
            {isAuthenticated && !['LANDLORD', 'AGENT'].includes(profile?.role)
              ? 'Your overview'
              : 'Manage properties'}
          </Link>
          {!isAuthenticated && (
            <>
              <Link to="/login">Log in</Link>
              <Link to="/register">Create account</Link>
            </>
          )}
        </nav>
      </footer>
    </div>
  );
}
