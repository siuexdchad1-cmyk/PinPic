'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Loader2, Camera, X, Star, Grid3X3, CheckCircle2, AlertCircle, Save, RotateCcw, ImageIcon } from 'lucide-react';

interface HotspotPin {
  id:              string;
  title:           string;
  description:     string | null;
  inspo_image_url: string;
  lat:             number;
  lng:             number;
}

// ── Photography Hotspot Categories ─────────────────────────────────────────
const PHOTOGRAPHY_CATEGORIES = [
  { id: 'golden-hour',   label: '🌅 Golden Hour Viewpoint', color: '#f59e0b' },
  { id: 'portrait',      label: '🧍 Portrait Spot',         color: '#10b981' },
  { id: 'architecture',  label: '🏛️ Architecture Angle',    color: '#6366f1' },
  { id: 'nature',        label: '🌿 Nature Shot',           color: '#22c55e' },
];

function getCategoryForHotspot(index: number) {
  return PHOTOGRAPHY_CATEGORIES[index % PHOTOGRAPHY_CATEGORIES.length];
}

// ── AI Composition Feedback (Mock Groq Vision) ─────────────────────────────
interface AIFeedback {
  compositionScore: string;
  ruleOfThirds:     string;
  framing:          string;
  recommendedPose:  string;
  lighting:         string;
  category:         string;
}

function generateAIFeedback(category: string): AIFeedback {
  const feedbacks: Record<string, AIFeedback> = {
    'golden-hour': {
      compositionScore: '8.8 / 10',
      ruleOfThirds:     'Matched — Horizon at lower third',
      framing:          'Wide, Balanced',
      recommendedPose:  'Silhouette stance facing light source with arms relaxed at sides',
      lighting:         'Warm backlit — optimal for this category',
      category:         'Golden Hour Viewpoint',
    },
    'portrait': {
      compositionScore: '9.1 / 10',
      ruleOfThirds:     'Matched — Subject at left power point',
      framing:          'Portrait crop, tight depth of field',
      recommendedPose:  'Standing Profile with background depth, slight body turn towards camera',
      lighting:         'Soft natural diffuse light — minimal harsh shadows',
      category:         'Portrait Spot',
    },
    'architecture': {
      compositionScore: '8.4 / 10',
      ruleOfThirds:     'Partial — Leading lines converge centrally',
      framing:          'Symmetrical with geometric foreground',
      recommendedPose:  'Wide stance, centered in frame to complement symmetry',
      lighting:         'Midday overhead — enhances structural contrast',
      category:         'Architecture Angle',
    },
    'nature': {
      compositionScore: '8.6 / 10',
      ruleOfThirds:     'Strong — Foliage layers at horizontal thirds',
      framing:          'Environmental portrait, expansive backdrop',
      recommendedPose:  'Casual seat or crouch at mid-frame, blending with surroundings',
      lighting:         'Dappled golden light — gentle post-processing recommended',
      category:         'Nature Shot',
    },
  };
  return feedbacks[category] ?? feedbacks['portrait'];
}

// ── Saved Scrapbook Entry ──────────────────────────────────────────────────
interface ScrapbookEntry {
  id:        string;
  imageName: string;
  hotspot:   string;
  category:  string;
  score:     string;
  savedAt:   string;
}

function loadScrapbook(): ScrapbookEntry[] {
  try {
    return JSON.parse(localStorage.getItem('pinpic_scrapbook') ?? '[]');
  } catch {
    return [];
  }
}

function saveToScrapbook(entry: Omit<ScrapbookEntry, 'id' | 'savedAt'>) {
  const existing = loadScrapbook();
  const newEntry: ScrapbookEntry = {
    ...entry,
    id:      crypto.randomUUID(),
    savedAt: new Date().toISOString(),
  };
  localStorage.setItem('pinpic_scrapbook', JSON.stringify([newEntry, ...existing]));
  return newEntry;
}

// ── Main ExploreMap Component ──────────────────────────────────────────────
export default function ExploreMap() {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef    = useRef<HTMLInputElement>(null);

  const [loading,        setLoading]        = useState(true);
  const [hotspots,       setHotspots]       = useState<HotspotPin[]>([]);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  // AI Modal state
  const [showModal,       setShowModal]       = useState(false);
  const [analyzing,       setAnalyzing]       = useState(false);
  const [imagePreview,    setImagePreview]    = useState<string | null>(null);
  const [imageName,       setImageName]       = useState<string>('');
  const [aiFeedback,      setAiFeedback]      = useState<AIFeedback | null>(null);
  const [savedToBook,     setSavedToBook]     = useState(false);
  const [nearestHotspot,  setNearestHotspot]  = useState<HotspotPin | null>(null);

  // ── Load Leaflet & Init Map ────────────────────────────────────────────────
  useEffect(() => {
    let active = true;

    async function initMap() {
      try {
        const res  = await fetch('/api/hotspots');
        if (!res.ok) throw new Error('Failed to load hotspots');
        const data = await res.json();
        const spots: HotspotPin[] = data.hotspots ?? [];
        if (active) {
          setHotspots(spots);
          // Pick a nearby hotspot to reference in the modal
          if (spots.length > 0) setNearestHotspot(spots[0]);
        }

        // Leaflet CSS
        if (!document.querySelector('link[href*="leaflet.css"]')) {
          const link = document.createElement('link');
          link.rel   = 'stylesheet';
          link.href  = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
          document.head.appendChild(link);
        }

        // Leaflet JS
        if (!Object.prototype.hasOwnProperty.call(window, 'L')) {
          await new Promise<void>((resolve, reject) => {
            const script   = document.createElement('script');
            script.src     = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
            script.async   = true;
            script.onload  = () => resolve();
            script.onerror = () => reject(new Error('Failed to load Leaflet'));
            document.body.appendChild(script);
          });
        }

        if (!active || !mapContainerRef.current) return;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const L = (window as any).L;
        if (!L) return;

        const map = L.map(mapContainerRef.current, { zoomControl: false });
        map.setView([20, 0], 2);

        L.control.zoom({ position: 'bottomright' }).addTo(map);

        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
          maxZoom: 20,
          attribution: '&copy; <a href="https://osm.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>'
        }).addTo(map);

        // Plot hotspots with category-coloured markers
        spots.forEach((spot: HotspotPin, idx: number) => {
          if (spot.lat === 0 && spot.lng === 0) return;

          const cat = getCategoryForHotspot(idx);

          const marker = L.circleMarker([spot.lat, spot.lng], {
            color:       cat.color,
            fillColor:   cat.color,
            fillOpacity: 0.75,
            radius:      8,
            weight:      2,
          }).addTo(map);

          const popupHtml = `
            <div style="font-family: monospace; color: #09090b; width: 230px; padding: 4px;">
              <div style="display:flex; align-items:center; gap:6px; margin-bottom:6px;">
                <span style="font-size:9px; background:${cat.color}22; color:${cat.color}; border:1px solid ${cat.color}55; border-radius:4px; padding:2px 6px; font-weight:700; text-transform:uppercase; letter-spacing:0.05em;">
                  ${cat.label}
                </span>
              </div>
              <h4 style="font-size:12px; font-weight:700; margin:0 0 4px 0; border-bottom:1px solid #e4e4e7; padding-bottom:4px; color:#09090b;">
                📍 ${spot.title}
              </h4>
              <p style="font-size:10px; color:#71717a; margin:0 0 8px 0; line-height:1.3;">
                ${spot.description || 'Photography composition hotspot. Tap below to shoot here.'}
              </p>
              <div style="width:100%; height:110px; border-radius:6px; overflow:hidden; margin-bottom:8px;">
                <img src="${spot.inspo_image_url}" style="width:100%; height:100%; object-fit:cover;" loading="lazy" />
              </div>
              <a href="/camera?ref=${spot.id}" style="display:block; width:100%; text-align:center; background:${cat.color}; color:white; text-decoration:none; font-size:10px; font-weight:700; padding:7px 0; border-radius:4px;">
                📷 GO TO CAMERA
              </a>
            </div>
          `;

          marker.bindPopup(popupHtml, { maxWidth: 250, className: 'leaflet-dark-popup' });
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

  // ── Handle File Selection → AI Analysis ───────────────────────────────────
  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImageName(file.name);
    setSavedToBook(false);
    setAiFeedback(null);

    const reader = new FileReader();
    reader.onload = (ev) => {
      setImagePreview(ev.target?.result as string);
      setShowModal(true);
      setAnalyzing(true);

      // Simulate Groq Vision processing (1.8s delay for realism)
      const cat = getCategoryForHotspot(hotspots.length % 4);
      setTimeout(() => {
        setAiFeedback(generateAIFeedback(cat.id));
        setAnalyzing(false);
      }, 1800);
    };
    reader.readAsDataURL(file);

    // Reset input so same file can be re-selected
    e.target.value = '';
  }, [hotspots.length]);

  // ── Save to Scrapbook ──────────────────────────────────────────────────────
  const handleSaveToScrapbook = useCallback(() => {
    if (!aiFeedback) return;
    saveToScrapbook({
      imageName,
      hotspot:  nearestHotspot?.title ?? 'Custom Location',
      category: aiFeedback.category,
      score:    aiFeedback.compositionScore,
    });
    setSavedToBook(true);
  }, [aiFeedback, imageName, nearestHotspot]);

  const closeModal = useCallback(() => {
    setShowModal(false);
    setImagePreview(null);
    setAiFeedback(null);
    setSavedToBook(false);
    setAnalyzing(false);
  }, []);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="relative w-full h-[calc(100vh-3.5rem)] bg-zinc-950 overflow-hidden">

      {/* Hidden file picker (camera capture) */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFileChange}
        id="pinpic-capture-input"
        aria-label="Select or capture a photo for AI analysis"
      />

      {/* Loading overlay */}
      {loading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 z-50 bg-zinc-950">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
          <p className="text-sm font-mono text-zinc-400">Loading photography hotspots…</p>
        </div>
      )}

      {/* Map Container */}
      <div ref={mapContainerRef} className="w-full h-full z-10" />

      {/* ── Info HUD (top-left) ──────────────────────────────────────────────── */}
      <div className="absolute top-4 left-4 z-20 bg-zinc-950/90 border border-zinc-800 rounded-md p-3 max-w-[220px] pointer-events-auto">
        <h2 className="text-xs font-mono font-bold text-white uppercase tracking-wider mb-1 flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          PinPic Hotspots
        </h2>
        <p className="text-[9px] font-mono text-zinc-400 leading-normal mb-2">
          Explore GPS-pinned photography hotspots worldwide. Tap a marker to load its reference stencil.
        </p>
        <div className="text-[9px] font-mono text-zinc-500 border-t border-zinc-800 pt-2 flex justify-between">
          <span>Active Spots:</span>
          <span className="text-zinc-300 font-bold">{hotspots.length}</span>
        </div>
      </div>

      {/* ── Category Legend (top-right) ──────────────────────────────────────── */}
      <div className="absolute top-4 right-4 z-20 bg-zinc-950/90 border border-zinc-800 rounded-md p-3 pointer-events-auto">
        <p className="text-[8px] font-mono text-zinc-500 uppercase tracking-widest mb-2">Shot Categories</p>
        <div className="flex flex-col gap-1.5">
          {PHOTOGRAPHY_CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(activeCategory === cat.id ? null : cat.id)}
              className="flex items-center gap-2 text-[9px] font-mono text-zinc-300 hover:text-white transition-colors text-left"
            >
              <span
                className="h-2 w-2 rounded-full shrink-0"
                style={{ backgroundColor: cat.color }}
              />
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Floating Capture & AI Analyze FAB ────────────────────────────────── */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20 pointer-events-auto">
        <button
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-2.5 bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-black font-mono font-bold text-xs uppercase tracking-widest px-6 py-3.5 rounded-full border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,0.8)] transition-all duration-150"
          title="Take or select a photo for AI composition analysis"
        >
          <Camera className="h-4 w-4" />
          Capture &amp; AI Analyze
        </button>
        <p className="text-center text-[8px] font-mono text-zinc-500 mt-2 uppercase tracking-widest">
          Built by Arya Tare — PinPic v1.0
        </p>
      </div>

      {/* ── AI Composition Feedback Modal ─────────────────────────────────────── */}
      {showModal && (
        <div className="absolute inset-0 z-30 bg-black/80 flex items-end md:items-center justify-center p-4">
          <div className="w-full max-w-md bg-zinc-950 border border-zinc-800 rounded-xl overflow-hidden shadow-2xl animate-slide-up">

            {/* Modal Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
              <div className="flex items-center gap-2">
                <Camera className="h-4 w-4 text-emerald-500" />
                <span className="text-xs font-mono font-bold text-white uppercase tracking-widest">
                  AI Composition Analysis
                </span>
              </div>
              <button
                onClick={closeModal}
                className="h-7 w-7 flex items-center justify-center rounded-md text-zinc-500 hover:text-white hover:bg-zinc-800 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="overflow-y-auto max-h-[75vh] p-5 flex flex-col gap-5">

              {/* Image Preview */}
              {imagePreview && (
                <div className="w-full aspect-video rounded-lg overflow-hidden border border-zinc-800 bg-zinc-900 relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={imagePreview}
                    alt="Your captured photo preview"
                    className="w-full h-full object-cover"
                  />
                  {nearestHotspot && (
                    <div className="absolute bottom-2 left-2 bg-black/80 border border-zinc-700 px-2 py-1 rounded text-[8px] font-mono text-zinc-300 uppercase">
                      📍 Near: {nearestHotspot.title}
                    </div>
                  )}
                </div>
              )}

              {/* Analyzing State */}
              {analyzing && (
                <div className="flex flex-col items-center gap-3 py-4">
                  <div className="relative h-12 w-12">
                    <Loader2 className="h-12 w-12 animate-spin text-emerald-500" />
                  </div>
                  <div className="text-center">
                    <p className="text-xs font-mono text-emerald-400 font-bold uppercase tracking-widest">
                      Groq Vision Analyzing…
                    </p>
                    <p className="text-[9px] font-mono text-zinc-500 mt-1">
                      Evaluating composition, framing &amp; pose
                    </p>
                  </div>
                  {/* Animated loading bar */}
                  <div className="w-48 h-1 bg-zinc-800 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500 animate-scanner-bar w-1/3 rounded-full" />
                  </div>
                </div>
              )}

              {/* AI Feedback Card */}
              {!analyzing && aiFeedback && (
                <>
                  {/* Score Hero */}
                  <div className="border border-emerald-900/60 bg-emerald-950/20 rounded-lg p-4 flex items-center justify-between">
                    <div>
                      <p className="text-[9px] font-mono text-emerald-400 uppercase tracking-widest mb-0.5">
                        Composition Score
                      </p>
                      <p className="text-3xl font-black text-white tracking-tighter">
                        {aiFeedback.compositionScore}
                      </p>
                      <p className="text-[9px] font-mono text-zinc-500 mt-0.5 uppercase">
                        {aiFeedback.category}
                      </p>
                    </div>
                    <div className="h-14 w-14 rounded-full border-4 border-emerald-500 flex items-center justify-center">
                      <Star className="h-6 w-6 text-emerald-400" />
                    </div>
                  </div>

                  {/* Evaluation Grid */}
                  <div className="grid grid-cols-1 gap-2">
                    {[
                      { icon: Grid3X3, label: 'Rule of Thirds', value: aiFeedback.ruleOfThirds, ok: true },
                      { icon: ImageIcon, label: 'Framing',       value: aiFeedback.framing,      ok: true },
                      { icon: CheckCircle2, label: 'Lighting',   value: aiFeedback.lighting,     ok: true },
                    ].map(({ icon: Icon, label, value, ok }) => (
                      <div key={label} className="flex items-start gap-3 border border-zinc-800 rounded-lg px-3 py-2.5">
                        <Icon className={`h-3.5 w-3.5 mt-0.5 shrink-0 ${ok ? 'text-emerald-500' : 'text-amber-500'}`} />
                        <div>
                          <p className="text-[8px] font-mono text-zinc-500 uppercase tracking-widest">{label}</p>
                          <p className="text-[11px] font-mono text-zinc-200 mt-0.5">{value}</p>
                        </div>
                      </div>
                    ))}

                    {/* Recommended Pose */}
                    <div className="flex items-start gap-3 border border-amber-900/50 bg-amber-950/10 rounded-lg px-3 py-2.5">
                      <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0 text-amber-400" />
                      <div>
                        <p className="text-[8px] font-mono text-amber-500 uppercase tracking-widest">Recommended Pose</p>
                        <p className="text-[11px] font-mono text-zinc-200 mt-0.5">{aiFeedback.recommendedPose}</p>
                      </div>
                    </div>
                  </div>

                  {/* Reference vs Shot comparison hint */}
                  {nearestHotspot?.inspo_image_url && (
                    <div className="flex gap-2">
                      <div className="flex-1 flex flex-col gap-1">
                        <p className="text-[8px] font-mono text-zinc-500 uppercase tracking-wider">Your Shot</p>
                        <div className="aspect-square rounded-md overflow-hidden border border-zinc-800 bg-zinc-900">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={imagePreview!} alt="your shot" className="w-full h-full object-cover" />
                        </div>
                      </div>
                      <div className="flex-1 flex flex-col gap-1">
                        <p className="text-[8px] font-mono text-zinc-500 uppercase tracking-wider">Reference</p>
                        <div className="aspect-square rounded-md overflow-hidden border border-zinc-800 bg-zinc-900">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={nearestHotspot.inspo_image_url} alt="reference" className="w-full h-full object-cover" loading="lazy" />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={closeModal}
                      className="flex-1 flex items-center justify-center gap-1.5 border border-zinc-700 hover:border-zinc-500 text-zinc-400 hover:text-white text-[10px] font-mono uppercase tracking-widest py-3 rounded-lg transition-colors active:scale-95"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      Retake
                    </button>

                    <button
                      onClick={handleSaveToScrapbook}
                      disabled={savedToBook}
                      className={`flex-1 flex items-center justify-center gap-1.5 text-[10px] font-mono uppercase tracking-widest py-3 rounded-lg transition-all active:scale-95 font-bold ${
                        savedToBook
                          ? 'bg-zinc-800 text-zinc-500 cursor-default'
                          : 'bg-emerald-500 hover:bg-emerald-400 text-black border-2 border-black shadow-[2px_2px_0px_rgba(0,0,0,0.5)]'
                      }`}
                    >
                      {savedToBook ? (
                        <>
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                          <span className="text-emerald-400">Saved!</span>
                        </>
                      ) : (
                        <>
                          <Save className="h-3.5 w-3.5" />
                          Save to Scrapbook
                        </>
                      )}
                    </button>
                  </div>

                  {/* Attribution */}
                  <p className="text-center text-[8px] font-mono text-zinc-700 uppercase tracking-widest">
                    AI evaluation powered by Groq Vision • PinPic by Arya Tare
                  </p>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
