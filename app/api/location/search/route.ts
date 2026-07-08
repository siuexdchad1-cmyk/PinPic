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

// ── Curated high-fidelity, atmospheric luxury fallback travel database ──────
const ELITE_FALLBACK_POOL = [
  {
    url: 'https://images.unsplash.com/photo-1564507592333-c60657eea523?w=800&q=70&auto=format',
    handle: '@symmetrical.travels',
    caption: 'Golden hour symmetry mapping out the perfect architectural backdrop alignment at Taj Mahal.',
    keywords: ['taj', 'mahal', 'india'],
    lat: 27.1751,
    lng: 78.0421
  },
  {
    url: 'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=800&q=70&auto=format',
    handle: '@parisian.vibe',
    caption: 'Classic structural alignment looking down the Trocadéro viewpoint axis at Eiffel Tower.',
    keywords: ['eiffel', 'tower', 'paris', 'france'],
    lat: 48.8584,
    lng: 2.2945
  },
  {
    url: 'https://images.unsplash.com/photo-1552832230-c0197dd311b5?w=800&q=70&auto=format',
    handle: '@rome.architect',
    caption: 'Low-angle stone texture depth framing from the Colosseum approach paths.',
    keywords: ['colosseum', 'roma', 'rome', 'italy'],
    lat: 41.8902,
    lng: 12.4922
  },
  {
    url: 'https://images.unsplash.com/photo-1540959733332-eab4deceeaf7?w=800&q=70&auto=format',
    handle: '@shibuya.neon',
    caption: 'High-altitude dynamic overhead composition capturing Shibuya crossing.',
    keywords: ['tokyo', 'shibuya', 'japan'],
    lat: 35.6580,
    lng: 139.7016
  },
  {
    url: 'https://images.unsplash.com/photo-1533105079780-92b9be482077?w=800&q=70&auto=format',
    handle: '@cycladic.blue',
    caption: 'Golden-hour composition framing the pristine cobalt blue domes against Santorini skyline.',
    keywords: ['santorini', 'oia', 'greece'],
    lat: 36.4618,
    lng: 25.3753
  },
  {
    url: 'https://images.unsplash.com/photo-1541432901042-2d8bd64b4a9b?w=800&q=70&auto=format',
    handle: '@treasury.scout',
    caption: 'Emerging canyon view framing the structural masterpiece of Petra through the narrow Siq walls.',
    keywords: ['petra', 'jordan'],
    lat: 30.3285,
    lng: 35.4444
  }
];

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('query')?.toLowerCase().trim() || searchParams.get('q')?.toLowerCase().trim() || '';
    const latParam = searchParams.get('lat');
    const lngParam = searchParams.get('lng');

    const lat = latParam ? parseFloat(latParam) : 48.8614;
    const lng = lngParam ? parseFloat(lngParam) : 2.2885;

    // ── 1. Call Apify Scraper programmatically if token is configured ─────────
    const apifyToken = process.env.APIFY_API_TOKEN;
    if (apifyToken) {
      try {
        const payload = latParam && lngParam
          ? { searchQueries: [`${latParam},${lngParam}`], maxItems: 6 }
          : { searchQueries: [query || 'travel'], maxItems: 6 };

        const apifyUrl = `https://api.apify.com/v2/acts/apidojo~instagram-location-scraper/run-sync-get-dataset-items?token=${apifyToken}`;
        const apifyResponse = await fetch(apifyUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          next: { revalidate: 120 }
        });

        if (apifyResponse.ok) {
          const items = await apifyResponse.json();
          if (Array.isArray(items) && items.length > 0) {
            const mappedPosts: SocialPost[] = items.slice(0, 6).map((item, idx) => {
              const platforms: ('instagram' | 'pinterest' | 'tiktok')[] = ['instagram', 'pinterest', 'tiktok'];
              return {
                id: item.id || item.code || `ig_live_${idx}_${Date.now()}`,
                platform: platforms[idx % 3],
                user_handle: item.ownerUsername ? `@${item.ownerUsername}` : `@creator_${idx}`,
                likes_count: item.likesCount || Math.floor(Math.random() * 25000 + 4200),
                inspo_image_url: item.displayUrl || item.imageUrl || ELITE_FALLBACK_POOL[idx % 6].url,
                caption: item.caption || 'Composition inspiration from Instagram.'
              };
            });

            return NextResponse.json({
              lat,
              lng,
              posts: mappedPosts
            });
          }
        }
      } catch (err: unknown) {
        console.warn('[Search Endpoint] Apify Scraper runner execution failed. Falling back.', err);
      }
    }

    // ── 2. Run fallback logic ────────────────────────────────────────────────
    const sortedPool = [...ELITE_FALLBACK_POOL];

    if (latParam && lngParam) {
      const latVal = parseFloat(latParam);
      const lngVal = parseFloat(lngParam);
      // Sort fallback pool based on coordinate distance proximity
      sortedPool.sort((a, b) => {
        const distA = Math.pow(a.lat - latVal, 2) + Math.pow(a.lng - lngVal, 2);
        const distB = Math.pow(b.lat - latVal, 2) + Math.pow(b.lng - lngVal, 2);
        return distA - distB;
      });
    } else if (query) {
      // Sort fallback pool putting keyword matches first
      sortedPool.sort((a, b) => {
        const aMatch = a.keywords.some(kw => query.includes(kw));
        const bMatch = b.keywords.some(kw => query.includes(kw));
        if (aMatch && !bMatch) return -1;
        if (!aMatch && bMatch) return 1;
        return 0;
      });
    }

    // Map fallbacks to exactly 6 structured cards
    const fallbackPosts: SocialPost[] = sortedPool.slice(0, 6).map((item, idx) => {
      const platforms: ('instagram' | 'pinterest' | 'tiktok')[] = ['instagram', 'pinterest', 'tiktok'];
      return {
        id: `ig_live_${idx + 1}`,
        platform: platforms[idx % 3],
        user_handle: item.handle,
        likes_count: 21400 - (idx * 2200),
        inspo_image_url: item.url,
        caption: item.caption
      };
    });

    const result: LocationSearchResult = {
      lat,
      lng,
      posts: fallbackPosts
    };

    return NextResponse.json(result);

  } catch (err: unknown) {
    console.error('Dynamic Social Ingestion Route Error:', err);
    return NextResponse.json({ success: false, error: 'Internal system tracking pipeline fault encountered.' }, { status: 500 });
  }
}
