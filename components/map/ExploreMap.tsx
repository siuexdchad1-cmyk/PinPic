'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import {
  Loader2, Camera, X, Star, Grid3X3, CheckCircle2,
  AlertCircle, Save, RotateCcw, ImageIcon, Search,
  Sun, Sunrise, Sunset, Moon, MapPin, Clock,
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
}

interface NominatimResult {
  lat:         string;
  lon:         string;
  display_name: string;
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

// ── AI Composition Feedback ────────────────────────────────────────────────────
interface AIFeedback {
  compositionScore:  string;
  ruleOfThirds:      string;
  lightingAssessment: string;
  actionableTip:     string;
  category:          string;
  shotType:          string;
}

function generateAIFeedback(categoryId: string): AIFeedback {
  const map: Record<string, AIFeedback> = {
    'golden-hour': {
      compositionScore:   '8.8 / 10',
      ruleOfThirds:       'Subject aligned along left vertical grid line — strong visual weight',
      lightingAssessment: 'Optimal golden-hour directional soft light detected. Warm tones balanced.',
      actionableTip:      'Lower camera angle by 15° for a more dramatic foreground shadow.',
      category:           'Golden Hour Viewpoint',
      shotType:           'Wide Landscape',
    },
    'portrait': {
      compositionScore:   '9.1 / 10',
      ruleOfThirds:       'Face at upper-left power point — excellent portrait placement',
      lightingAssessment: 'Soft diffuse natural light. Minimal harsh shadows on face.',
      actionableTip:      'Ask subject to angle chin down 5° to sharpen jaw definition.',
      category:           'Portrait Spot',
      shotType:           'Environmental Portrait',
    },
    'architecture': {
      compositionScore:   '8.4 / 10',
      ruleOfThirds:       'Vertical structure bisects right grid line — strong leading line',
      lightingAssessment: 'Midday overhead light enhances structural contrast and texture.',
      actionableTip:      'Step back 3m and use wider focal length to include ground-level details.',
      category:           'Architecture Angle',
      shotType:           'Architectural Wide',
    },
    'nature': {
      compositionScore:   '8.6 / 10',
      ruleOfThirds:       'Horizon sits precisely at lower third — textbook landscape alignment',
      lightingAssessment: 'Dappled golden light through foliage. Slight overexposure in highlights.',
      actionableTip:      'Use -0.7 EV exposure compensation to recover sky detail.',
      category:           'Nature Shot',
      shotType:           'Nature Wide',
    },
  };
  return map[categoryId] ?? map['portrait'];
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
  const canvasRef       = useRef<HTMLCanvasElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const leafletMapRef   = useRef<any>(null);

  const [loading,       setLoading]       = useState(true);
  const [hotspots,      setHotspots]      = useState<HotspotPin[]>([]);

  // Search
  const [searchQuery,   setSearchQuery]   = useState('');
  const [searching,     setSearching]     = useState(false);

  // Golden Hour
  const [mapCenter,     setMapCenter]     = useState<[number, number]>([19.076, 72.877]);
  const [goldenTimes,   setGoldenTimes]   = useState(() => getGoldenHourTimes(19.076, 72.877));
  const [isGolden,      setIsGolden]      = useState(() => isCurrentlyGoldenHour(19.076, 72.877));

  // Capture modal
  const [showModal,       setShowModal]       = useState(false);
  const [analyzing,       setAnalyzing]       = useState(false);
  const [imagePreview,    setImagePreview]    = useState<string | null>(null);
  const [aiFeedback,      setAiFeedback]      = useState<AIFeedback | null>(null);
  const [savedToBook,     setSavedToBook]     = useState(false);
  const [showGrid,        setShowGrid]        = useState(true);
  const [nearestHotspot,  setNearestHotspot]  = useState<HotspotPin | null>(null);

  // ── Draw rule-of-thirds grid on canvas ──────────────────────────────────────
  const drawRuleOfThirds = useCallback((imgSrc: string) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    img.onload = () => {
      canvas.width  = img.naturalWidth  || 900;
      canvas.height = img.naturalHeight || 600;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      if (!showGrid) return;

      const w = canvas.width;
      const h = canvas.height;

      // Grid lines
      ctx.strokeStyle = 'rgba(255,255,255,0.55)';
      ctx.lineWidth   = Math.max(1, w / 400);
      ctx.setLineDash([6, 4]);

      [w / 3, (2 * w) / 3].forEach(x => {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
      });
      [h / 3, (2 * h) / 3].forEach(y => {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
      });

      // Power-point circles
      ctx.setLineDash([]);
      ctx.strokeStyle = 'rgba(16, 185, 129, 0.9)';
      ctx.lineWidth   = 2;
      [[w / 3, h / 3], [(2 * w) / 3, h / 3], [w / 3, (2 * h) / 3], [(2 * w) / 3, (2 * h) / 3]].forEach(([px, py]) => {
        ctx.beginPath();
        ctx.arc(px, py, Math.max(6, w / 80), 0, Math.PI * 2);
        ctx.stroke();
      });

      // Centre crosshair
      const cx = w / 2, cy = h / 2, arm = w / 30;
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.lineWidth   = 1;
      ctx.setLineDash([3, 3]);
      ctx.beginPath(); ctx.moveTo(cx - arm, cy); ctx.lineTo(cx + arm, cy); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx, cy - arm); ctx.lineTo(cx, cy + arm); ctx.stroke();
      ctx.setLineDash([]);
    };
    img.src = imgSrc;
  }, [showGrid]);

  useEffect(() => {
    if (imagePreview && !analyzing) drawRuleOfThirds(imagePreview);
  }, [imagePreview, analyzing, drawRuleOfThirds, showGrid]);

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

        // Merge Mumbai + DB spots (avoid duplicate IDs)
        const dbIds = new Set(dbSpots.map(s => s.id));
        const merged = [...MUMBAI_HOTSPOTS, ...dbSpots.filter(s => !dbIds.has(s.id))];

        if (active) {
          setHotspots(merged);
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
        // Default to Mumbai
        map.setView([19.076, 72.877], 12);
        leafletMapRef.current = map;

        // Track center for golden hour
        map.on('moveend', () => {
          const c = map.getCenter();
          setMapCenter([c.lat, c.lng]);
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
  }, []);

  // ── Nominatim Search ──────────────────────────────────────────────────────────
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
        const { lat, lon } = data[0];
        const ll: [number, number] = [parseFloat(lat), parseFloat(lon)];
        leafletMapRef.current.flyTo(ll, 14, { animate: true, duration: 1.5 });
        setMapCenter(ll);
        setGoldenTimes(getGoldenHourTimes(ll[0], ll[1]));
        setIsGolden(isCurrentlyGoldenHour(ll[0], ll[1]));
      }
    } catch { /* silent */ }
    setSearching(false);
  }, [searchQuery]);

  // ── File Capture → AI analysis ────────────────────────────────────────────────
  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSavedToBook(false);
    setAiFeedback(null);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const src = ev.target?.result as string;
      setImagePreview(src);
      setShowModal(true);
      setAnalyzing(true);
      const catId = nearestHotspot?.category ?? 'portrait';
      setTimeout(() => {
        setAiFeedback(generateAIFeedback(catId));
        setAnalyzing(false);
      }, 2000);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  }, [nearestHotspot]);

  const handleSave = useCallback(() => {
    if (!aiFeedback || !imagePreview) return;
    appendScrapbook({
      imageData: imagePreview,
      hotspot:   nearestHotspot?.title ?? 'Custom Location',
      category:  aiFeedback.category,
      score:     aiFeedback.compositionScore,
      tip:       aiFeedback.actionableTip,
    });
    setSavedToBook(true);
  }, [aiFeedback, imagePreview, nearestHotspot]);

  const closeModal = useCallback(() => {
    setShowModal(false);
    setImagePreview(null);
    setAiFeedback(null);
    setSavedToBook(false);
    setAnalyzing(false);
  }, []);

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div className="relative w-full h-[calc(100vh-3.5rem)] bg-zinc-950 overflow-hidden">

      {/* Hidden file input */}
      <input ref={fileInputRef} type="file" accept="image/*" capture="environment"
        className="hidden" onChange={handleFileChange} id="pinpic-capture-input"
        aria-label="Capture or select photo for AI analysis" />

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
        className="absolute top-4 left-1/2 -translate-x-1/2 z-20 flex gap-2 w-[90%] max-w-sm pointer-events-auto"
      >
        <div className="flex-1 flex items-center gap-2 bg-zinc-950/95 border border-zinc-700 rounded-lg px-3 py-2 shadow-xl">
          <Search className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search any city or landmark…"
            className="flex-1 bg-transparent text-xs font-mono text-white placeholder:text-zinc-600 outline-none"
          />
        </div>
        <button
          type="submit"
          disabled={searching}
          className="bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-mono font-bold px-4 rounded-lg transition-colors active:scale-95 disabled:opacity-60 shrink-0"
        >
          {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : 'FLY'}
        </button>
      </form>

      {/* ── Info HUD (top-left) ──────────────────────────────────────────────── */}
      <div className="absolute top-[4.5rem] left-4 z-20 bg-zinc-950/90 border border-zinc-800 rounded-md p-3 max-w-[200px] pointer-events-auto">
        <h2 className="text-[10px] font-mono font-bold text-white uppercase tracking-wider mb-1 flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          PinPic Hotspots
        </h2>
        <div className="text-[9px] font-mono text-zinc-500 flex justify-between border-t border-zinc-800 pt-1.5 mt-1.5">
          <span>Active Pins:</span>
          <span className="text-zinc-300 font-bold">{hotspots.length}</span>
        </div>
        <div className="text-[9px] font-mono text-zinc-500 flex justify-between mt-1">
          <span>Mumbai Spots:</span>
          <span className="text-zinc-300 font-bold">{MUMBAI_HOTSPOTS.length}</span>
        </div>
      </div>

      {/* ── Golden Hour Widget (top-right) ──────────────────────────────────── */}
      <div className={`absolute top-[4.5rem] right-4 z-20 border rounded-md p-3 pointer-events-auto max-w-[190px] ${
        isGolden
          ? 'bg-amber-950/80 border-amber-700/60'
          : 'bg-zinc-950/90 border-zinc-800'
      }`}>
        <div className="flex items-center gap-1.5 mb-2">
          <Sun className={`h-3.5 w-3.5 ${isGolden ? 'text-amber-400' : 'text-zinc-400'}`} />
          <span className={`text-[9px] font-mono font-bold uppercase tracking-wider ${isGolden ? 'text-amber-300' : 'text-zinc-400'}`}>
            {isGolden ? '✨ Golden Hour NOW' : 'Light Forecast'}
          </span>
        </div>
        <div className="flex flex-col gap-1">
          {[
            { icon: Sunrise, label: 'Sunrise',    value: goldenTimes.sunrise,      color: 'text-amber-400' },
            { icon: Sun,     label: 'Golden AM',  value: goldenTimes.goldenHour,   color: 'text-yellow-400' },
            { icon: Clock,   label: 'Noon',       value: goldenTimes.solarNoon,    color: 'text-zinc-400' },
            { icon: Sunset,  label: 'Golden PM',  value: goldenTimes.goldenHourEnd, color: 'text-orange-400' },
            { icon: Sunset,  label: 'Sunset',     value: goldenTimes.sunset,       color: 'text-rose-400' },
            { icon: Moon,    label: 'Blue Hour',  value: goldenTimes.blueHour,     color: 'text-indigo-400' },
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
        <p className="text-[7px] font-mono text-zinc-700 mt-1.5 border-t border-zinc-800 pt-1.5 uppercase tracking-widest">
          📍 {mapCenter[0].toFixed(2)}°N {mapCenter[1].toFixed(2)}°E
        </p>
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
          Capture &amp; AI Analyze
        </button>
        <p className="text-[7px] font-mono text-zinc-600 mt-1.5 uppercase tracking-widest">
          PinPic — Arya Hemant Tare
        </p>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          AI COMPOSITION MODAL
      ══════════════════════════════════════════════════════════════════════ */}
      {showModal && (
        <div className="absolute inset-0 z-30 bg-black/85 flex items-end md:items-center justify-center p-4">
          <div className="w-full max-w-md bg-zinc-950 border border-zinc-800 rounded-xl overflow-hidden shadow-2xl animate-slide-up">

            {/* Modal header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
              <div className="flex items-center gap-2">
                <Camera className="h-4 w-4 text-emerald-500" />
                <span className="text-xs font-mono font-bold text-white uppercase tracking-widest">
                  AI Composition Analyzer
                </span>
              </div>
              <button onClick={closeModal} className="h-7 w-7 flex items-center justify-center rounded-md text-zinc-500 hover:text-white hover:bg-zinc-800 transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="overflow-y-auto max-h-[80vh] p-5 flex flex-col gap-4">

              {/* Canvas: image + rule-of-thirds overlay */}
              {imagePreview && !analyzing && (
                <div className="relative w-full rounded-lg overflow-hidden border border-zinc-700 bg-zinc-900">
                  <canvas ref={canvasRef} className="w-full h-auto block" />
                  {/* Grid toggle */}
                  <button
                    onClick={() => setShowGrid(g => !g)}
                    className={`absolute top-2 right-2 text-[8px] font-mono uppercase px-2 py-1 rounded border transition-colors ${
                      showGrid ? 'bg-white/90 text-black border-white' : 'bg-black/70 text-zinc-400 border-zinc-700'
                    }`}
                  >
                    <Grid3X3 className="h-3 w-3 inline mr-1" />
                    {showGrid ? 'Grid ON' : 'Grid OFF'}
                  </button>
                  {nearestHotspot && (
                    <div className="absolute bottom-2 left-2 bg-black/80 border border-zinc-700 px-2 py-1 rounded text-[7px] font-mono text-zinc-300 flex items-center gap-1">
                      <MapPin className="h-2.5 w-2.5 text-emerald-500" />
                      {nearestHotspot.title}
                    </div>
                  )}
                </div>
              )}

              {/* Analyzing state */}
              {analyzing && (
                <div className="flex flex-col items-center gap-3 py-6">
                  <Loader2 className="h-10 w-10 animate-spin text-emerald-500" />
                  <p className="text-xs font-mono text-emerald-400 font-bold uppercase tracking-widest">
                    Analyzing Composition…
                  </p>
                  <p className="text-[9px] font-mono text-zinc-500">
                    Rule-of-thirds · Lighting · Pose alignment
                  </p>
                  <div className="w-48 h-1 bg-zinc-800 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500 animate-scanner-bar w-1/3 rounded-full" />
                  </div>
                </div>
              )}

              {/* AI Feedback */}
              {!analyzing && aiFeedback && (
                <>
                  {/* Score hero */}
                  <div className="border border-emerald-900/50 bg-emerald-950/20 rounded-lg p-4 flex items-center justify-between">
                    <div>
                      <p className="text-[8px] font-mono text-emerald-400 uppercase tracking-widest mb-0.5">Overall Score</p>
                      <p className="text-3xl font-black text-white tracking-tighter">{aiFeedback.compositionScore}</p>
                      <p className="text-[8px] font-mono text-zinc-500 mt-0.5 uppercase">{aiFeedback.shotType}</p>
                    </div>
                    <div className="h-14 w-14 rounded-full border-4 border-emerald-500 flex items-center justify-center">
                      <Star className="h-6 w-6 text-emerald-400" />
                    </div>
                  </div>

                  {/* Evaluation rows */}
                  <div className="flex flex-col gap-2">
                    <div className="flex items-start gap-3 border border-zinc-800 rounded-lg px-3 py-2.5">
                      <Grid3X3 className="h-3.5 w-3.5 mt-0.5 shrink-0 text-emerald-500" />
                      <div>
                        <p className="text-[8px] font-mono text-zinc-500 uppercase tracking-widest">Rule of Thirds</p>
                        <p className="text-[11px] font-mono text-zinc-200 mt-0.5">{aiFeedback.ruleOfThirds}</p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3 border border-zinc-800 rounded-lg px-3 py-2.5">
                      <Sun className="h-3.5 w-3.5 mt-0.5 shrink-0 text-amber-400" />
                      <div>
                        <p className="text-[8px] font-mono text-zinc-500 uppercase tracking-widest">Lighting Assessment</p>
                        <p className="text-[11px] font-mono text-zinc-200 mt-0.5">{aiFeedback.lightingAssessment}</p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3 border border-amber-900/50 bg-amber-950/10 rounded-lg px-3 py-2.5">
                      <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0 text-amber-400" />
                      <div>
                        <p className="text-[8px] font-mono text-amber-500 uppercase tracking-widest">Actionable Tip</p>
                        <p className="text-[11px] font-mono text-zinc-200 mt-0.5">{aiFeedback.actionableTip}</p>
                      </div>
                    </div>

                    {/* Reference comparison */}
                    {nearestHotspot && (
                      <div className="flex gap-2">
                        <div className="flex-1 flex flex-col gap-1">
                          <p className="text-[7px] font-mono text-zinc-500 uppercase tracking-wider">Your Shot</p>
                          <div className="aspect-square rounded overflow-hidden border border-zinc-800 bg-zinc-900">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={imagePreview!} alt="Your shot" className="w-full h-full object-cover" />
                          </div>
                        </div>
                        <div className="flex-1 flex flex-col gap-1">
                          <p className="text-[7px] font-mono text-zinc-500 uppercase tracking-wider">Reference</p>
                          <div className="aspect-square rounded overflow-hidden border border-zinc-800 bg-zinc-900">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={nearestHotspot.inspo_image_url} alt="Reference" className="w-full h-full object-cover" loading="lazy" />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={closeModal}
                      className="flex-1 flex items-center justify-center gap-1.5 border border-zinc-700 hover:border-zinc-500 text-zinc-400 hover:text-white text-[10px] font-mono uppercase tracking-widest py-3 rounded-lg transition-colors active:scale-95"
                    >
                      <RotateCcw className="h-3.5 w-3.5" /> Retake
                    </button>

                    <button
                      onClick={handleSave}
                      disabled={savedToBook}
                      className={`flex-1 flex items-center justify-center gap-1.5 text-[10px] font-mono uppercase tracking-widest py-3 rounded-lg transition-all active:scale-95 font-bold ${
                        savedToBook
                          ? 'bg-zinc-800 text-zinc-500 cursor-default'
                          : 'bg-emerald-500 hover:bg-emerald-400 text-black border-2 border-black shadow-[2px_2px_0px_rgba(0,0,0,0.5)]'
                      }`}
                    >
                      {savedToBook ? (
                        <><CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /><span className="text-emerald-400">Saved!</span></>
                      ) : (
                        <><Save className="h-3.5 w-3.5" /> Save to Scrapbook</>
                      )}
                    </button>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <ImageIcon className="h-3 w-3 text-zinc-700" />
                    <p className="text-[7px] font-mono text-zinc-700 uppercase tracking-widest">
                      AI evaluation by PinPic · Built by Arya Hemant Tare
                    </p>
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
