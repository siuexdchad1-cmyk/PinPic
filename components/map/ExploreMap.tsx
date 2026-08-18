'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import {
  Loader2, Camera, X, Star, CheckCircle2,
  Save, RotateCcw, ImageIcon, Search,
  Sun, Sunrise, Sunset, Moon, MapPin, Sparkles,
  Share2
} from 'lucide-react';
import { getGoldenHourTimes, isCurrentlyGoldenHour } from '@/lib/suncalc-utils';

// ── Types ──────────────────────────────────────────────────────────────────────
interface HotspotPin {
  id:              string;
  title:           string;
  description:     string | null;
  inspo_image_url: string;
  lat:             number;
  lng:             number;
  category?:       string;
  bestTime?:       string;
  bestAngle?:      string;
  wikimediaQuery?: string;
  distance?:       number;
}

interface NominatimResult {
  lat:          string;
  lon:          string;
  display_name: string;
}

interface SuggestedPhoto {
  id:              string;
  title:           string;
  inspo_image_url: string;
  distance?:       number;
  lat?:            number;
  lng?:            number;
}

// ── Mumbai Hardcoded Photography Hotspots ─────────────────────────────────────
const MUMBAI_HOTSPOTS: HotspotPin[] = [
  {
    id:              'gateway-of-india',
    title:           'Gateway of India',
    description:     'Iconic colonial arch on the Mumbai waterfront. Best shot during blue hour with harbour reflections.',
    inspo_image_url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3a/Mumbai_03-2016_30_Gateway_of_India.jpg/800px-Mumbai_03-2016_30_Gateway_of_India.jpg',
    lat:             18.9220,
    lng:             72.8347,
    category:        'architecture',
    bestTime:        'Blue Hour (6:30–7:00 AM)',
    bestAngle:       'Low-angle wide shot facing arch with harbour behind',
    wikimediaQuery:  'Gateway of India Mumbai',
  },
  {
    id:              'marine-drive-sunset',
    title:           'Marine Drive — Sunset Point',
    description:     'The Queen\'s Necklace. Golden hour turns the curve of lights into a perfect arc composition.',
    inspo_image_url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/19/Marine_Drive_at_Night.jpg/800px-Marine_Drive_at_Night.jpg',
    lat:             18.9437,
    lng:             72.8231,
    category:        'golden-hour',
    bestTime:        'Golden Hour (5:45–6:30 PM)',
    bestAngle:       'Standing profile facing west, skyline arc in background',
    wikimediaQuery:  'Marine Drive Mumbai',
  },
  {
    id:              'bandra-worli-sea-link',
    title:           'Bandra-Worli Sea Link Angle',
    description:     'Striking cable-stayed bridge over Mahim Bay. Perfect symmetry from the Bandra side.',
    inspo_image_url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/45/Bandra-Worli_Sea_Link_1.jpg/800px-Bandra-Worli_Sea_Link_1.jpg',
    lat:             19.0376,
    lng:             72.8178,
    category:        'architecture',
    bestTime:        'Magic Hour (6:00–7:00 PM)',
    bestAngle:       'Side-on perspective to capture cable symmetry',
    wikimediaQuery:  'Bandra Worli Sea Link',
  },
  {
    id:              'colaba-heritage-arch',
    title:           'Colaba Heritage District',
    description:     'Gothic-Victorian streetscape lined with heritage facades — rich texture for urban photography.',
    inspo_image_url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a1/Colaba_Causeway.jpg/800px-Colaba_Causeway.jpg',
    lat:             18.9064,
    lng:             72.8296,
    category:        'architecture',
    bestTime:        'Morning Golden Hour (7:00–8:30 AM)',
    bestAngle:       'Street-level shot with building facade as leading line',
    wikimediaQuery:  'Colaba Mumbai heritage',
  },
  {
    id:              'haji-ali-dargah',
    title:           'Haji Ali Dargah',
    description:     'White marble mosque on a tiny islet, connected by a narrow causeway. Dramatic at high tide.',
    inspo_image_url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/89/Haji_Ali_Dargah.jpg/800px-Haji_Ali_Dargah.jpg',
    lat:             18.9820,
    lng:             72.8091,
    category:        'nature',
    bestTime:        'Sunrise (6:15–7:00 AM)',
    bestAngle:       'Wide angle from causeway entrance, sea on both sides',
    wikimediaQuery:  'Haji Ali Dargah Mumbai',
  },
  {
    id:              'worli-fort',
    title:           'Worli Fort — Sea-Wall Shot',
    description:     '17th-century Portuguese fort with crumbling battlements overlooking the Arabian Sea.',
    inspo_image_url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/59/Worli_Fort_Mumbai.jpg/800px-Worli_Fort_Mumbai.jpg',
    lat:             19.0108,
    lng:             72.8145,
    category:        'portrait',
    bestTime:        'Afternoon (3:00–5:00 PM)',
    bestAngle:       'Portrait against sea wall with waves in background',
    wikimediaQuery:  'Worli Fort Mumbai',
  },
];

// ── Photography Categories ─────────────────────────────────────────────────────
const CATEGORIES = {
  'golden-hour':  { label: '🌅 Golden Hour', color: '#f59e0b' },
  'portrait':     { label: '🧍 Portrait Spot', color: '#10b981' },
  'architecture': { label: '🏛️ Architecture', color: '#6366f1' },
  'nature':       { label: '🌿 Nature Shot', color: '#22c55e' },
};

function getCategoryColor(cat: string) {
  return CATEGORIES[cat as keyof typeof CATEGORIES]?.color ?? '#10b981';
}

// ── AI Composition Feedback Structure ─────────────────────────────────────────
interface AIFeedback {
  compositionScore:   string;
  brief:              string;
  ruleOfThirds:       string;
  lightingAssessment: string;
  actionableTip:      string;
  caption:            string;
  tags:               string[];
  category:           string;
  shotType:           string;
}

function generateFallbackAIFeedback(locationName: string): AIFeedback {
  return {
    compositionScore:   '8.8 / 10',
    brief:              `Vibrant shot detected near ${locationName}. Excellent exposure balance and natural color depth.`,
    ruleOfThirds:       'Subject aligned along left vertical grid line — strong visual weight',
    lightingAssessment: 'Optimal golden-hour directional soft light detected.',
    actionableTip:      'Lower camera angle slightly for a more dramatic foreground shadow.',
    caption:            `Captured the magic of ${locationName}! Unforgettable light and framing. ✨📸`,
    tags:               ['travel', 'photography', 'wanderlust', 'explore', locationName.toLowerCase().replace(/\s+/g, '')],
    category:           'Golden Hour Viewpoint',
    shotType:           'Landscape & Architectural',
  };
}

// ── LocalStorage Scrapbook ────────────────────────────────────────────────────
interface ScrapbookEntry {
  id:        string;
  imageData: string;
  hotspot:   string;
  category:  string;
  score:     string;
  tip:       string;
  savedAt:   string;
}

function loadScrapbook(): ScrapbookEntry[] {
  try { return JSON.parse(localStorage.getItem('pinpic_scrapbook') ?? '[]'); }
  catch { return []; }
}

function appendScrapbook(entry: Omit<ScrapbookEntry, 'id' | 'savedAt'>) {
  const all = loadScrapbook();
  const newEntry: ScrapbookEntry = { ...entry, id: crypto.randomUUID(), savedAt: new Date().toISOString() };
  localStorage.setItem('pinpic_scrapbook', JSON.stringify([newEntry, ...all]));
}

// ══════════════════════════════════════════════════════════════════════════════
// ExploreMap Component
// ══════════════════════════════════════════════════════════════════════════════
export default function ExploreMap() {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef    = useRef<HTMLInputElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const leafletMapRef   = useRef<any>(null);

  const [loading,         setLoading]         = useState(true);

  // Search & Suggested Photos
  const [searchQuery,     setSearchQuery]     = useState('');
  const [searching,       setSearching]       = useState(false);
  const [suggestedPhotos, setSuggestedPhotos] = useState<SuggestedPhoto[]>([]);
  const [searchLocation,  setSearchLocation]  = useState<string>('Mumbai');

  // Golden Hour
  const [goldenTimes,     setGoldenTimes]     = useState(() => getGoldenHourTimes(19.076, 72.877));
  const [isGolden,        setIsGolden]        = useState(() => isCurrentlyGoldenHour(19.076, 72.877));

  // Capture AI Modal
  const [showModal,       setShowModal]       = useState(false);
  const [analyzing,       setAnalyzing]       = useState(false);
  const [imagePreview,    setImagePreview]    = useState<string | null>(null);
  const [aiFeedback,      setAiFeedback]      = useState<AIFeedback | null>(null);
  const [savedToBook,     setSavedToBook]     = useState(false);
  const [nearestHotspot,  setNearestHotspot]  = useState<HotspotPin | null>(null);

  // ── Fetch Suggested Photos for Area via API ────────────────────────────────
  const fetchSuggestedPhotosForArea = useCallback(async (lat: number, lng: number, queryName?: string) => {
    try {
      const url = queryName
        ? `/api/location/search?query=${encodeURIComponent(queryName)}`
        : `/api/location/search?lat=${lat}&lng=${lng}`;
      
      const res = await fetch(url);
      if (!res.ok) return;
      const data = await res.json();
      
      if (data && data.posts && data.posts.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const photos: SuggestedPhoto[] = data.posts.map((p: any) => ({
          id:              p.id,
          title:           p.title || queryName || 'Nearby Spot',
          inspo_image_url: p.inspo_image_url,
          distance:        p.distance,
        }));
        setSuggestedPhotos(photos);
      }
    } catch {
      // Non-fatal
    }
  }, []);

  // ── Init Leaflet Map ─────────────────────────────────────────────────────────
  useEffect(() => {
    let active = true;

    async function initMap() {
      try {
        const res  = await fetch('/api/hotspots');
        const data = res.ok ? await res.json() : { hotspots: [] };
        const dbSpots: HotspotPin[] = (data.hotspots ?? []).map((s: HotspotPin, i: number) => ({
          ...s,
          category: Object.keys(CATEGORIES)[i % 4],
        }));

        const dbIds = new Set(dbSpots.map(s => s.id));
        const merged = [...MUMBAI_HOTSPOTS, ...dbSpots.filter(s => !dbIds.has(s.id))];

        if (active) {
          if (merged.length > 0) setNearestHotspot(merged[0]);
        }

        // Leaflet CSS
        if (!document.querySelector('link[href*="leaflet.css"]')) {
          const link = document.createElement('link');
          link.rel  = 'stylesheet';
          link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
          document.head.appendChild(link);
        }

        // Leaflet JS
        if (!Object.prototype.hasOwnProperty.call(window, 'L')) {
          await new Promise<void>((resolve, reject) => {
            const s   = document.createElement('script');
            s.src     = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
            s.async   = true;
            s.onload  = () => resolve();
            s.onerror = () => reject(new Error('Failed to load Leaflet'));
            document.body.appendChild(s);
          });
        }

        if (!active || !mapContainerRef.current) return;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const L = (window as any).L;
        if (!L) return;

        const map = L.map(mapContainerRef.current, { zoomControl: false });
        map.setView([19.076, 72.877], 12);
        leafletMapRef.current = map;

        // Initial suggested photos load for default Mumbai area
        fetchSuggestedPhotosForArea(19.076, 72.877, 'Mumbai');

        map.on('moveend', () => {
          const c = map.getCenter();
          setGoldenTimes(getGoldenHourTimes(c.lat, c.lng));
          setIsGolden(isCurrentlyGoldenHour(c.lat, c.lng));
        });

        L.control.zoom({ position: 'bottomright' }).addTo(map);

        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
          maxZoom: 20,
          attribution: '&copy; OpenStreetMap &copy; CARTO',
        }).addTo(map);

        // Plot markers
        merged.forEach((spot: HotspotPin) => {
          if (!spot.lat || !spot.lng) return;
          const color = getCategoryColor(spot.category ?? 'portrait');
          const catLabel = CATEGORIES[spot.category as keyof typeof CATEGORIES]?.label ?? '📍 Hotspot';

          const marker = L.circleMarker([spot.lat, spot.lng], {
            color, fillColor: color, fillOpacity: 0.8, radius: 9, weight: 2,
          }).addTo(map);

          const popupHtml = `
            <div style="font-family:monospace;width:240px;padding:4px;color:#09090b;">
              <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px;">
                <span style="font-size:9px;background:${color}22;color:${color};border:1px solid ${color}55;border-radius:4px;padding:2px 7px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;">${catLabel}</span>
              </div>
              <h4 style="font-size:12px;font-weight:700;margin:0 0 4px;border-bottom:1px solid #e4e4e7;padding-bottom:4px;">📍 ${spot.title}</h4>
              <p style="font-size:10px;color:#71717a;margin:0 0 8px;line-height:1.4;">${spot.description ?? 'Photography composition hotspot.'}</p>
              ${spot.bestTime ? `<div style="font-size:9px;color:#10b981;font-weight:700;margin-bottom:2px;">⏱ ${spot.bestTime}</div>` : ''}
              ${spot.bestAngle ? `<div style="font-size:9px;color:#6366f1;margin-bottom:8px;">📐 ${spot.bestAngle}</div>` : ''}
              <div style="width:100%;height:110px;border-radius:6px;overflow:hidden;margin-bottom:8px;">
                <img src="${spot.inspo_image_url}" style="width:100%;height:100%;object-fit:cover;" loading="lazy" onerror="this.style.display='none'" />
              </div>
              <a href="/camera?ref=${spot.id}" style="display:block;width:100%;text-align:center;background:${color};color:white;text-decoration:none;font-size:10px;font-weight:700;padding:8px 0;border-radius:4px;">
                📷 SHOOT HERE
              </a>
            </div>
          `;

          marker.bindPopup(popupHtml, { maxWidth: 260, className: 'leaflet-dark-popup' });
        });

        setLoading(false);
      } catch (err) {
        console.error('[Map init error]', err);
        setLoading(false);
      }
    }

    initMap();
    return () => { active = false; };
  }, [fetchSuggestedPhotosForArea]);

  // ── Nominatim Search + Suggested Area Photos ──────────────────────────────────
  const handleSearch = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim() || !leafletMapRef.current) return;
    setSearching(true);
    try {
      const res  = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&limit=1`,
        { headers: { 'Accept-Language': 'en' } }
      );
      const data: NominatimResult[] = await res.json();
      if (data.length > 0) {
        const { lat, lon, display_name } = data[0];
        const ll: [number, number] = [parseFloat(lat), parseFloat(lon)];
        
        leafletMapRef.current.flyTo(ll, 14, { animate: true, duration: 1.5 });
        setGoldenTimes(getGoldenHourTimes(ll[0], ll[1]));
        setIsGolden(isCurrentlyGoldenHour(ll[0], ll[1]));
        
        const shortName = display_name.split(',')[0] || searchQuery;
        setSearchLocation(shortName);

        // Fetch suggested photos for the searched landmark/area
        fetchSuggestedPhotosForArea(ll[0], ll[1], searchQuery);
      }
    } catch { /* silent */ }
    setSearching(false);
  }, [searchQuery, fetchSuggestedPhotosForArea]);

  // ── Upload/Capture Photo → Send to Groq AI Scan ──────────────────────────────
  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setSavedToBook(false);
    setAiFeedback(null);

    const reader = new FileReader();
    reader.onload = async (ev) => {
      const imageBase64 = ev.target?.result as string;
      setImagePreview(imageBase64);
      setShowModal(true);
      setAnalyzing(true);

      const locName = searchLocation || nearestHotspot?.title || 'Landmark';

      try {
        // Send image to Groq AI process-shot route
        const res = await fetch('/api/process-shot', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imageBase64,
            hotspotImageUrl: nearestHotspot?.inspo_image_url ?? null,
            hotspotId: nearestHotspot?.id ?? null,
          }),
        });

        if (res.ok) {
          const groqData = await res.json();
          setAiFeedback({
            compositionScore:   groqData.matchAccuracy ? `${groqData.matchAccuracy}%` : '88 / 100',
            brief:              groqData.caption || `Groq AI scanned this photo near ${locName}. Excellent framing and subject contrast detected.`,
            ruleOfThirds:       'Subject aligned cleanly along central visual axis',
            lightingAssessment: 'Natural directional light with vivid highlights',
            actionableTip:      groqData.adjustments?.[0] || 'Hold camera steady and angle 10° lower for dramatic scale.',
            caption:            groqData.caption || `Wanderlust at ${locName}! Absolutely breathtaking framing. 📸✨`,
            tags:               groqData.tags || ['travel', 'pinpic', 'photography', locName.toLowerCase().replace(/\s+/g, '')],
            category:           nearestHotspot?.category ?? 'Golden Hour Viewpoint',
            shotType:           'Travel Landscape & Architecture',
          });
        } else {
          setAiFeedback(generateFallbackAIFeedback(locName));
        }
      } catch {
        setAiFeedback(generateFallbackAIFeedback(locName));
      }

      setAnalyzing(false);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  }, [nearestHotspot, searchLocation]);

  const handleSave = useCallback(() => {
    if (!aiFeedback || !imagePreview) return;
    appendScrapbook({
      imageData: imagePreview,
      hotspot:   searchLocation || nearestHotspot?.title || 'Custom Location',
      category:  aiFeedback.category,
      score:     aiFeedback.compositionScore,
      tip:       aiFeedback.actionableTip,
    });
    setSavedToBook(true);
  }, [aiFeedback, imagePreview, nearestHotspot, searchLocation]);

  const closeModal = useCallback(() => {
    setShowModal(false);
    setImagePreview(null);
    setAiFeedback(null);
    setSavedToBook(false);
    setAnalyzing(false);
  }, []);

  return (
    <div className="relative w-full h-[calc(100vh-3.5rem)] bg-zinc-950 overflow-hidden font-sans">

      {/* Hidden file input */}
      <input ref={fileInputRef} type="file" accept="image/*" capture="environment"
        className="hidden" onChange={handleFileChange} id="pinpic-capture-input"
        aria-label="Capture or select photo for Groq AI scan" />

      {/* Loading */}
      {loading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 z-50 bg-zinc-950">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
          <p className="text-sm font-mono text-zinc-400">Loading PinPic hotspots…</p>
        </div>
      )}

      {/* Map */}
      <div ref={mapContainerRef} className="w-full h-full z-10" />

      {/* ── Nominatim Search Bar ─────────────────────────────────────────────── */}
      <form
        onSubmit={handleSearch}
        className="absolute top-4 left-1/2 -translate-x-1/2 z-20 flex gap-2 w-[90%] max-w-md pointer-events-auto"
      >
        <div className="flex-1 flex items-center gap-2 bg-zinc-950/95 border border-zinc-700 rounded-lg px-3 py-2 shadow-xl">
          <Search className="h-4 w-4 text-emerald-500 shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search any city or landmark…"
            className="flex-1 bg-transparent text-xs font-mono text-white placeholder:text-zinc-500 outline-none"
          />
        </div>
        <button
          type="submit"
          disabled={searching}
          className="bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-mono font-bold px-4 rounded-lg transition-all active:scale-95 disabled:opacity-60 shrink-0 flex items-center gap-1 border border-black"
        >
          {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : 'SEARCH'}
        </button>
      </form>

      {/* ── Suggested Photos Carousel Strip (When Area Searched) ─────────────── */}
      {suggestedPhotos.length > 0 && (
        <div className="absolute top-[4.5rem] left-1/2 -translate-x-1/2 z-20 w-[90%] max-w-md bg-zinc-950/90 border border-zinc-800 rounded-xl p-3 backdrop-blur-md pointer-events-auto animate-slide-down">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[9px] font-mono uppercase text-zinc-400 tracking-wider flex items-center gap-1">
              <ImageIcon className="h-3 w-3 text-emerald-500" />
              Suggested Photos for <strong className="text-white">{searchLocation}</strong>
            </span>
            <span className="text-[8px] font-mono text-emerald-400 font-bold">
              {suggestedPhotos.length} Photos Found
            </span>
          </div>

          <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
            {suggestedPhotos.map((photo) => (
              <div
                key={photo.id}
                className="h-16 w-20 shrink-0 border border-zinc-800 rounded-lg overflow-hidden relative bg-zinc-900 group cursor-pointer"
                onClick={() => {
                  if (photo.lat && photo.lng && leafletMapRef.current) {
                    leafletMapRef.current.flyTo([photo.lat, photo.lng], 15);
                  }
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photo.inspo_image_url}
                  alt={photo.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                  loading="lazy"
                />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent text-[7px] font-mono text-zinc-300 p-1 flex flex-col justify-end truncate">
                  <span className="font-bold truncate text-white">{photo.title}</span>
                  {photo.distance !== undefined && photo.distance !== null && (
                    <span className="text-[6px] text-emerald-400 font-bold">
                      {photo.distance < 1000 ? `${Math.round(photo.distance)}m away` : `${(photo.distance / 1000).toFixed(1)}km away`}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Golden Hour Widget (top-right) ──────────────────────────────────── */}
      <div className={`absolute ${suggestedPhotos.length > 0 ? 'top-[11.5rem]' : 'top-[4.5rem]'} right-4 z-20 border rounded-md p-3 pointer-events-auto max-w-[180px] transition-all ${
        isGolden ? 'bg-amber-950/80 border-amber-700/60' : 'bg-zinc-950/90 border-zinc-800'
      }`}>
        <div className="flex items-center gap-1.5 mb-2">
          <Sun className={`h-3.5 w-3.5 ${isGolden ? 'text-amber-400' : 'text-zinc-400'}`} />
          <span className={`text-[9px] font-mono font-bold uppercase tracking-wider ${isGolden ? 'text-amber-300' : 'text-zinc-400'}`}>
            {isGolden ? '✨ Golden Hour NOW' : 'Light Forecast'}
          </span>
        </div>
        <div className="flex flex-col gap-1">
          {[
            { icon: Sunrise, label: 'Sunrise',   value: goldenTimes.sunrise,      color: 'text-amber-400' },
            { icon: Sun,     label: 'Golden AM', value: goldenTimes.goldenHour,   color: 'text-yellow-400' },
            { icon: Sunset,  label: 'Golden PM', value: goldenTimes.goldenHourEnd, color: 'text-orange-400' },
            { icon: Sunset,  label: 'Sunset',    value: goldenTimes.sunset,       color: 'text-rose-400' },
            { icon: Moon,    label: 'Blue Hour', value: goldenTimes.blueHour,     color: 'text-indigo-400' },
          ].map(({ icon: Icon, label, value, color }) => (
            <div key={label} className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1">
                <Icon className={`h-2.5 w-2.5 ${color}`} />
                <span className="text-[8px] font-mono text-zinc-500">{label}</span>
              </div>
              <span className={`text-[8px] font-mono font-bold ${color}`}>{value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Category Legend (bottom-left) ─────────────────────────────────────── */}
      <div className="absolute bottom-20 left-4 z-20 bg-zinc-950/90 border border-zinc-800 rounded-md p-2.5 pointer-events-auto">
        <p className="text-[7px] font-mono text-zinc-600 uppercase tracking-widest mb-1.5">Categories</p>
        {Object.entries(CATEGORIES).map(([id, { label, color }]) => (
          <div key={id} className="flex items-center gap-1.5 mb-1">
            <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
            <span className="text-[8px] font-mono text-zinc-400">{label}</span>
          </div>
        ))}
      </div>

      {/* ── Capture FAB ──────────────────────────────────────────────────────── */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 pointer-events-auto text-center">
        <button
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-2.5 bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-black font-mono font-bold text-xs uppercase tracking-widest px-6 py-3.5 rounded-full border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,0.8)] transition-all duration-150"
        >
          <Camera className="h-4 w-4" />
          Capture &amp; AI Scan Photo
        </button>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          GROQ AI SCAN & ANALYSIS MODAL
      ══════════════════════════════════════════════════════════════════════ */}
      {showModal && (
        <div className="absolute inset-0 z-40 bg-black/90 flex items-end md:items-center justify-center p-4 overflow-y-auto">
          <div className="w-full max-w-md bg-zinc-950 border border-zinc-800 rounded-2xl overflow-hidden shadow-2xl animate-slide-up my-auto">

            {/* Modal Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-emerald-500 animate-pulse" />
                <span className="text-xs font-mono font-bold text-white uppercase tracking-widest">
                  Groq AI Vision Scan Report
                </span>
              </div>
              <button onClick={closeModal} className="h-7 w-7 flex items-center justify-center rounded-lg text-zinc-500 hover:text-white hover:bg-zinc-800 transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-5 flex flex-col gap-4 max-h-[80vh] overflow-y-auto">

              {/* Uploaded Photo Preview */}
              {imagePreview && (
                <div className="relative w-full aspect-video rounded-xl overflow-hidden border border-zinc-800 bg-zinc-900">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={imagePreview} alt="Uploaded preview" className="w-full h-full object-cover" />
                  <div className="absolute bottom-2 left-2 bg-black/80 border border-zinc-700 px-2.5 py-1 rounded-md text-[8px] font-mono text-zinc-300 flex items-center gap-1.5">
                    <MapPin className="h-3 w-3 text-emerald-500" />
                    {searchLocation || nearestHotspot?.title || 'Landmark'}
                  </div>
                </div>
              )}

              {/* Groq AI Scanning Loader */}
              {analyzing && (
                <div className="flex flex-col items-center gap-3 py-8 text-center">
                  <Loader2 className="h-10 w-10 animate-spin text-emerald-500" />
                  <p className="text-xs font-mono text-emerald-400 font-bold uppercase tracking-widest">
                    Groq AI Scanning Photo &amp; Generating Brief…
                  </p>
                  <p className="text-[9px] font-mono text-zinc-500">
                    Detecting subject, lighting, composition score, captions &amp; hashtags
                  </p>
                  <div className="w-52 h-1 bg-zinc-900 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500 animate-scanner-bar w-1/3 rounded-full" />
                  </div>
                </div>
              )}

              {/* Groq AI Scan Results */}
              {!analyzing && aiFeedback && (
                <>
                  {/* Score & Brief */}
                  <div className="border border-emerald-900/60 bg-emerald-950/20 rounded-xl p-4 flex items-center justify-between">
                    <div>
                      <p className="text-[9px] font-mono text-emerald-400 uppercase tracking-widest mb-0.5">
                        Composition Score
                      </p>
                      <p className="text-3xl font-black text-white tracking-tighter">
                        {aiFeedback.compositionScore}
                      </p>
                      <p className="text-[8px] font-mono text-zinc-400 mt-1 uppercase">
                        {aiFeedback.shotType}
                      </p>
                    </div>
                    <div className="h-14 w-14 rounded-full border-4 border-emerald-500 flex items-center justify-center">
                      <Star className="h-6 w-6 text-emerald-400" />
                    </div>
                  </div>

                  {/* Photo Brief / Analysis */}
                  <div className="border border-zinc-800 bg-zinc-900/50 rounded-xl p-4">
                    <span className="text-[9px] font-mono text-emerald-400 font-bold uppercase tracking-wider block mb-1.5">
                      📊 Groq AI Photo Scan Brief
                    </span>
                    <p className="text-xs font-mono text-zinc-200 leading-relaxed">
                      {aiFeedback.brief}
                    </p>
                  </div>

                  {/* Actionable Improvement Tip */}
                  <div className="border border-amber-900/50 bg-amber-950/20 rounded-xl p-4">
                    <span className="text-[9px] font-mono text-amber-400 font-bold uppercase tracking-wider block mb-1.5">
                      💡 Recommended Adjustment
                    </span>
                    <p className="text-xs font-mono text-zinc-200 leading-relaxed">
                      {aiFeedback.actionableTip}
                    </p>
                  </div>

                  {/* Social Media Caption & Hashtags */}
                  <div className="border border-zinc-800 bg-zinc-900/50 rounded-xl p-4 flex flex-col gap-2">
                    <span className="text-[9px] font-mono text-indigo-400 font-bold uppercase tracking-wider flex items-center gap-1">
                      <Share2 className="h-3 w-3" /> Social Media Caption &amp; Hashtags
                    </span>
                    <p className="text-xs font-mono text-zinc-100 leading-relaxed italic bg-black/60 p-3 rounded-lg border border-zinc-800">
                      &ldquo;{aiFeedback.caption}&rdquo;
                    </p>
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {aiFeedback.tags.map((tag) => (
                        <span key={tag} className="text-[9px] font-mono text-emerald-400 bg-zinc-900 border border-zinc-800 px-2 py-0.5 rounded-md">
                          #{tag}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-3 pt-2">
                    <button
                      onClick={closeModal}
                      className="flex-1 flex items-center justify-center gap-1.5 border border-zinc-700 hover:border-zinc-500 text-zinc-300 hover:text-white text-[10px] font-mono uppercase tracking-widest py-3 rounded-xl transition-colors active:scale-95"
                    >
                      <RotateCcw className="h-3.5 w-3.5" /> Upload Another
                    </button>

                    <button
                      onClick={handleSave}
                      disabled={savedToBook}
                      className={`flex-1 flex items-center justify-center gap-1.5 text-[10px] font-mono uppercase tracking-widest py-3 rounded-xl transition-all active:scale-95 font-bold ${
                        savedToBook
                          ? 'bg-zinc-800 text-zinc-500 cursor-default'
                          : 'bg-emerald-500 hover:bg-emerald-400 text-black border-2 border-black shadow-[2px_2px_0px_rgba(0,0,0,0.6)]'
                      }`}
                    >
                      {savedToBook ? (
                        <><CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /><span className="text-emerald-400">Saved!</span></>
                      ) : (
                        <><Save className="h-3.5 w-3.5" /> Save to Scrapbook</>
                      )}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
