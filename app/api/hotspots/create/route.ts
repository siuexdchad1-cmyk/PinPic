import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  // ── 1. Auth guard — parses incoming cookies automatically via server client ──
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

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

  // ── 3. Initialize Admin Client to bypass client RLS insertion limits ───────
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

  // Fallback to standard WKT POINT string insertion if the database helper function is missing
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
