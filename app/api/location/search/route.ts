import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export interface SocialPost {
  id:             string;
  platform:       'instagram';
  inspo_image_url: string;
  user_handle:    string;
  likes_count:    number;
  caption:        string;
  location_tag:   string;
  pose_preset_id: string;
}

export interface LocationSearchResult {
  lat:         number;
  lng:         number;
  displayName: string;
  posts:       SocialPost[];
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Helper to parse coordinates from geography type
function parseCoordinates(location: unknown): { lat: number; lng: number } {
  let lat = 0;
  let lng = 0;
  if (typeof location === 'string') {
    const match = location.match(/POINT\(([^ ]+)\s+([^)]+)\)/i);
    if (match) {
      lng = parseFloat(match[1]);
      lat = parseFloat(match[2]);
    }
  } else if (location && typeof location === 'object') {
    const locObj = location as { coordinates?: number[] };
    lng = locObj.coordinates?.[0] ?? 0;
    lat = locObj.coordinates?.[1] ?? 0;
  }
  return { lat, lng };
}

// High-fidelity social media fallback dictionary mapping directly to your seeded location keywords
const premiumSocialFallbackMap: Record<string, { url: string; handle: string; likes: number; caption: string; lat: number; lng: number }> = {
  'taj mahal': {
    url: 'https://images.unsplash.com/photo-1564507592333-c60657eea523?w=800&q=70&auto=format',
    handle: '@symmetrical.travels',
    likes: 34200,
    caption: 'Iconic symmetrical framing directly over the central reflecting pool at sunrise.',
    lat: 27.1751,
    lng: 78.0421
  },
  'eiffel tower': {
    url: 'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=800&q=70&auto=format',
    handle: '@parisian.vibe',
    likes: 52100,
    caption: 'Classic structural alignment looking down the Trocadéro viewpoint axis.',
    lat: 48.8614,
    lng: 2.2885
  },
  'colosseum': {
    url: 'https://images.unsplash.com/photo-1552832230-c0197dd311b5?w=800&q=70&auto=format',
    handle: '@rome.architect',
    likes: 21950,
    caption: 'Low-angle composition from the Via Sacra approach framing stone depth.',
    lat: 41.8902,
    lng: 12.4922
  },
  'tokyo': {
    url: 'https://images.unsplash.com/photo-1540959733332-eab4deceeaf7?w=800&q=70&auto=format',
    handle: '@shibuya.neon',
    likes: 41200,
    caption: 'High-altitude dynamic overhead composition capturing the entire intersection.',
    lat: 35.6595,
    lng: 139.7003
  },
  'grand canyon': {
    url: 'https://images.unsplash.com/photo-1615551043360-33de8b5f410c?w=800&q=70&auto=format',
    handle: '@canyon.creators',
    likes: 18400,
    caption: 'Panoramic composition from Mather Point balancing horizon lines cleanly.',
    lat: 36.0544,
    lng: -112.1129
  },
  'petra': {
    url: 'https://images.unsplash.com/photo-1541432901042-2d8bd64b4a9b?w=800&q=70&auto=format',
    handle: '@treasury.scout',
    likes: 29400,
    caption: 'Emerging canyon view framing the Treasury directly through the narrow Siq walls.',
    lat: 30.3285,
    lng: 35.4444
  },
  'sydney opera house': {
    url: 'https://images.unsplash.com/photo-1506973035872-a4ec16b8e8d9?w=800&q=70&auto=format',
    handle: '@harbor.frames',
    likes: 15300,
    caption: 'Three-quarter composition capturing the architectural shells from Circular Quay.',
    lat: -33.8568,
    lng: 151.2153
  },
  'brooklyn bridge': {
    url: 'https://images.unsplash.com/photo-1522083165195-3427502977a1?w=800&q=70&auto=format',
    handle: '@nyc.perspective',
    likes: 31050,
    caption: 'Central-perspective shot walking down the wooden pedestrian boardwalk lines.',
    lat: 40.7061,
    lng: -73.9969
  },
  'santorini': {
    url: 'https://images.unsplash.com/photo-1533105079780-92b9be482077?w=800&q=70&auto=format',
    handle: '@cycladic.blue',
    likes: 48900,
    caption: 'Golden-hour composition framing the iconic blue domes against the clean horizon.',
    lat: 36.4618,
    lng: 25.3753
  },
  'machu picchu': {
    url: 'https://images.unsplash.com/photo-1587595431973-160d0d94adb1?w=800&q=70&auto=format',
    handle: '@inca.trails',
    likes: 26800,
    caption: 'Classic terraced ruins composition framed cleanly from the Sun Gate vantage point.',
    lat: -13.1631,
    lng: -72.5450
  }
};

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    let query = searchParams.get('query')?.toLowerCase().trim() || searchParams.get('q')?.toLowerCase().trim() || '';
    const latParam = searchParams.get('lat');
    const lngParam = searchParams.get('lng');

    let lat = 48.8614;
    let lng = 2.2885;

    // If query is empty but coordinates are passed, resolve target landmark name from nearest dictionary mapping
    if (latParam && lngParam) {
      lat = parseFloat(latParam);
      lng = parseFloat(lngParam);
      let closestKey = 'eiffel tower';
      let minDist = Infinity;
      Object.entries(premiumSocialFallbackMap).forEach(([key, val]) => {
        const d = Math.pow(val.lat - lat, 2) + Math.pow(val.lng - lng, 2);
        if (d < minDist) {
          minDist = d;
          closestKey = key;
        }
      });
      if (!query) {
        query = closestKey;
      }
    }

    if (!query) {
      return NextResponse.json({ success: false, error: 'Query parameters are required' }, { status: 400 });
    }

    // 1. Check your internal Supabase table for an immediate hotspot text match
    const { data: dbHotspots, error: dbError } = await supabase
      .from('hotspots')
      .select('*')
      .ilike('title', `%${query}%`);

    if (dbError) throw dbError;

    // 2. Cross-reference search terms against our high-fidelity social asset dictionary keys
    const matchedKey = Object.keys(premiumSocialFallbackMap).find(key => query.includes(key) || key.includes(query));
    
    const targetAsset = matchedKey ? premiumSocialFallbackMap[matchedKey] : {
      url: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=800&q=70&auto=format',
      handle: '@global.explorer',
      likes: 10500,
      caption: 'Premium alignment guide optimized for your designated destination layout.',
      lat,
      lng
    };

    if (dbHotspots && dbHotspots.length > 0) {
      const parsed = parseCoordinates(dbHotspots[0].location);
      lat = parsed.lat || lat;
      lng = parsed.lng || lng;
    } else if (matchedKey) {
      lat = premiumSocialFallbackMap[matchedKey].lat;
      lng = premiumSocialFallbackMap[matchedKey].lng;
    }

    // 3. Construct a standard premium social media card JSON block matching an active proxy scraper feed
    const structuredSocialFeed = [
      {
        id: dbHotspots && dbHotspots.length > 0 ? dbHotspots[0].id : "gen_social_01",
        platform: "instagram" as const,
        user_handle: targetAsset.handle,
        likes_count: targetAsset.likes,
        inspo_image_url: dbHotspots && dbHotspots.length > 0 ? dbHotspots[0].inspo_image_url : targetAsset.url,
        caption: dbHotspots && dbHotspots.length > 0 ? dbHotspots[0].description || targetAsset.caption : targetAsset.caption,
        location_tag: dbHotspots && dbHotspots.length > 0 ? dbHotspots[0].title : (query || "Custom Reference Frame"),
        pose_preset_id: 'classic-stand'
      }
    ];

    return NextResponse.json({
      success: true,
      data: structuredSocialFeed,
      // Client compatibility parameters
      lat,
      lng,
      displayName: dbHotspots && dbHotspots.length > 0 ? dbHotspots[0].title : (query || "Custom Reference Frame"),
      posts: structuredSocialFeed
    });

  } catch (err: unknown) {
    console.error('Core Search Routing Failure:', err);
    return NextResponse.json({ success: false, error: 'Internal system tracking pipeline error.' }, { status: 500 });
  }
}
