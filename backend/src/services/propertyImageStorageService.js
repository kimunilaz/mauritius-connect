import { Buffer } from 'node:buffer';
import { getPrivilegedSupabaseClient } from '../config/supabase.js';

export const PROPERTY_IMAGE_BUCKET = 'property-images';
export const SIGNED_IMAGE_URL_SECONDS = 15 * 60;

export class PropertyImageStorageError extends Error {
  constructor(reason) {
    super('The property image storage operation failed.');
    this.name = 'PropertyImageStorageError';
    this.reason = reason;
  }
}

export const propertyImageStorageService = {
  async upload(path, buffer, mimeType) {
    const { error } = await getPrivilegedSupabaseClient()
      .storage.from(PROPERTY_IMAGE_BUCKET)
      .upload(path, buffer, {
        contentType: mimeType,
        cacheControl: '3600',
        upsert: false,
      });
    if (error) throw new PropertyImageStorageError('UPLOAD_FAILED');
  },

  async signedUrl(path) {
    const { data, error } = await getPrivilegedSupabaseClient()
      .storage.from(PROPERTY_IMAGE_BUCKET)
      .createSignedUrl(path, SIGNED_IMAGE_URL_SECONDS);
    if (error || !data?.signedUrl) {
      throw new PropertyImageStorageError('SIGN_FAILED');
    }
    return data.signedUrl;
  },

  async download(path) {
    const { data, error } = await getPrivilegedSupabaseClient()
      .storage.from(PROPERTY_IMAGE_BUCKET)
      .download(path);
    if (error || !data) throw new PropertyImageStorageError('DOWNLOAD_FAILED');
    return Buffer.from(await data.arrayBuffer());
  },

  async remove(path) {
    const { data, error } = await getPrivilegedSupabaseClient()
      .storage.from(PROPERTY_IMAGE_BUCKET)
      .remove([path]);
    if (error || !data?.length) {
      throw new PropertyImageStorageError('DELETE_FAILED');
    }
  },
};
