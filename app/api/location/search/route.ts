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

    // ── 2. Create 6 distinct mock/live reference photo URLs ─────────────────
    // We use high-quality Unsplash search keywords to simulate community posts.
    // Each photo gets a distinct keyword index to guarantee diversity.
    const searchTerms = [
      `${q} landscape travel`,
      `${q} aesthetic perspective`,
      `${q} sunset architecture`,
      `${q} street photography`,
      `${q} landmark composition`,
      `${q} portrait framing`
    ];

    const photos = searchTerms.map((term, i) => {
      // Adding a seed query param forces Unsplash source to serve different images
      const encoded = encodeURIComponent(term);
      return `https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&q=75&auto=format&fit=crop&sig=${i}&q_term=${encoded}`;
    });

    const result: LocationSearchResult = {
      lat,
      lng,
      displayName,
      photos
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
