import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { MEMBER_PHOTO_BUCKET, MEMBER_PHOTO_FOLDER, dataUrlToBytes } from '@/lib/member-photo';

/**
 * Uploads a member photo (data URL) to Supabase Storage on the server.
 * The caller must be signed in; the upload itself uses the service role so it
 * does not depend on Storage RLS behaviour in the browser.
 */
export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json(
      { error: 'Your login session has expired. Please log out and log in again.' },
      { status: 401 }
    );
  }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    return NextResponse.json({ error: 'Server is missing SUPABASE_SERVICE_ROLE_KEY' }, { status: 500 });
  }

  let body: { photo?: string; keyHint?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
  if (!body.photo) return NextResponse.json({ error: 'No photo provided' }, { status: 400 });

  let parsed: ReturnType<typeof dataUrlToBytes>;
  try {
    parsed = dataUrlToBytes(body.photo);
  } catch {
    return NextResponse.json({ error: 'Photo is not a valid image' }, { status: 400 });
  }
  if (!parsed.mime.startsWith('image/')) {
    return NextResponse.json({ error: 'Only image files are allowed' }, { status: 400 });
  }

  const safeKey = (body.keyHint || 'member').toString().replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 60);
  const path = `${MEMBER_PHOTO_FOLDER}/${safeKey}_${Date.now()}.${parsed.ext}`;

  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error } = await admin.storage
    .from(MEMBER_PHOTO_BUCKET)
    .upload(path, parsed.bytes, { contentType: parsed.mime, upsert: false, cacheControl: '31536000' });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const url = admin.storage.from(MEMBER_PHOTO_BUCKET).getPublicUrl(path).data.publicUrl;
  return NextResponse.json({ url });
}
