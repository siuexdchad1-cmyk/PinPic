import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { NearbyHotspot } from '@/lib/types';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const lat    = parseFloat(searchParams.get('lat')    ?? '');
  const lng    = parseFloat(searchParams.get('lng')    ?? '');
  const radius = parseFloat(searchParams.get('radius') ?? '15');

  if (isNaN(lat) || isNaN(lng)) {
    return NextResponse.json(
      { error: 'lat and lng query parameters are required and must be numbers.' },
      { status: 400 }
    );
  }

  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return NextResponse.json(
      { error: 'Coordinates out of valid range. lat: -90..90, lng: -180..180' },
      { status: 400 }
    );
  }

  const supabase = await createClient();

  // Use the nearby_hotspots RPC function defined in the migration.
  // This calls ST_DWithin internally using the spatial GiST index.
  const { data, error } = await supabase.rpc('nearby_hotspots', {
    lat,
    lng,
    radius_m: radius,
  });

  if (error) {
    console.error('[/api/hotspots/nearby] Supabase RPC error:', error.message);
    return NextResponse.json(
      { error: 'Failed to query nearby hotspots.' },
      { status: 500 }
    );
  }

  const hotspots: NearbyHotspot[] = (data ?? []).map((row: NearbyHotspot) => ({
    ...row,
    // Ensure Unsplash URLs have mobile compression params
    inspo_image_url: row.inspo_image_url.includes('?')
      ? row.inspo_image_url
      : `${row.inspo_image_url}?w=400&q=70&auto=format`,
  }));

  return NextResponse.json({ hotspots });
}
