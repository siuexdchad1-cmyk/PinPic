import { NextRequest, NextResponse } from 'next/server';

export interface SocialPost {
  id:             string;
  platform:       'instagram';
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

// ── Curated fallback travel lifestyle Unsplash photos (as requested) ────────
const DEV_FALLBACK_POSTS: SocialPost[] = [
  {
    id: 'ig_dev_01',
    platform: 'instagram',
    user_handle: '@candid.travels',
    likes_count: 14200,
    inspo_image_url: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=600&q=70&auto=format',
    caption: 'Golden hour framing along the coastal ridges.',
    location_tag: 'Coastal Ridge',
    pose_preset_id: 'classic-stand'
  },
  {
    id: 'ig_dev_02',
    platform: 'instagram',
    user_handle: '@nomad.frame',
    likes_count: 9800,
    inspo_image_url: 'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=600&q=70&auto=format',
    caption: 'Leading lines walking down the mountain trail.',
    location_tag: 'Mountain Trail',
    pose_preset_id: 'action-walk'
  },
  {
    id: 'ig_dev_03',
    platform: 'instagram',
    user_handle: '@editorial.roam',
    likes_count: 22100,
    inspo_image_url: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=600&q=70&auto=format',
    caption: 'Symmetrical rule-of-thirds alignment from the shore.',
    location_tag: 'Seaside Dunes',
    pose_preset_id: 'classic-stand'
  },
  {
    id: 'ig_dev_04',
    platform: 'instagram',
    user_handle: '@rooftop.view',
    likes_count: 18500,
    inspo_image_url: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=600&q=70&auto=format',
    caption: 'Urban perspective composition framing industrial elements.',
    location_tag: 'Metropolis Core',
    pose_preset_id: 'cafe-sit'
  },
  {
    id: 'ig_dev_05',
    platform: 'instagram',
    user_handle: '@scenery.chaser',
    likes_count: 31000,
    inspo_image_url: 'https://images.unsplash.com/photo-1501854140801-50d01698950b?w=600&q=70&auto=format',
    caption: 'Landscape alignment with natural horizon accentuation.',
    location_tag: 'Alpine Peak',
    pose_preset_id: 'classic-stand'
  },
  {
    id: 'ig_dev_06',
    platform: 'instagram',
    user_handle: '@aesthetic.walks',
    likes_count: 11400,
    inspo_image_url: 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=600&q=70&auto=format',
    caption: 'Depth guide centered within dense woodland paths.',
    location_tag: 'Forest Sanctuary',
    pose_preset_id: 'action-walk'
  },
  {
    id: 'ig_dev_07',
    platform: 'instagram',
    user_handle: '@viewfinder.pro',
    likes_count: 27800,
    inspo_image_url: 'https://images.unsplash.com/photo-1499856871958-5b9357976b82?w=600&q=70&auto=format',
    caption: 'Low-angle reflection from the plaza stones.',
    location_tag: 'Piazza Symmetrics',
    pose_preset_id: 'cafe-sit'
  },
  {
    id: 'ig_dev_08',
    platform: 'instagram',
    user_handle: '@bokeh.lens',
    likes_count: 15900,
    inspo_image_url: 'https://images.unsplash.com/photo-1433086966358-54859d0ed716?w=600&q=70&auto=format',
    caption: 'Cinematic alignment against vertical waterfalls.',
    location_tag: 'Valley Cascades',
    pose_preset_id: 'classic-stand'
  }
];

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const latParam = searchParams.get('lat');
  const lngParam = searchParams.get('lng');
  const q = searchParams.get('q');

  let lat = 0;
  let lng = 0;
  let displayName = 'Current Location';

  // ── 1. Geocoding / Parameters Resolution ──────────────────────────────────
  try {
    if (latParam && lngParam) {
      lat = parseFloat(latParam);
      lng = parseFloat(lngParam);
    } else if (q && q.trim()) {
      // Clean, minimal geocoding search fallback without academic Wikimedia logic
      const geocodeUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=1`;
      const geocodeRes = await fetch(geocodeUrl, {
        headers: { 'User-Agent': 'PinPic/1.0 (social proxy actor)' },
        next: { revalidate: 3600 }
      });

      if (geocodeRes.ok) {
        const results = await geocodeRes.json();
        if (results && results.length > 0) {
          const match = results[0];
          lat = parseFloat(match.lat);
          lng = parseFloat(match.lon);
          displayName = match.display_name.split(',')[0];
        }
      }
    }
  } catch (err) {
    console.warn('[/api/location/search] Coordinates resolution issue:', err);
  }

  // If no valid coordinates can be parsed, return standard baseline default coords
  if (isNaN(lat) || isNaN(lng) || (lat === 0 && lng === 0)) {
    lat = 48.8614;
    lng = 2.2885;
    displayName = 'Default Coordinates';
  }

  // ── 2. Apify Scraper Integration Wrapper ──────────────────────────────────
  const apifyToken = process.env.APIFY_API_TOKEN;

  if (apifyToken) {
    try {
      // Call Apify actor synchronously, passing coordinates query
      const apifyUrl = `https://api.apify.com/v2/acts/apidojo~instagram-location-scraper/run-sync-get-dataset-items?token=${apifyToken}`;
      const apifyResponse = await fetch(apifyUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          searchQueries: [`${lat},${lng}`],
          maxItems: 8
        }),
        next: { revalidate: 120 } // cache requests briefly to prevent rate limits
      });

      if (apifyResponse.ok) {
        const items = await apifyResponse.json();
        if (Array.isArray(items) && items.length > 0) {
          const mappedPosts: SocialPost[] = items.slice(0, 8).map((item, idx) => ({
            id: item.id || item.code || `ig_${lat}_${lng}_${idx}`,
            platform: 'instagram' as const,
            inspo_image_url: item.displayUrl || item.imageUrl || DEV_FALLBACK_POSTS[idx % 8].inspo_image_url,
            user_handle: item.ownerUsername ? `@${item.ownerUsername}` : `@creator_${idx}`,
            likes_count: item.likesCount || Math.floor(Math.random() * 25000 + 1200),
            caption: item.caption || 'Authentic composition perspective.',
            location_tag: displayName,
            pose_preset_id: ['classic-stand', 'cafe-sit', 'action-walk'][idx % 3]
          }));

          return NextResponse.json({
            lat,
            lng,
            displayName,
            posts: mappedPosts
          });
        }
      }
    } catch (e) {
      console.warn('[/api/location/search] Apify Scraper call failed. Running dev fallback.', e);
    }
  }

  // ── 3. Developer / Offline Fallback Sequence ──────────────────────────────
  const finalPosts = DEV_FALLBACK_POSTS.map(post => ({
    ...post,
    location_tag: displayName
  }));

  const result: LocationSearchResult = {
    lat,
    lng,
    displayName,
    posts: finalPosts
  };

  return NextResponse.json(result);
}
