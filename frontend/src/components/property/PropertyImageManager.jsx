import { useRef, useState } from 'react';
import { ApiError } from '../../services/apiClient.js';
import {
  deletePropertyImage,
  updatePropertyImage,
  uploadPropertyImage,
} from '../../services/propertyService.js';

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

function safeMessage(error, fallback) {
  return error instanceof ApiError ? error.message : fallback;
}

export default function PropertyImageManager({
  accessToken,
  propertyId,
  images,
  archived,
  onChange,
}) {
  const input = useRef(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const sorted = [...images].sort(
    (left, right) => left.display_order - right.display_order,
  );

  async function upload(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!ACCEPTED_TYPES.includes(file.type)) {
      setMessage('Choose a JPEG, PNG, or WebP image.');
      event.target.value = '';
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setMessage('Property images must be 10 MB or smaller.');
      event.target.value = '';
      return;
    }
    setBusy(true);
    setMessage('');
    try {
      const created = await uploadPropertyImage(accessToken, propertyId, file);
      onChange([...images, created]);
      setMessage('Image uploaded.');
    } catch (error) {
      setMessage(safeMessage(error, 'The image could not be uploaded.'));
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  }

  async function makeCover(image) {
    setBusy(true);
    setMessage('');
    try {
      const updated = await updatePropertyImage(
        accessToken,
        propertyId,
        image.id,
        { is_cover: true },
      );
      onChange(
        images.map((candidate) => ({
          ...candidate,
          is_cover: candidate.id === updated.id,
        })),
      );
      setMessage('Cover image updated.');
    } catch (error) {
      setMessage(safeMessage(error, 'The cover image could not be updated.'));
    } finally {
      setBusy(false);
    }
  }

  async function move(image, direction) {
    const index = sorted.findIndex((candidate) => candidate.id === image.id);
    const other = sorted[index + direction];
    if (!other) return;
    setBusy(true);
    setMessage('');
    try {
      const updated = await updatePropertyImage(
        accessToken,
        propertyId,
        image.id,
        { display_order: other.display_order },
      );
      let swapped;
      try {
        swapped = await updatePropertyImage(accessToken, propertyId, other.id, {
          display_order: image.display_order,
        });
      } catch (error) {
        try {
          await updatePropertyImage(accessToken, propertyId, image.id, {
            display_order: image.display_order,
          });
        } catch {
          // The next refresh restores the authoritative server ordering.
        }
        throw error;
      }
      onChange(
        images.map((candidate) => {
          if (candidate.id === updated.id) return updated;
          if (candidate.id === swapped.id) return swapped;
          return candidate;
        }),
      );
      setMessage('Image order updated.');
    } catch (error) {
      setMessage(safeMessage(error, 'The image order could not be updated.'));
    } finally {
      setBusy(false);
    }
  }

  async function remove(image) {
    if (!globalThis.confirm('Delete this property image permanently?')) return;
    setBusy(true);
    setMessage('');
    try {
      onChange(await deletePropertyImage(accessToken, propertyId, image.id));
      setMessage('Image deleted.');
    } catch (error) {
      setMessage(safeMessage(error, 'The image could not be deleted.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      className="property-images"
      aria-labelledby="property-images-title"
    >
      <div className="property-images-header">
        <div>
          <h2 id="property-images-title">Property images</h2>
          <p>
            Private images for this property. Up to 20 JPEG, PNG, or WebP files.
          </p>
        </div>
        {!archived && images.length < 20 ? (
          <label className="primary-button image-upload-button">
            {busy ? 'Working...' : 'Upload image'}
            <input
              ref={input}
              type="file"
              name="image"
              accept="image/jpeg,image/png,image/webp"
              disabled={busy}
              onChange={upload}
            />
          </label>
        ) : null}
      </div>
      {message ? (
        <p className="form-message" role="status">
          {message}
        </p>
      ) : null}
      {sorted.length === 0 ? (
        <p className="image-empty-state">No property images uploaded yet.</p>
      ) : (
        <ol className="property-image-grid">
          {sorted.map((image, index) => (
            <li key={image.id} className="property-image-card">
              <div className="property-image-preview">
                <img
                  src={image.url}
                  alt={`Property photo ${index + 1}${image.is_cover ? ' (cover)' : ''}`}
                />
                {image.is_cover ? <span>Cover</span> : null}
              </div>
              <div className="image-actions">
                {!image.is_cover ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => makeCover(image)}
                  >
                    Set as cover
                  </button>
                ) : null}
                <button
                  type="button"
                  aria-label={`Move property photo ${index + 1} earlier`}
                  disabled={busy || index === 0}
                  onClick={() => move(image, -1)}
                >
                  Move earlier
                </button>
                <button
                  type="button"
                  aria-label={`Move property photo ${index + 1} later`}
                  disabled={busy || index === sorted.length - 1}
                  onClick={() => move(image, 1)}
                >
                  Move later
                </button>
                <button
                  className="text-button"
                  type="button"
                  disabled={busy}
                  onClick={() => remove(image)}
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
