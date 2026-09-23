import { Link } from 'react-router-dom';
import { useState } from 'react';
import {
  formatDate,
  formatPublicRent,
  publicLocation,
  publicPropertyTypeLabel,
} from '../../utils/listing.js';

export default function PublicListingCard({
  listing,
  children,
  compact = false,
  eager = false,
}) {
  const Heading = compact ? 'h3' : 'h2';
  const [failedImage, setFailedImage] = useState(null);
  return (
    <article className="public-listing-card">
      <Link to={`/listings/${listing.id}`} aria-label={`View ${listing.title}`}>
        {listing.cover_image_url && failedImage !== listing.cover_image_url ? (
          <img
            src={listing.cover_image_url}
            alt={`Cover photo for ${listing.title}`}
            loading={eager ? 'eager' : 'lazy'}
            decoding="async"
            onError={() => setFailedImage(listing.cover_image_url)}
          />
        ) : (
          <div className="public-image-placeholder">Photo unavailable</div>
        )}
      </Link>
      <div className="public-listing-card-body">
        <p className="public-listing-location">
          {publicLocation(listing.property)}
        </p>
        <Heading>
          <Link to={`/listings/${listing.id}`}>{listing.title}</Link>
        </Heading>
        <p className="public-listing-rent">
          {compact
            ? `MUR ${Number(listing.monthly_rent).toLocaleString('en-MU')} / month`
            : formatPublicRent(listing.monthly_rent)}
        </p>
        <p>
          {listing.property.bedrooms === 0
            ? 'Studio'
            : `${listing.property.bedrooms} bedroom${listing.property.bedrooms === 1 ? '' : 's'}`}{' '}
          · {listing.property.bathrooms} bathroom
          {listing.property.bathrooms === 1 ? '' : 's'}
        </p>
        <p>
          {publicPropertyTypeLabel(listing.property.property_type)}
          {listing.property.furnished ? ' · Furnished' : ''}
        </p>
        {!compact && <p>Available {formatDate(listing.available_from)}</p>}
        {!compact &&
        (listing.landlord_verified || listing.property_authority_verified) ? (
          <p className="trust-indicators">
            {listing.landlord_verified ? 'Identity reviewed' : null}
            {listing.landlord_verified && listing.property_authority_verified
              ? ' · '
              : null}
            {listing.property_authority_verified
              ? 'Property evidence reviewed'
              : null}
          </p>
        ) : null}
        {children}
      </div>
    </article>
  );
}
