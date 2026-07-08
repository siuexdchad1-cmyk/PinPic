import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

interface HotspotDbRow {
  id:              string;
  title:           string;
  description:     string | null;
  location:        string | { coordinates?: number[] };
  inspo_image_url: string;
}

export async function GET() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('hotspots')
    .select('*');

  if (error) {
    console.error('[/api/hotspots] Error fetching hotspots:', error.message);
    return NextResponse.json({ error: 'Failed to fetch hotspots.' }, { status: 500 });
  }

  const hotspots = (data ?? []).map((spot: unknown) => {
    const s = spot as HotspotDbRow;
    let lat = 0;
    let lng = 0;
    
    if (typeof s.location === 'string') {
      // Handles POINT(longitude latitude) format
      const match = s.location.match(/POINT\(([^ ]+)\s+([^)]+)\)/i);
      if (match) {
        lng = parseFloat(match[1]);
        lat = parseFloat(match[2]);
      }
    } else if (s.location && typeof s.location === 'object') {
      // Handles GeoJSON POINT format
      lng = s.location.coordinates?.[0] ?? 0;
      lat = s.location.coordinates?.[1] ?? 0;
    }
    
    return {
      id: s.id,
      title: s.title,
      description: s.description,
      inspo_image_url: s.inspo_image_url,
      lat,
      lng
    };
  });

  return NextResponse.json({ hotspots });
}
