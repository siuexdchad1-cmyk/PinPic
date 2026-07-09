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
  distance?:       number; // Distance in meters
}

export interface LocationSearchResult {
  lat:   number;
  lng:   number;
  posts: SocialPost[];
  success?: boolean;
  data?: SocialPost[];
  message?: string;
}

interface FetchedPhoto {
  url: string;
  source: 'wikimedia' | 'flickr';
  lat: number;
  lng: number;
  distance: number; // in meters
  title?: string;
  caption?: string;
}

// ── Haversine formula for distance calculation ──────────────────────────────
function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000; // Earth radius in meters
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── Outdoor keyword exclusion list ──────────────────────────────────────────
const EXCLUDED_KEYWORDS = [
  'interior', 'inside', 'indoor', 'museum', 'room', 'ceiling', 'exhibit', 'hotel room', 'indoors', 'lobby', 'exhibition', 'bathroom', 'kitchen', 'bedroom'
];

function isOutdoorPhoto(photo: FetchedPhoto): boolean {
  const text = (photo.title + ' ' + (photo.caption || '')).toLowerCase();
  return !EXCLUDED_KEYWORDS.some((kw) => text.includes(kw));
}

// ── Wikimedia Commons Geosearch fetcher ──────────────────────────────────────
async function fetchWikimediaPhotos(
  userLat: number,
  userLng: number,
  radiusKm: number,
  limit = 24
): Promise<FetchedPhoto[]> {
  try {
    const radiusMeters = radiusKm * 1000;
    const wikiGeosearchUrl = `https://commons.wikimedia.org/w/api.php?action=query&generator=geosearch&ggsnamespace=6&ggsradius=${radiusMeters}&ggscoord=${userLat}|${userLng}&ggslimit=${limit}&prop=imageinfo|coordinates&iiprop=url&format=json&origin=*`;
    const wikiRes = await fetch(wikiGeosearchUrl, {
      headers: { 'User-Agent': 'PinPic/1.0 (support@pinpic.travel)' },
      next: { revalidate: 3600 }
    });
    if (!wikiRes.ok) return [];

    const wikiData = await wikiRes.json();
    if (!wikiData.query?.pages) return [];
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pages = Object.values(wikiData.query.pages) as any[];
    const result: FetchedPhoto[] = [];
    
    for (const p of pages) {
      const url = p.imageinfo?.[0]?.url;
      const coords = p.coordinates?.[0];
      if (!url || !url.startsWith('http') || !coords) continue;
      
      const photoLat = parseFloat(coords.lat);
      const photoLng = parseFloat(coords.lon);
      const distance = haversineDistance(userLat, userLng, photoLat, photoLng);
      
      result.push({
        url,
        source: 'wikimedia' as const,
        lat: photoLat,
        lng: photoLng,
        distance,
        title: p.title || ''
      });
    }
    
    return result;
  } catch (err) {
    console.error('[Wikimedia Fetch Failure]:', err);
    return [];
  }
}

// ── Flickr Photo Search fetcher ──────────────────────────────────────────────
async function fetchFlickrPhotos(
  userLat: number,
  userLng: number,
  radiusKm: number,
  limit = 24
): Promise<FetchedPhoto[]> {
  const apiKey = process.env.FLICKR_API_KEY;
  if (!apiKey) {
    console.warn("Flickr API fallback requested, but FLICKR_API_KEY is unconfigured.");
    return [];
  }

  try {
    const flickrRadius = Math.min(radiusKm, 32);
    const url = `https://www.flickr.com/services/rest/?method=flickr.photos.search&api_key=${apiKey}&lat=${userLat}&lon=${userLng}&radius=${flickrRadius}&geo_context=2&sort=interestingness-desc&per_page=${limit}&format=json&nojsoncallback=1&extras=geo,url_c,url_m,url_o`;
    const res = await fetch(url, { next: { revalidate: 3600 } });
    if (!res.ok) return [];

    const data = await res.json();
    if (data.stat !== 'ok') {
      console.warn('[Flickr API Error Response]:', data.message);
      return [];
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const photosList = (data.photos?.photo ?? []) as any[];
    const result: FetchedPhoto[] = [];

    for (const p of photosList) {
      const url = p.url_c || p.url_m || p.url_o;
      if (!url || !url.startsWith('http')) continue;
      
      const photoLat = parseFloat(p.latitude);
      const photoLng = parseFloat(p.longitude);
      const distance = haversineDistance(userLat, userLng, photoLat, photoLng);
      
      result.push({
        url,
        source: 'flickr' as const,
        lat: photoLat,
        lng: photoLng,
        distance,
        title: p.title || ''
      });
    }

    return result;
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
        title: h.title,
        distance: h.distance_m
      }));

      return NextResponse.json({
        success: true,
        data: formattedSocialCards,
        lat: latVal,
        lng: lngVal,
        posts: formattedSocialCards
      });
    }

    // Phase 3: Hotspot Cache Miss -> Fetch Fresh Photos on Demand with Progressive Radius Widening
    const radiusTiers = [5, 25, 50];
    let allPhotos: FetchedPhoto[] = [];
    for (const radius of radiusTiers) {
      
      const [wikiPhotos, flickrPhotos] = await Promise.all([
        fetchWikimediaPhotos(latVal, lngVal, radius, 30),
        fetchFlickrPhotos(latVal, lngVal, radius, 30)
      ]);

      const combined = [...wikiPhotos, ...flickrPhotos];
      const uniquePhotos: FetchedPhoto[] = [];
      const seenUrls = new Set<string>();

      for (const p of combined) {
        if (!seenUrls.has(p.url)) {
          seenUrls.add(p.url);
          uniquePhotos.push(p);
        }
      }

      // Apply the keyword exclusion filter at each tier
      const outdoorPhotos = uniquePhotos.filter(isOutdoorPhoto);

      if (outdoorPhotos.length >= 10) {
        allPhotos = outdoorPhotos;
        break; // Stop widening once results are found (at least 10 outdoor photos)
      } else {
        allPhotos = outdoorPhotos;
      }
    }

    // Phase 4: Handle cases where no outdoor photos are found even after 50km
    if (allPhotos.length === 0) {
      return NextResponse.json({
        success: true,
        data: [],
        lat: latVal,
        lng: lngVal,
        posts: [],
        message: "No outdoor inspo photos found near you yet"
      }, { status: 200 });
    }

    // Phase 5: Write-Through Caching (Create Hotspot Row in DB using closest photo)
    const sortedPhotos = [...allPhotos].sort((a, b) => a.distance - b.distance);
    const bestPhoto = sortedPhotos[0].url;
    const originSource = sortedPhotos[0].source;
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
    const formattedSocialCards: SocialPost[] = allPhotos.map((photo, index) => ({
      id: photo.url === bestPhoto ? cachedHotspotId : `live_post_${index}_${Date.now()}`,
      platform: index % 2 === 0 ? "instagram" as const : "pinterest" as const,
      user_handle: `@pinpic.explorer`,
      likes_count: Math.floor(Math.random() * 3000) + 400,
      inspo_image_url: photo.url,
      caption: `Real travel frame discovered at ${shortName}.`,
      title: shortName,
      distance: photo.distance
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
