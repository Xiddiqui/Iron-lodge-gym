import type { SupabaseClient } from '@supabase/supabase-js';
import { isBase64Image, normalizeImageSrc } from '@/lib/image-utils';

export const MEMBER_PHOTO_BUCKET = 'gym-assets';
export const MEMBER_PHOTO_FOLDER = 'member-photos';

/** Converts a data URI (or raw base64) into binary bytes + mime type. */
export function dataUrlToBytes(src: string): { bytes: Uint8Array; mime: string; ext: string } {
  const dataUrl = normalizeImageSrc(src) || src;
  const match = dataUrl.match(/^data:([^;,]+)(;base64)?,([\s\S]*)$/);
  if (!match) throw new Error('Not a data URL');
  const mime = match[1] || 'image/jpeg';
  const payload = match[3];
  const binary = match[2] ? atob(payload) : decodeURIComponent(payload);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const ext = mime.includes('png') ? 'png' : mime.includes('webp') ? 'webp' : mime.includes('gif') ? 'gif' : mime.includes('svg') ? 'svg' : 'jpg';
  return { bytes, mime, ext };
}

/**
 * If `photo` is a base64 image, uploads it to Supabase Storage and returns the public URL.
 * URLs and empty values are returned unchanged, so it is safe to call on every save.
 */
export async function ensureMemberPhotoUrl(
  supabase: SupabaseClient,
  photo: string | null | undefined,
  keyHint?: string | null
): Promise<string | null> {
  if (!photo || !photo.trim()) return null;
  if (!isBase64Image(photo) && !photo.trim().startsWith('data:')) return photo.trim();

  const { bytes, mime, ext } = dataUrlToBytes(photo.trim());
  const safeKey = (keyHint || 'member').toString().replace(/[^a-zA-Z0-9_-]/g, '_');
  const path = `${MEMBER_PHOTO_FOLDER}/${safeKey}_${Date.now()}.${ext}`;

  const { error } = await supabase.storage
    .from(MEMBER_PHOTO_BUCKET)
    .upload(path, bytes, { contentType: mime, upsert: true, cacheControl: '31536000' });
  if (error) throw new Error(`Photo upload failed: ${error.message}`);

  return supabase.storage.from(MEMBER_PHOTO_BUCKET).getPublicUrl(path).data.publicUrl;
}
