'use client';

import { useRef, useEffect, useState, useCallback } from 'react';
import { toast } from 'sonner';
import { Loader2, AlertCircle, RefreshCw, X, Sliders, LayoutGrid } from 'lucide-react';
import type { CameraState, ProcessShotResponse, GpsCoordinates } from '@/lib/types';
import type { LocationSearchResult, SocialPost } from '@/app/api/location/search/route';
import PermissionsWizard from '@/components/camera/PermissionsWizard';

export default function CameraPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const lastFetchTimeRef = useRef<number>(0);

  const [camState, setCamState] = useState<CameraState>('idle');
  const [gps, setGps] = useState<GpsCoordinates | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [result, setResult] = useState<ProcessShotResponse | null>(null);
  const [socialPosts, setSocialPosts] = useState<SocialPost[]>([]);

  // ── Reference Stencil & Side-by-Side Visuals ──────────────────────────────
  const [selectedPost, setSelectedPost] = useState<SocialPost | null>(null);
  const [overlayOpacity, setOverlayOpacity] = useState<number>(0.25);
  const [isSideBySide, setIsSideBySide] = useState<boolean>(false);
  const [showSuggestions, setShowSuggestions] = useState<boolean>(true);

  // ── Manual Location Search Override ───────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isManualOverride, setIsManualOverride] = useState<boolean>(false);

  // ── Draw stark white editorial alignment guides ───────────────────────────
  const drawCompositionGuides = useCallback(() => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = video.videoWidth || canvas.offsetWidth || 640;
    canvas.height = video.videoHeight || canvas.offsetHeight || 480;

    const w = canvas.width;
    const h = canvas.height;

    ctx.clearRect(0, 0, w, h);

    // Rule of Thirds (1px solid white, very subtle)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.lineWidth = 1;
    [w / 3, (2 * w) / 3].forEach((x) => {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
    });
    [h / 3, (2 * h) / 3].forEach((y) => {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    });

    // Centered Crosshair (15px arms)
    const cx = w / 2;
    const cy = h / 2;
    const arm = 15;
    ctx.strokeStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(cx - arm, cy); ctx.lineTo(cx + arm, cy);
    ctx.moveTo(cx, cy - arm); ctx.lineTo(cx, cy + arm);
    ctx.stroke();

    // Leica Corner Crop Brackets
    const pad = 12;
    const len = 10;
    ctx.strokeStyle = '#ffffff';
    // Top-left
    ctx.beginPath(); ctx.moveTo(pad, pad + len); ctx.lineTo(pad, pad); ctx.lineTo(pad + len, pad); ctx.stroke();
    // Top-right
    ctx.beginPath(); ctx.moveTo(w - pad - len, pad); ctx.lineTo(w - pad, pad); ctx.lineTo(w - pad, pad + len); ctx.stroke();
    // Bottom-left
    ctx.beginPath(); ctx.moveTo(pad, h - pad - len); ctx.lineTo(pad, h - pad); ctx.lineTo(pad + len, h - pad); ctx.stroke();
    // Bottom-right
    ctx.beginPath(); ctx.moveTo(w - pad - len, h - pad); ctx.lineTo(w - pad, h - pad); ctx.lineTo(w - pad, h - pad - len); ctx.stroke();
  }, []);

  // ── Redraw guides on window/canvas resize ────────────────────────────────
  useEffect(() => {
    if (camState === 'streaming' || camState === 'hotspot-found') {
      const interval = setInterval(drawCompositionGuides, 500);
      return () => clearInterval(interval);
    }
  }, [camState, drawCompositionGuides]);

  // ── Fetch social posts near coordinates (throttled to 3s) ──────────────────
  const fetchSocialPosts = useCallback(async (latitude: number, longitude: number) => {
    const now = Date.now();
    if (now - lastFetchTimeRef.current < 3000) return;
    lastFetchTimeRef.current = now;

    try {
      const res = await fetch(`/api/location/search?lat=${latitude}&lng=${longitude}`);
      if (!res.ok) return;
      const data: LocationSearchResult = await res.json();
      if (data && data.posts) {
        setSocialPosts(data.posts);
        if (!selectedPost && data.posts.length > 0) {
          // Preload first post as composition stencil guide
          setSelectedPost(data.posts[0]);
        }
      }
    } catch {
      // Non-fatal geolocation discovery stream update failures
    }
  }, [selectedPost]);

  // ── Trigger manual location search ────────────────────────────────────────
  const handleManualSearch = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setIsManualOverride(true);
    try {
      const res = await fetch(`/api/location/search?query=${encodeURIComponent(searchQuery.trim())}`);
      if (!res.ok) {
        toast.error("Location not found.");
        return;
      }
      const data: LocationSearchResult = await res.json();
      if (data && data.posts) {
        setSocialPosts(data.posts);
        if (data.posts.length > 0) {
          setSelectedPost(data.posts[0]);
          toast.success(`Loaded inspiration for: ${searchQuery}`);
        } else {
          toast.error("No inspiration photos found for this location.");
        }
      }
    } catch {
      toast.error("Search failed.");
    }
  }, [searchQuery]);

  // ── Restore GPS auto-geolocation suggestions ──────────────────────────────
  const clearManualOverride = useCallback(() => {
    setIsManualOverride(false);
    setSearchQuery('');
    if (gps) {
      // Trigger instant fetch with the current GPS coordinates
      fetchSocialPosts(gps.latitude, gps.longitude);
    }
  }, [gps, fetchSocialPosts]);

  // ── Start browser camera video streaming ──────────────────────────────────
  async function startCamera() {
    setCamState('requesting-permissions');
    setErrorMsg('');
    setResult(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCamState('streaming');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Camera access denied.';
      setErrorMsg(msg);
      setCamState('error');
    }
  }

  // ── Initialize camera with pre-selected coordinator parameters ─────────────
  async function startCameraWithCoords(coords: { latitude: number; longitude: number }) {
    await startCamera();
    const initialGps: GpsCoordinates = {
      latitude: coords.latitude,
      longitude: coords.longitude,
      accuracy: 10,
    };
    setGps(initialGps);
    fetchSocialPosts(coords.latitude, coords.longitude);
  }

  // ── Real-Time GPS auto-geolocation loop effect ─────────────────────────────
  useEffect(() => {
    if (camState === 'streaming' || camState === 'hotspot-found') {
      if ('geolocation' in navigator) {
        watchIdRef.current = navigator.geolocation.watchPosition(
          (pos) => {
            const coords: GpsCoordinates = {
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
              accuracy: pos.coords.accuracy,
            };
            setGps(coords);
            if (!isManualOverride) {
              fetchSocialPosts(coords.latitude, coords.longitude);
            }
          },
          (err) => {
            console.warn('[GPS Watcher Failure]', err.message);
          },
          { enableHighAccuracy: true, maximumAge: 3000, timeout: 15000 }
        );
      }
    }
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [camState, fetchSocialPosts, isManualOverride]);

  // ── Capture viewfinder photo frame ─────────────────────────────────────────
  async function captureFrame() {
    if (!videoRef.current) return;
    setCamState('capturing');

    const snapCanvas = document.createElement('canvas');
    snapCanvas.width = videoRef.current.videoWidth || 1280;
    snapCanvas.height = videoRef.current.videoHeight || 720;
    const ctx = snapCanvas.getContext('2d')!;
    ctx.drawImage(videoRef.current, 0, 0);
    const imageBase64 = snapCanvas.toDataURL('image/jpeg', 0.85);

    setCamState('processing');

    try {
      const res = await fetch('/api/process-shot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64,
          hotspotImageUrl: selectedPost?.inspo_image_url ?? null,
          hotspotId: selectedPost?.id ?? null,
        }),
      });

      if (!res.ok) {
        let errMsg = 'AI analysis processing failed.';
        try {
          const errData = await res.json();
          if (errData && errData.error) {
            errMsg = errData.error;
          }
        } catch {}
        throw new Error(errMsg);
      }
      const data: ProcessShotResponse = await res.json();
      setResult(data);
      setCamState('result');
      toast.success(`Shot scored: ${data.matchAccuracy}%`);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Processing failed.');
      setCamState('error');
    }
  }

  // ── Cleanup camera streams on route transition unmount ─────────────────────
  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  const isStreaming = ['streaming', 'hotspot-found', 'capturing', 'processing'].includes(camState);

  return (
    <div className="camera-viewport flex flex-col bg-black min-h-screen text-white select-none">
      {/* ── Visualizer Layout ─────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col relative overflow-hidden bg-black">
        <div className={`flex-1 flex ${isSideBySide ? 'flex-row' : 'flex-col'} items-center justify-center relative`}>
          
          {/* Viewfinder Column */}
          <div className="flex-1 h-full w-full relative flex items-center justify-center bg-black">
            <video
              ref={videoRef}
              className="absolute inset-0 w-full h-full object-cover"
              playsInline
              muted
              autoPlay
              style={{ display: isStreaming ? 'block' : 'none' }}
              aria-label="Camera feed"
            />

            <canvas
              ref={canvasRef}
              className="absolute inset-0 w-full h-full pointer-events-none z-10"
              style={{ display: isStreaming ? 'block' : 'none' }}
              aria-hidden="true"
            />

            {/* Translucent overlay composition guide reference (Full-Screen overlay) */}
            {isStreaming && selectedPost && !isSideBySide && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={selectedPost.inspo_image_url}
                alt="Composition guide reference overlay"
                className="absolute inset-0 w-full h-full object-cover pointer-events-none transition-opacity duration-100 z-10"
                style={{ opacity: overlayOpacity }}
              />
            )}
          </div>

          {/* Side-by-Side Reference Panel */}
          {isStreaming && selectedPost && isSideBySide && (
            <div className="flex-1 h-full w-full border-l border-zinc-900 bg-black relative flex items-center justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={selectedPost.inspo_image_url}
                alt="Composition reference side-by-side"
                className="w-full h-full object-cover"
              />
              <div className="absolute bottom-4 left-4 right-4 bg-black/85 border border-zinc-900 p-3 flex flex-col gap-0.5">
                <span className="text-[10px] font-mono text-zinc-400">{selectedPost.user_handle}</span>
                <p className="text-xs text-white line-clamp-2">{selectedPost.caption}</p>
              </div>
            </div>
          )}
        </div>

        {/* ── Search Input & Controls Bar ──────────────────────────────────── */}
        {isStreaming && (
          <div className="absolute top-4 left-4 right-4 z-20 flex flex-col gap-2 pointer-events-auto max-w-md mx-auto w-[calc(100%-2rem)]">
            {/* Segmented Mode Controller */}
            <div className="flex w-full bg-black/90 border border-zinc-900 p-0.5 rounded-none shadow-xl">
              <button
                type="button"
                onClick={clearManualOverride}
                className={`flex-1 text-center py-1.5 text-[9px] font-mono uppercase tracking-widest transition-all duration-200 ${
                  !isManualOverride
                    ? 'bg-white text-black font-bold'
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                ● Live GPS Mode
              </button>
              <button
                type="button"
                onClick={() => setIsManualOverride(true)}
                className={`flex-1 text-center py-1.5 text-[9px] font-mono uppercase tracking-widest transition-all duration-200 ${
                  isManualOverride
                    ? 'bg-white text-black font-bold'
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                Manual Mode
              </button>
            </div>

            {/* Mode-specific interface details */}
            {isManualOverride ? (
              <form onSubmit={handleManualSearch} className="flex gap-1.5 w-full">
                <input
                  type="text"
                  placeholder="Enter location (e.g. Gateway of India)..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="flex-1 bg-black/85 border border-zinc-900 px-3 py-1.5 text-[10px] font-mono uppercase tracking-wider text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500 rounded-none"
                />
                <button
                  type="submit"
                  className="bg-white text-black hover:bg-zinc-200 px-3 py-1.5 text-[10px] font-mono font-bold uppercase tracking-wider rounded-none shrink-0"
                >
                  Search
                </button>
              </form>
            ) : (
              <div className="bg-black/85 border border-zinc-900 px-3 py-1.5 text-[9px] font-mono uppercase tracking-wider text-zinc-400 flex items-center justify-between shadow-md">
                <span>Auto-fetching within 1km radius...</span>
                <span className="text-[8px] text-emerald-400 animate-pulse font-bold">● ACTIVE</span>
              </div>
            )}

            {/* Display / opacity sliders (only shown when stencil is loaded) */}
            {selectedPost && (
              <div className="flex justify-between items-center gap-2 w-full mt-1">
                {/* Opacity slider for full screen overlay mode */}
                {!isSideBySide ? (
                  <div className="flex items-center gap-2 bg-black border border-zinc-900 px-2 py-1 rounded-none w-36">
                    <Sliders className="h-3 w-3 text-zinc-500 shrink-0" />
                    <input
                      type="range"
                      min="0.0"
                      max="1.0"
                      step="0.05"
                      value={overlayOpacity}
                      onChange={(e) => setOverlayOpacity(parseFloat(e.target.value))}
                      className="w-full h-1 bg-zinc-800 rounded-none appearance-none cursor-pointer accent-white"
                      title="Reference opacity"
                    />
                    <span className="text-[9px] font-mono text-zinc-400 shrink-0 w-6 text-right">
                      {Math.round(overlayOpacity * 100)}%
                    </span>
                  </div>
                ) : (
                  <div />
                )}

                {/* Display Mode Selector */}
                <div className="flex gap-1">
                  <button
                    onClick={() => setIsSideBySide((v) => !v)}
                    className="bg-black border border-zinc-900 hover:bg-zinc-900 px-2.5 py-1 text-[9px] font-mono uppercase tracking-wider flex items-center gap-1"
                  >
                    <LayoutGrid className="h-3 w-3" />
                    {isSideBySide ? 'Overlay' : 'Side-by-Side'}
                  </button>
                  <button
                    onClick={() => setSelectedPost(null)}
                    className="bg-black border border-zinc-900 hover:bg-zinc-900 p-1"
                    title="Clear inspiration"
                  >
                    <X className="h-3 w-3 text-zinc-400" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* GPS coordinates & accuracy diagnostics */}
        {isStreaming && gps && (
          <div className="absolute bottom-36 left-4 pointer-events-none text-[9px] font-mono text-zinc-500 z-10 flex flex-col gap-0.5">
            <span>GPS: {gps.latitude.toFixed(5)}, {gps.longitude.toFixed(5)}</span>
            <span>ACC: ±{Math.round(gps.accuracy)}m</span>
          </div>
        )}

        {/* ── Active Live Geolocation Stream Tray ───────────────────────────── */}
        {isStreaming && socialPosts.length > 0 && (
          <div className="absolute bottom-28 left-0 right-0 z-10 pointer-events-auto bg-black/90 border-t border-zinc-900 py-3">
            <div className="flex items-center justify-between px-4 mb-2">
              <span className="text-[9px] font-mono uppercase tracking-widest text-white">
                ● Live Local Social Stream
              </span>
              <button
                onClick={() => setShowSuggestions((v) => !v)}
                className="text-[9px] font-mono text-zinc-500 hover:text-zinc-300 uppercase"
              >
                {showSuggestions ? 'Collapse' : 'Expand'}
              </button>
            </div>

            {showSuggestions && (
              <div
                className="flex gap-3 overflow-x-auto px-4 pb-1"
                style={{ scrollbarWidth: 'none' }}
              >
                {socialPosts.map((post) => {
                  const isSelected = selectedPost?.id === post.id;
                  return (
                    <div
                      key={post.id}
                      onClick={() => setSelectedPost(post)}
                      className={`w-[170px] shrink-0 border cursor-pointer bg-black rounded-none overflow-hidden relative group transition-all duration-150
                        ${isSelected ? 'border-white' : 'border-zinc-900 hover:border-zinc-700'}`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={post.inspo_image_url}
                        alt={post.caption}
                        className="w-full aspect-[3/4] object-cover opacity-80"
                      />

                      {/* Platform Badges */}
                      <div className="absolute top-2 right-2 bg-black px-1.5 py-0.5 border border-zinc-900 text-[8px] font-mono uppercase text-zinc-400">
                        {post.platform}
                      </div>

                      {/* Card Info */}
                      <div className="p-2 bg-black border-t border-zinc-900 flex flex-col gap-0.5">
                        <span className="text-[9px] font-mono text-white truncate">{post.user_handle}</span>
                        <span className="text-[8px] text-zinc-500 font-mono">
                          {post.likes_count.toLocaleString()} engagement
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── Photo Capture Action ─────────────────────────────────────────── */}
        {isStreaming && (
          <div className="absolute bottom-8 left-0 right-0 flex justify-center z-10 pointer-events-auto">
            {camState === 'processing' ? (
              <div className="flex items-center gap-2 text-xs font-mono text-white bg-black border border-zinc-900 px-4 py-2">
                <Loader2 className="h-4 w-4 animate-spin text-white" />
                ANALYZING COMPOSITION...
              </div>
            ) : (
              <button
                onClick={captureFrame}
                disabled={['capturing', 'processing'].includes(camState)}
                className="h-16 w-16 rounded-full border-4 border-white flex items-center justify-center transition-all duration-150 active:scale-[0.95] bg-black/60 hover:bg-black"
                title="Capture photo frame"
              >
                <div className="h-10 w-10 rounded-full bg-white" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── Permissions onboarding wizard ─────────────────────────────────── */}
      {camState === 'idle' && (
        <PermissionsWizard
          onComplete={(coords) => startCameraWithCoords(coords)}
          onClose={() => startCamera()}
        />
      )}

      {/* ── Requesting hardware permissions ───────────────────────────────── */}
      {camState === 'requesting-permissions' && (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 bg-black">
          <Loader2 className="h-8 w-8 animate-spin text-white" />
          <p className="text-xs font-mono uppercase tracking-widest text-zinc-400">Initializing Viewport...</p>
        </div>
      )}

      {/* ── Camera initialization error boundary ──────────────────────────── */}
      {camState === 'error' && (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center bg-black">
          <AlertCircle className="h-8 w-8 text-red-500" />
          <p className="text-sm font-mono text-red-500 uppercase">{errorMsg}</p>
          <button
            onClick={() => { setCamState('idle'); setErrorMsg(''); }}
            className="flex items-center gap-2 border border-zinc-900 hover:border-zinc-800 bg-black text-xs font-mono uppercase px-4 py-2.5"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Re-initialize
          </button>
        </div>
      )}

      {/* ── AI Vision Analysis results ────────────────────────────────────── */}
      {camState === 'result' && result && (
        <div className="absolute inset-0 flex flex-col justify-end z-30 bg-black/95">
          <div className="p-8 flex flex-col gap-6 max-h-[85vh] overflow-y-auto border-t border-zinc-900 bg-black w-full max-w-md mx-auto">
            
            <div className="flex items-center justify-between border-b border-zinc-900 pb-3">
              <h2 className="text-sm font-mono uppercase tracking-wider text-white">AI Vision scored</h2>
              <span className="text-sm font-mono font-bold text-white px-2 py-0.5 border border-zinc-900">
                {result.matchAccuracy}% MATCH
              </span>
            </div>

            {/* composition adjustments suggestions */}
            {result.adjustments.length > 0 && (
              <div className="border border-zinc-900 p-4">
                <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest mb-2">Adjustments</p>
                <ul className="flex flex-col gap-2 font-mono text-xs text-zinc-300">
                  {result.adjustments.map((adj, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="text-zinc-500">•</span>
                      {adj}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Generated captions */}
            <div className="border border-zinc-900 p-4">
              <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest mb-2">Generated Caption</p>
              <p className="text-xs font-mono leading-relaxed text-zinc-300">{result.caption}</p>
            </div>

            {/* Semantic tags */}
            <div className="flex flex-wrap gap-1.5">
              {result.tags.map((tag) => (
                <span key={tag} className="text-[10px] font-mono border border-zinc-900 px-2 py-0.5 text-zinc-400">
                  #{tag}
                </span>
              ))}
            </div>

            {/* Return controls */}
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => { setResult(null); setCamState('streaming'); }}
                className="flex-1 border border-zinc-900 hover:border-zinc-800 text-zinc-400 hover:text-white py-3 text-xs font-mono uppercase tracking-wider"
              >
                Retake
              </button>
              <button
                onClick={() => window.location.href = '/scrapbook'}
                className="flex-1 bg-white text-black hover:bg-zinc-200 py-3 text-xs font-mono font-bold uppercase tracking-wider"
              >
                Scrapbook
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
