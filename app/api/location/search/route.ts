import { NextRequest, NextResponse } from 'next/server';

export interface SocialPost {
  id:             string;
  platform:       'instagram' | 'tiktok' | 'youtube_shorts';
  inspo_image_url: string;
  user_handle:    string;
  likes_count:    number;
  caption:        string;
  location_tag:   string;
  pose_preset_id: string; // matches classic-stand, cafe-sit, action-walk
}

export interface LocationSearchResult {
  lat:         number;
  lng:         number;
  displayName: string;
  posts:       SocialPost[];
}

// ── Curated high-quality Unsplash travel photo IDs ─────────────────────────
const TRAVEL_PHOTO_IDS = [
  '1499856871958-5b9357976b82', // City at night — moody
  '1476514525535-07fb3b4ae5f1', // Mountain path — cinematic
  '1506905925346-21bda4d32df4', // Alpine lake reflection
  '1469474968028-56623f02e42e', // Nature vista — editorial
  '1493246507139-91e8fad9978e', // Mountain peak — dramatic
  '1441974231531-c6227db76b6e', // Forest sunrays — aesthetic
  '1501854140801-50d01698950b', // Aerial landscape
  '1433086966358-54859d0ed716', // Waterfall — portrait
];

// ── Creator handle pool ─────────────────────────────────────────────────────
const HANDLES_INSTAGRAM = [
  '@lens.nomad', '@golden.hour.gram', '@travel.composure', '@wanderframe'
];

const HANDLES_TIKTOK = [
  '@travelpov.tt', '@cinematic.shot', '@framesbyfoot', '@bokeh.wanderer'
];

const HANDLES_YOUTUBE = [
  '@TravelEdit4K', '@CinematicRoamer', '@ShortsByAltitude', '@ReelLandscape'
];

// ── Like count generator — weighted toward high-engagement ─────────────────
function fakeLikes(base: number): number {
  return base + Math.floor(Math.random() * base * 0.4);
}

// ── Social scraper simulation (production-ready structure) ──────────────────
function buildSocialFeed(location: string, lat: number, lng: number): SocialPost[] {
  const seed = Math.abs(Math.round(lat * 1000 + lng * 1000)) % TRAVEL_PHOTO_IDS.length;

  const posts: SocialPost[] = TRAVEL_PHOTO_IDS.map((photoId, i) => {
    const idx = (seed + i) % TRAVEL_PHOTO_IDS.length;
    const platform: SocialPost['platform'] =
      i % 3 === 0 ? 'instagram' :
      i % 3 === 1 ? 'tiktok' :
      'youtube_shorts';

    const handle =
      platform === 'instagram' ? HANDLES_INSTAGRAM[i % HANDLES_INSTAGRAM.length] :
      platform === 'tiktok'    ? HANDLES_TIKTOK[i % HANDLES_TIKTOK.length] :
                                 HANDLES_YOUTUBE[i % HANDLES_YOUTUBE.length];

    const baseLikes =
      platform === 'instagram'    ? 14_000 + i * 3_200 :
      platform === 'tiktok'       ? 82_000 + i * 12_000 :
                                    6_200  + i * 1_800;

    // Unsplash CDN direct URL — optimized as requested
    const inspo_image_url =
      `https://images.unsplash.com/photo-${TRAVEL_PHOTO_IDS[idx]}?w=600&q=70&auto=format&fit=crop`;

    const captions = [
      `Golden hour hits different in ${location} 🌅`,
      `Found this angle after 2km hike — worth it 📸`,
      `Rule of thirds + ${location} = perfection`,
      `No filter needed here, trust me`,
      `Shot this at 5am. Alarm was worth it. ✨`,
      `${location} from a rooftop nobody talks about`,
      `Composition tip: keep horizon at the lower third`,
      `Chasing light in ${location} every season`,
    ];

    const pose_preset_id = ['classic-stand', 'cafe-sit', 'action-walk'][i % 3];

    return {
      id: `post_${idx}_${platform}_${Date.now() + i}`,
      platform,
      inspo_image_url,
      user_handle: handle,
      likes_count: fakeLikes(baseLikes),
      caption: captions[i % captions.length],
      location_tag: location,
      pose_preset_id,
    };
  });

  return posts;
}

// ── Route handler ───────────────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q');

  if (!q || !q.trim()) {
    return NextResponse.json({ error: 'Search query required.' }, { status: 400 });
  }

  try {
    // ── 1. Geocode via Nominatim ────────────────────────────────────────────
    const geocodeUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=1`;
    const geocodeRes = await fetch(geocodeUrl, {
      headers: { 'User-Agent': 'PinPic/1.0 (educational project)' },
      next: { revalidate: 3600 }
    });

    if (!geocodeRes.ok) throw new Error('Geocoding service unavailable.');

    const results = await geocodeRes.json();
    if (!results || results.length === 0) {
      return NextResponse.json({ error: 'No locations found for this query.' }, { status: 404 });
    }

    const match = results[0];
    const lat = parseFloat(match.lat);
    const lng = parseFloat(match.lon);
    const rawName: string = match.display_name ?? q;
    const displayName = rawName;
    const locationLabel = rawName.split(',')[0];

    // ── 2. Build social feed ────────────────────────────────────────────────
    const posts = buildSocialFeed(locationLabel, lat, lng);

    const result: LocationSearchResult = { lat, lng, displayName, posts };
    return NextResponse.json(result);

  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Search failed. Try again.';
    console.error('[/api/location/search] Error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
