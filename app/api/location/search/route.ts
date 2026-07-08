import { NextRequest, NextResponse } from 'next/server';

export interface LocationSearchResult {
  lat:         number;
  lng:         number;
  displayName: string;
  photos:      string[];
}

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

    if (!geocodeRes.ok) {
      throw new Error('Geocoding service unavailable.');
    }

    const results = await geocodeRes.json();
    if (!results || results.length === 0) {
      return NextResponse.json({ error: 'No locations found for this query.' }, { status: 404 });
    }

    const match = results[0];
    const lat = parseFloat(match.lat);
    const lng = parseFloat(match.lon);
    const displayName = match.display_name;

    // ── 2. Resolve geolocated photos (Wikimedia Commons + Unsplash) ────────
    let photos: string[] = [];

    try {
      // Geolocated Wikimedia search within 5km radius
      const wikiGeosearchUrl = `https://commons.wikimedia.org/w/api.php?action=query&list=geosearch&gsradius=5000&gscoord=${lat}|${lng}&gslimit=6&format=json&origin=*`;
      const wikiRes = await fetch(wikiGeosearchUrl, { next: { revalidate: 3600 } });
      
      if (wikiRes.ok) {
        const wikiData = await wikiRes.json();
        const pages = (wikiData.query?.geosearch ?? []) as { pageid: number }[];
        
        if (pages.length > 0) {
          const pageids = pages.map((p) => p.pageid).join('|');
          const imgUrlFetch = `https://commons.wikimedia.org/w/api.php?action=query&pageids=${pageids}&prop=imageinfo&iiprop=url&format=json&origin=*`;
          const imgRes = await fetch(imgUrlFetch, { next: { revalidate: 3600 } });
          
          if (imgRes.ok) {
            const imgData = await imgRes.json();
            const imgPages = Object.values(imgData.query?.pages ?? {}) as { imageinfo?: { url: string }[] }[];
            photos = imgPages
              .map((p) => p.imageinfo?.[0]?.url)
              .filter((url): url is string => typeof url === 'string' && url.startsWith('http'));
          }
        }
      }
    } catch (e) {
      console.warn('Wikimedia geosearch failed, using Unsplash fallback:', e);
    }

    // Fill remaining photos using dynamic Unsplash search endpoints to guarantee diversity
    if (photos.length < 6) {
      const searchTerms = [
        `${q} travel photography`,
        `${q} aesthetic view`,
        `${q} scenery landmark`,
        `${q} streets`,
        `${q} architecture`,
        `${q} landscape`
      ];

      const need = 6 - photos.length;
      for (let i = 0; i < need; i++) {
        const encoded = encodeURIComponent(searchTerms[i]);
        photos.push(`https://images.unsplash.com/featured/800x600/?${encoded}&sig=${i}`);
      }
    }

    const result: LocationSearchResult = {
      lat,
      lng,
      displayName,
      photos: photos.slice(0, 6)
    };

    return NextResponse.json(result);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Search failed. Try again.';
    console.error('[/api/location/search] Error:', msg);
    return NextResponse.json(
      { error: msg },
      { status: 500 }
    );
  }
}
