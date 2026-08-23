import { Link } from 'react-router-dom';
import {
  formatDate,
  formatPublicRent,
  publicLocation,
  publicPropertyTypeLabel,
} from '../../utils/listing.js';

export default function PublicListingCard({ listing, children }) {
  return (
    <article className="public-listing-card">
      <Link to={`/listings/${listing.id}`} aria-label={`View ${listing.title}`}>
        {listing.cover_image_url ? (
          <img
            src={listing.cover_image_url}
            alt={`Cover photo for ${listing.title}`}
            loading="lazy"
          />
        ) : (
          <div className="public-image-placeholder">Photo unavailable</div>
        )}
      </Link>
      <div className="public-listing-card-body">
        <p className="public-listing-location">
          {publicLocation(listing.property)}
        </p>
        <h2>
          <Link to={`/listings/${listing.id}`}>{listing.title}</Link>
        </h2>
        <p className="public-listing-rent">
          {formatPublicRent(listing.monthly_rent)}
        </p>
        <p>
          {listing.property.bedrooms} bedroom
          {listing.property.bedrooms === 1 ? '' : 's'} ·{' '}
          {listing.property.bathrooms} bathroom
          {listing.property.bathrooms === 1 ? '' : 's'}
        </p>
        <p>
          {publicPropertyTypeLabel(listing.property.property_type)}
          {listing.property.furnished ? ' · Furnished' : ''}
        </p>
        <p>Available {formatDate(listing.available_from)}</p>
        {children}
      </div>
    </article>
  );
}
