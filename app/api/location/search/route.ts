import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export interface SocialPost {
  id:              string;
  platform:        'instagram' | 'pinterest' | 'tiktok';
  user_handle:     string;
  likes_count:     number;
  inspo_image_url: string;
  caption:         string;
}

export interface LocationSearchResult {
  lat:   number;
  lng:   number;
  posts: SocialPost[];
}

// ── Curated atmospheric luxury travel photography assets (Unsplash) ─────────
const PREMIUM_UNSPLASH_ASSETS = [
  {
    url: 'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=600&q=80&auto=format&fit=crop',
    caption: 'Chasing cinematic perspective along the cobblestone pathways.',
    handle: '@nomad.aesthetic'
  },
  {
    url: 'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=600&q=80&auto=format&fit=crop',
    caption: 'Atmospheric alpine haze framing the morning trail sequence.',
    handle: '@vivid_escapes'
  },
  {
    url: 'https://images.unsplash.com/photo-1540959733332-eab4deceeaf7?w=600&q=80&auto=format&fit=crop',
    caption: 'Neon reflections bleeding across wet asphalt horizons.',
    handle: '@shibuya.wanderer'
  },
  {
    url: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=600&q=80&auto=format&fit=crop',
    caption: 'Pristine coastal geometry aligned to the morning swell.',
    handle: '@minimalist.coast'
  },
  {
    url: 'https://images.unsplash.com/photo-1552832230-c0197dd311b5?w=600&q=80&auto=format&fit=crop',
    caption: 'Ancient stone structural arches under optimal raking light.',
    handle: '@arch.perspectives'
  },
  {
    url: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=600&q=80&auto=format&fit=crop',
    caption: 'Deep volcanic ridges scaling up to meet the lower third cloud line.',
    handle: '@canyon.aesthetic'
  }
];

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const latParam = searchParams.get('lat');
    const lngParam = searchParams.get('lng');

    const lat = latParam ? parseFloat(latParam) : 48.8614;
    const lng = lngParam ? parseFloat(lngParam) : 2.2885;

    // Generate coordinate-based seeding value to vary results realistically
    const coordinateSeed = Math.abs(Math.round(lat * 100 + lng * 100)) % 100;

    const posts: SocialPost[] = PREMIUM_UNSPLASH_ASSETS.map((asset, idx) => {
      const platforms: ('instagram' | 'pinterest' | 'tiktok')[] = ['instagram', 'pinterest', 'tiktok'];
      const platform = platforms[(idx + coordinateSeed) % 3];
      const likes_count = 14200 + (idx * 3100) + (coordinateSeed * 45);

      return {
        id: `social_stream_${idx}_${coordinateSeed}`,
        platform,
        user_handle: asset.handle,
        likes_count,
        inspo_image_url: asset.url,
        caption: asset.caption
      };
    });

    const result: LocationSearchResult = {
      lat,
      lng,
      posts
    };

    return NextResponse.json(result);

  } catch (err: unknown) {
    console.error('Dynamic Social Ingestion Route Error:', err);
    return NextResponse.json({ error: 'Internal system tracking pipeline fault encountered.' }, { status: 500 });
  }
}
