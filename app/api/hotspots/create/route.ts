import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  // ── 1. Auth guard ──────────────────────────────────────────────────────────
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

  // ── 3. Insert hotspot using PostGIS WKT POINT string via Admin Client ─────
  const adminClient = await createAdminClient();
  const { data, error } = await adminClient
    .from('hotspots')
    .insert({
      title,
      description,
      inspo_image_url: inspoImageUrl,
      location: `POINT(${lng} ${lat})`, // PostGIS expects longitude latitude order
    })
    .select()
    .single();

  if (error) {
    console.error('[/api/hotspots/create] Error inserting hotspot:', error.message);
    return NextResponse.json(
      { error: 'Failed to create custom hotspot.' },
      { status: 500 }
    );
  }

  return NextResponse.json({ hotspot: data });
}
