import { NextRequest, NextResponse } from 'next/server';

export interface SuggestedSpot {
  name:       string;
  type:       string;       // e.g. "viewpoint", "monument", "museum"
  imageUrl:   string;       // Unsplash Source URL — no key needed
  lat:        number;
  lng:        number;
  distanceM:  number;
}

interface OverpassElement {
  type: string;
  id:   number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags: Record<string, string>;
}

// Haversine distance in metres
function haversineM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6_371_000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const lat = parseFloat(searchParams.get('lat') ?? '');
  const lng = parseFloat(searchParams.get('lng') ?? '');

  if (isNaN(lat) || isNaN(lng)) {
    return NextResponse.json({ error: 'lat and lng required.' }, { status: 400 });
  }

  // ── 1. Reverse Geocode via Nominatim ──────────────────────────────────────
  let placeName = 'this location';
  let cityName  = '';
  try {
    const nominatimRes = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`,
      { headers: { 'User-Agent': 'PinPic/1.0 (educational project)' }, next: { revalidate: 3600 } }
    );
    const nominatim = await nominatimRes.json();
    const addr = nominatim.address ?? {};
    placeName  = nominatim.display_name?.split(',')[0] ?? 'this location';
    cityName   = addr.city ?? addr.town ?? addr.suburb ?? addr.village ?? addr.county ?? 'Unknown';
  } catch {
    // Nominatim failure is non-fatal
  }

  // ── 2. Overpass API — nearby points of interest ───────────────────────────
  const radiusM = 500; // 500-metre radius
  const overpassQuery = `
    [out:json][timeout:10];
    (
      node["tourism"~"viewpoint|attraction|museum|artwork|gallery"](around:${radiusM},${lat},${lng});
      node["historic"~"monument|ruins|castle|archaeological_site"](around:${radiusM},${lat},${lng});
      node["natural"~"peak|beach|cliff|waterfall|cave_entrance"](around:${radiusM},${lat},${lng});
      way["tourism"~"viewpoint|attraction|museum"](around:${radiusM},${lat},${lng});
    );
    out center 10;
  `;

  let spots: SuggestedSpot[] = [];

  try {
    const overpassRes = await fetch(
      'https://overpass-api.de/api/interpreter',
      {
        method:  'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body:    `data=${encodeURIComponent(overpassQuery)}`,
        next:    { revalidate: 300 },
      }
    );
    const overpass = await overpassRes.json();

    const elements: OverpassElement[] = overpass.elements ?? [];

    spots = elements
      .filter((el) => el.tags?.name)
      .map((el) => {
        const elLat = el.lat ?? el.center?.lat ?? lat;
        const elLng = el.lon ?? el.center?.lon ?? lng;
        const type  =
          el.tags.tourism ?? el.tags.historic ?? el.tags.natural ?? 'spot';
        const name  = el.tags.name ?? 'Unnamed Spot';

        // Compose a search query for an Unsplash photo
        const searchTerm  = encodeURIComponent(`${name} ${cityName} travel photography`);
        const imageUrl    = `https://images.unsplash.com/featured/800x600/?${searchTerm}`;

        return {
          name,
          type,
          imageUrl,
          lat:       elLat,
          lng:       elLng,
          distanceM: Math.round(haversineM(lat, lng, elLat, elLng)),
        };
      })
      .sort((a, b) => a.distanceM - b.distanceM)
      .slice(0, 6); // top 6 nearest
  } catch {
    // Overpass failure is non-fatal — return geocode info at minimum
  }

  return NextResponse.json({ placeName, cityName, spots });
}
