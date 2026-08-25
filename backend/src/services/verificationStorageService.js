import { getPrivilegedSupabaseClient } from '../config/supabase.js';
export const VERIFICATION_BUCKET = 'verification-evidence';
export const verificationStorageService = {
  async upload(path, buffer, mimeType) {
    const { error } = await getPrivilegedSupabaseClient()
      .storage.from(VERIFICATION_BUCKET)
      .upload(path, buffer, { contentType: mimeType, upsert: false });
    if (error) throw new Error('verification storage upload failed');
  },
  async signedUrl(path) {
    const { data, error } = await getPrivilegedSupabaseClient()
      .storage.from(VERIFICATION_BUCKET)
      .createSignedUrl(path, 300);
    if (error || !data?.signedUrl)
      throw new Error('verification storage signing failed');
    return data.signedUrl;
  },
  async remove(path) {
    await getPrivilegedSupabaseClient()
      .storage.from(VERIFICATION_BUCKET)
      .remove([path]);
  },
};
