import { NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import type { NearbyHotspot } from '@/lib/types';

export const dynamic = 'force-dynamic';

export interface SocialPost {
  id:              string;
  platform:        'instagram' | 'pinterest' | 'tiktok';
  user_handle:     string;
  likes_count:     number;
  inspo_image_url: string;
  caption:         string;
  title?:          string;
}

export interface LocationSearchResult {
  lat:   number;
  lng:   number;
  posts: SocialPost[];
  success?: boolean;
  data?: SocialPost[];
  message?: string;
}

// ── Wikimedia Commons Geosearch fetcher ──────────────────────────────────────
async function fetchWikimediaPhotos(lat: number, lng: number, limit = 8): Promise<string[]> {
  try {
    const wikiGeosearchUrl = `https://commons.wikimedia.org/w/api.php?action=query&generator=geosearch&ggsnamespace=6&ggsradius=5000&ggscoord=${lat}|${lng}&ggslimit=${limit}&prop=imageinfo&iiprop=url&format=json&origin=*`;
    const wikiRes = await fetch(wikiGeosearchUrl, {
      headers: { 'User-Agent': 'PinPic/1.0 (support@pinpic.travel)' },
      next: { revalidate: 3600 }
    });
    if (!wikiRes.ok) return [];

    const wikiData = await wikiRes.json();
    const pages = Object.values(wikiData.query?.pages ?? {}) as { imageinfo?: { url: string }[] }[];
    return pages
      .map((p) => p.imageinfo?.[0]?.url)
      .filter((url): url is string => typeof url === 'string' && url.startsWith('http'));
  } catch (err) {
    console.error('[Wikimedia Fetch Failure]:', err);
    return [];
  }
}

// ── Flickr Photo Search fetcher ──────────────────────────────────────────────
async function fetchFlickrPhotos(lat: number, lng: number, limit = 8): Promise<string[]> {
  const apiKey = process.env.FLICKR_API_KEY;
  if (!apiKey) {
    console.warn("Flickr API fallback requested, but FLICKR_API_KEY is unconfigured.");
    return [];
  }

  try {
    const url = `https://www.flickr.com/services/rest/?method=flickr.photos.search&api_key=${apiKey}&lat=${lat}&lon=${lng}&radius=5&per_page=${limit}&format=json&nojsoncallback=1&extras=url_c,url_m,url_o`;
    const res = await fetch(url, { next: { revalidate: 3600 } });
    if (!res.ok) return [];

    const data = await res.json();
    if (data.stat !== 'ok') {
      console.warn('[Flickr API Error Response]:', data.message);
      return [];
    }

    const photosList = (data.photos?.photo ?? []) as { url_c?: string; url_m?: string; url_o?: string }[];
    return photosList
      .map((p) => p.url_c || p.url_m || p.url_o)
      .filter((url): url is string => typeof url === 'string' && url.startsWith('http'));
  } catch (err) {
    console.error('[Flickr Fetch Failure]:', err);
    return [];
  }
}

// ── GET request handler ──────────────────────────────────────────────────────
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const lat = searchParams.get('lat');
    const lng = searchParams.get('lng');
    const query = searchParams.get('query') || searchParams.get('q') || '';

    let latVal = lat ? parseFloat(lat) : null;
    let lngVal = lng ? parseFloat(lng) : null;
    let displayName = query || 'Coordinate Location';

    // Phase 1: Resolve Text Query to Coordinates via Nominatim
    if ((latVal === null || lngVal === null || isNaN(latVal) || isNaN(lngVal)) && query) {
      const geocodeUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`;
      const geocodeRes = await fetch(geocodeUrl, {
        headers: { 'User-Agent': 'PinPic/1.0 (support@pinpic.travel)' },
        next: { revalidate: 3600 }
      });
      if (geocodeRes.ok) {
        const results = await geocodeRes.json();
        if (results && results.length > 0) {
          latVal = parseFloat(results[0].lat);
          lngVal = parseFloat(results[0].lon);
          displayName = results[0].display_name || query;
        }
      }
    }

    if (latVal === null || lngVal === null || isNaN(latVal) || isNaN(lngVal)) {
      return NextResponse.json({ success: false, error: "Coordinates parameters or valid search query required." }, { status: 400 });
    }

    // Try reverse geocoding to retrieve a friendly display name if only coordinates were provided
    if (!query && lat && lng) {
      try {
        const reverseUrl = `https://nominatim.openstreetmap.org/reverse?lat=${latVal}&lon=${lngVal}&format=json`;
        const revRes = await fetch(reverseUrl, {
          headers: { 'User-Agent': 'PinPic/1.0 (support@pinpic.travel)' }
        });
        if (revRes.ok) {
          const revData = await revRes.json();
          displayName = revData.display_name || displayName;
        }
      } catch (e) {
        console.warn('[Reverse Geocode Failure]:', e);
      }
    }

    const shortName = displayName.split(',')[0] || displayName;

    // Phase 2: Check Database for Hotspot within 25 meters (ST_DWithin proximity check)
    const supabase = await createClient();
    const { data: nearbyHotspots, error: nearbyError } = await supabase.rpc('nearby_hotspots', {
      lat: latVal,
      lng: lngVal,
      radius_m: 25.0
    });

    if (nearbyError) {
      console.error('[Database RPC nearby_hotspots Error]:', nearbyError.message);
    }

    // If matching hotspots exist, map them to social posts suggestions
    if (nearbyHotspots && nearbyHotspots.length > 0) {
      const formattedSocialCards: SocialPost[] = nearbyHotspots.map((h: NearbyHotspot) => ({
        id: h.id,
        platform: "pinterest" as const,
        user_handle: `@pinpic.local`,
        likes_count: Math.floor(Math.random() * 2000) + 300,
        inspo_image_url: h.inspo_image_url,
        caption: h.description || `Seeded hotspot framing guide for ${h.title}.`,
        title: h.title
      }));

      return NextResponse.json({
        success: true,
        data: formattedSocialCards,
        lat: latVal,
        lng: lngVal,
        posts: formattedSocialCards
      });
    }

    // Phase 3: Hotspot Cache Miss -> Fetch Fresh Photos on Demand
    const fetchedUrls: string[] = [];
    const imageOrigins: ('wikimedia' | 'flickr')[] = [];

    // 1. Fetch Wikimedia Commons Geosearch
    const wikiPhotos = await fetchWikimediaPhotos(latVal, lngVal, 8);
    wikiPhotos.forEach((url) => {
      if (!fetchedUrls.includes(url)) {
        fetchedUrls.push(url);
        imageOrigins.push('wikimedia');
      }
    });

    // 2. Fallback to Flickr if Wikimedia returns less than 6 photos
    if (fetchedUrls.length < 6) {
      const flickrPhotos = await fetchFlickrPhotos(latVal, lngVal, 8);
      flickrPhotos.forEach((url) => {
        if (!fetchedUrls.includes(url)) {
          fetchedUrls.push(url);
          imageOrigins.push('flickr');
        }
      });
    }

    // Phase 4: Handle cases where no photos are found
    if (fetchedUrls.length === 0) {
      return NextResponse.json({
        success: true,
        data: [],
        lat: latVal,
        lng: lngVal,
        posts: [],
        message: "No public photos found here yet. Be the first to capture and save a composition!"
      });
    }

    // Phase 5: Write-Through Caching (Create Hotspot Row in DB)
    const bestPhoto = fetchedUrls[0];
    const originSource = imageOrigins[0];
    let cachedHotspotId = `custom_live_${Date.now()}`;

    try {
      const adminClient = await createAdminClient();

      // Double-check / re-query nearby_hotspots in transaction-like window to prevent duplicate rows race condition
      const { data: raceCheck } = await adminClient.rpc('nearby_hotspots', {
        lat: latVal,
        lng: lngVal,
        radius_m: 25.0
      });

      if (raceCheck && raceCheck.length > 0) {
        cachedHotspotId = raceCheck[0].id;
      } else {
        const { data: newHotspot, error: insertError } = await adminClient
          .from('hotspots')
          .insert({
            title: shortName,
            description: `Auto-cached composition guide near coordinates ${latVal.toFixed(5)}, ${lngVal.toFixed(5)}`,
            inspo_image_url: bestPhoto,
            location: {
              type: 'Point',
              coordinates: [lngVal, latVal]
            },
            source: originSource,
            license_source: originSource === 'wikimedia' ? 'Wikimedia-Commons-Geosearch' : 'Flickr-Photo-Search'
          })
          .select()
          .single();

        if (insertError) {
          console.error('[Write-Through Caching Failed]:', insertError.message);
        } else if (newHotspot) {
          cachedHotspotId = newHotspot.id;
        }
      }
    } catch (dbErr) {
      console.error('[Write-Through Caching Exception]:', dbErr);
    }

    // Map fetched photos to standard social posts list
    const formattedSocialCards: SocialPost[] = fetchedUrls.map((url, index) => ({
      id: index === 0 ? cachedHotspotId : `live_post_${index}_${Date.now()}`,
      platform: index % 2 === 0 ? "instagram" as const : "pinterest" as const,
      user_handle: `@pinpic.explorer`,
      likes_count: Math.floor(Math.random() * 3000) + 400,
      inspo_image_url: url,
      caption: `Real travel frame discovered at ${shortName}.`,
      title: shortName
    }));

    return NextResponse.json({
      success: true,
      data: formattedSocialCards,
      lat: latVal,
      lng: lngVal,
      posts: formattedSocialCards
    });

  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Unknown error";
    console.error('Critical On-Demand Search Route Failure:', errorMsg);
    return NextResponse.json({ success: false, error: "Internal processing loop exception encountered." }, { status: 500 });
  }
}
