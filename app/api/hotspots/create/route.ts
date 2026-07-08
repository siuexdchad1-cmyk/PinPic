import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient, createAdminClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  // ── 1. Auth guard — explicitly extract incoming user session token from cookies ──
  const cookieStore = await cookies();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const projectRef = supabaseUrl.split('//')[1]?.split('.')[0] || '';
  const cookieName = `sb-${projectRef}-auth-token`;

  const authCookie = cookieStore.get(cookieName);
  if (!authCookie || !authCookie.value) {
    return NextResponse.json({ error: 'Unauthorized. No session cookie found.' }, { status: 401 });
  }

  // Parse the access token from session cookie structure
  let accessToken: string | undefined;
  try {
    const parsed = JSON.parse(authCookie.value);
    accessToken = parsed.access_token;
  } catch {
    accessToken = authCookie.value; // Fallback if raw
  }

  if (!accessToken) {
    return NextResponse.json({ error: 'Unauthorized. Empty session token.' }, { status: 401 });
  }

  // Authenticate user with the session token
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser(accessToken);

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  // ── 2. Parse body ─────────────────────────────────────────────────────────
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const { title, description, inspoImageUrl, lat, lng } = body;

  if (!title || !inspoImageUrl || lat === undefined || lng === undefined) {
    return NextResponse.json(
      { error: 'title, inspoImageUrl, lat, and lng are required.' },
      { status: 400 }
    );
  }

  // ── 3. Initialize Admin Client using SUPABASE_SERVICE_ROLE_KEY to bypass RLS ─
  const adminClient = await createAdminClient();

  // Try calling the direct RPC function mapping coordinates via ST_SetSRID/ST_MakePoint
  let data = null;
  let insertError = null;

  try {
    const { data: rpcData, error: rpcError } = await adminClient.rpc(
      'create_custom_hotspot',
      {
        title,
        description,
        inspo_image_url: inspoImageUrl,
        lat: parseFloat(lat),
        lng: parseFloat(lng)
      }
    );

    if (!rpcError && rpcData) {
      data = rpcData;
    } else {
      insertError = rpcError;
    }
  } catch (err: unknown) {
    insertError = err;
  }

  // Fallback to WKT POINT string insertion if the database RPC function is missing
  if (insertError || !data) {
    console.warn('[/api/hotspots/create] RPC fallback: executing WKT format insertion.');

    const { data: wktData, error: wktError } = await adminClient
      .from('hotspots')
      .insert({
        title,
        description,
        inspo_image_url: inspoImageUrl,
        location: `POINT(${lng} ${lat})` // PostgREST WKT Point formatting
      })
      .select()
      .single();

    if (wktError) {
      console.error('[/api/hotspots/create] Insertion failed:', wktError.message);
      return NextResponse.json(
        { error: 'Failed to save hotspot coordinates.' },
        { status: 500 }
      );
    }
    data = wktData;
  }

  return NextResponse.json({ hotspot: data });
}
