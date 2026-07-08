'use client';

import { useRef, useEffect, useState, useCallback } from 'react';
import { toast } from 'sonner';
import { Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { throttle } from '@/lib/utils';
import type { NearbyHotspot, CameraState, ProcessShotResponse, GpsCoordinates } from '@/lib/types';
import PermissionsWizard from '@/components/camera/PermissionsWizard';


export default function CameraPage() {
  const videoRef    = useRef<HTMLVideoElement>(null);
  const canvasRef   = useRef<HTMLCanvasElement>(null);
  const streamRef   = useRef<MediaStream | null>(null);
  const watchIdRef  = useRef<number | null>(null);

  const [camState,  setCamState]  = useState<CameraState>('idle');
  const [gps,       setGps]       = useState<GpsCoordinates | null>(null);
  const [hotspot,   setHotspot]   = useState<NearbyHotspot | null>(null);
  const [result,    setResult]    = useState<ProcessShotResponse | null>(null);
  const [errorMsg,  setErrorMsg]  = useState<string>('');

  const [showPinModal, setShowPinModal] = useState(false);
  const [pinTitle, setPinTitle] = useState('');
  const [pinDescription, setPinDescription] = useState('');
  const [pinImageUrl, setPinImageUrl] = useState('https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&q=75');
  const [pinLoading, setPinLoading] = useState(false);


  // ── Draw wireframe stencil on canvas ──────────────────────────────────────
  const drawStencil = useCallback((imageUrl: string | null) => {
    const canvas = canvasRef.current;
    const video  = videoRef.current;
    if (!canvas || !video) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width  = video.videoWidth  || canvas.offsetWidth || 640;
    canvas.height = video.videoHeight || canvas.offsetHeight || 480;

    const w = canvas.width;
    const h = canvas.height;

    ctx.clearRect(0, 0, w, h);

    function drawCompositionGuides(c: CanvasRenderingContext2D) {
      // Thin 1px white rule-of-thirds lines
      c.strokeStyle = 'rgba(255, 255, 255, 0.2)';
      c.lineWidth   = 1;
      
      [w / 3, (2 * w) / 3].forEach((x) => {
        c.beginPath(); c.moveTo(x, 0); c.lineTo(x, h); c.stroke();
      });
      [h / 3, (2 * h) / 3].forEach((y) => {
        c.beginPath(); c.moveTo(0, y); c.lineTo(w, y); c.stroke();
      });

      // Center crosshair (20px each arm)
      const cx = w / 2;
      const cy = h / 2;
      const arm = 10;
      c.strokeStyle = 'rgba(255, 255, 255, 0.4)';
      c.beginPath();
      c.moveTo(cx - arm, cy); c.lineTo(cx + arm, cy);
      c.moveTo(cx, cy - arm); c.lineTo(cx, cy + arm);
      c.stroke();
    }

    if (imageUrl) {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const c = ctx!;
        c.globalAlpha = 0.12;
        c.drawImage(img, 0, 0, w, h);
        c.globalAlpha = 1;
        drawCompositionGuides(c);
      };
      img.onerror = () => {
        drawCompositionGuides(ctx);
      };
      img.src = imageUrl;
    } else {
      drawCompositionGuides(ctx);
    }
  }, []);

  // ── Query nearby hotspots ──────────────────────────────────────────────────
  const checkProximity = useCallback(
    // eslint-disable-next-line react-hooks/exhaustive-deps
    throttle(async (coords: GpsCoordinates) => {
      try {
        const res = await fetch(
          `/api/hotspots/nearby?lat=${coords.latitude}&lng=${coords.longitude}&radius=15`
        );
        if (!res.ok) return;
        const json = await res.json();
        const nearest: NearbyHotspot | undefined = json.hotspots?.[0];
        if (nearest) {
          setHotspot(nearest);
          setCamState('hotspot-found');
          drawStencil(nearest.inspo_image_url);
        } else {
          setHotspot(null);
          if (camState === 'hotspot-found') {
            setCamState('streaming');
          }
          drawStencil(null);
        }
      } catch {
        // Proximity check failure is non-fatal
      }
    }, 3000),
    [drawStencil, camState]
  );

  // ── Start camera stream ────────────────────────────────────────────────────
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
      drawStencil(null);

      // Start GPS watch
      if ('geolocation' in navigator) {
        watchIdRef.current = navigator.geolocation.watchPosition(
          (pos) => {
            const coords: GpsCoordinates = {
              latitude:  pos.coords.latitude,
              longitude: pos.coords.longitude,
              accuracy:  pos.coords.accuracy,
            };
            setGps(coords);
            checkProximity(coords);
          },
          (err) => {
            console.warn('[GPS]', err.message);
            toast.error('GPS unavailable — hotspot detection disabled.');
          },
          { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
        );
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Camera access denied.';
      setErrorMsg(msg);
      setCamState('error');
    }
  }

  async function startCameraWithCoords(coords: { latitude: number; longitude: number }) {
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
      drawStencil(null);

      const initGps: GpsCoordinates = {
        latitude: coords.latitude,
        longitude: coords.longitude,
        accuracy: 10,
      };
      setGps(initGps);
      checkProximity(initGps);

      if ('geolocation' in navigator) {
        watchIdRef.current = navigator.geolocation.watchPosition(
          (pos) => {
            const nextGps: GpsCoordinates = {
              latitude:  pos.coords.latitude,
              longitude: pos.coords.longitude,
              accuracy:  pos.coords.accuracy,
            };
            setGps(nextGps);
            checkProximity(nextGps);
          },
          (err) => {
            console.warn('[GPS]', err.message);
            toast.error('GPS update failed.');
          },
          { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
        );
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Camera access failed.';
      setErrorMsg(msg);
      setCamState('error');
    }
  }

  async function handlePinHotspot(e: React.FormEvent) {
    e.preventDefault();
    if (!gps) {
      toast.error('GPS coordinates not resolved yet. Wait for a location lock.');
      return;
    }
    if (!pinTitle.trim()) {
      toast.error('Title is required.');
      return;
    }
    if (!pinImageUrl.trim()) {
      toast.error('Reference image URL is required.');
      return;
    }

    setPinLoading(true);
    try {
      const res = await fetch('/api/hotspots/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: pinTitle,
          description: pinDescription,
          inspoImageUrl: pinImageUrl,
          lat: gps.latitude,
          lng: gps.longitude,
        }),
      });

      if (!res.ok) throw new Error('Failed to create hotspot.');
      const data = await res.json();
      
      const newHotspot = data.hotspot as NearbyHotspot;
      setHotspot(newHotspot);
      setCamState('hotspot-found');
      drawStencil(newHotspot.inspo_image_url);
      
      toast.success(`Hotspot "${newHotspot.title}" pinned successfully!`);
      setShowPinModal(false);
      
      // Reset form fields
      setPinTitle('');
      setPinDescription('');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error pinning hotspot.');
    } finally {
      setPinLoading(false);
    }
  }

  // ── Capture frame ──────────────────────────────────────────────────────────
  async function captureFrame() {
    if (!videoRef.current) return;
    setCamState('capturing');

    const snapCanvas = document.createElement('canvas');
    snapCanvas.width  = videoRef.current.videoWidth;
    snapCanvas.height = videoRef.current.videoHeight;
    const ctx = snapCanvas.getContext('2d')!;
    ctx.drawImage(videoRef.current, 0, 0);
    const imageBase64 = snapCanvas.toDataURL('image/jpeg', 0.75);

    setCamState('processing');

    try {
      const res = await fetch('/api/process-shot', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64,
          hotspotImageUrl: hotspot?.inspo_image_url ?? null,
          hotspotId:       hotspot?.id ?? null,
        }),
      });

      if (!res.ok) throw new Error('Processing failed.');
      const data: ProcessShotResponse = await res.json();
      setResult(data);
      setCamState('result');
      toast.success(`Shot scored: ${data.matchAccuracy}%`);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Processing failed.');
      setCamState('error');
    }
  }

  // ── Cleanup on unmount ─────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  const isStreaming = ['streaming', 'hotspot-found', 'capturing', 'processing'].includes(camState);

  return (
    <div className="camera-viewport flex flex-col">
      {/* ── Video ──────────────────────────────────────────────────────── */}
      <video
        ref={videoRef}
        className="camera-video"
        playsInline
        muted
        autoPlay
        style={{ display: isStreaming ? 'block' : 'none' }}
        aria-label="Camera feed"
      />

      {/* ── Canvas Overlay ─────────────────────────────────────────────── */}
      <canvas
        ref={canvasRef}
        className="camera-canvas"
        style={{ display: isStreaming ? 'block' : 'none' }}
        aria-hidden="true"
      />

      {/* ── Permissions Onboarding Wizard ────────────────────────────────── */}
      {camState === 'idle' && (
        <PermissionsWizard
          onComplete={(coords) => startCameraWithCoords(coords)}
          onClose={() => startCamera()}
        />
      )}

      {/* ── Requesting permissions ─────────────────────────────────────── */}
      {camState === 'requesting-permissions' && (
        <div className="flex flex-1 flex-col items-center justify-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
          <p className="text-sm text-zinc-400">Requesting camera & GPS…</p>
        </div>
      )}

      {/* ── Error ──────────────────────────────────────────────────────── */}
      {camState === 'error' && (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
          <AlertCircle className="h-8 w-8 text-red-400" />
          <p className="text-sm text-red-400">{errorMsg}</p>
          <Button variant="outline" onClick={() => { setCamState('idle'); setErrorMsg(''); }}>
            <RefreshCw className="h-4 w-4" /> Try again
          </Button>
        </div>
      )}

      {/* ── HUD Overlays (on top of video) ─────────────────────────────── */}
      {isStreaming && (
        <>
          {/* Top status bar & Action pill */}
          <div className="absolute top-4 left-0 right-0 flex flex-col items-center gap-2 z-10 pointer-events-none">
            <div className="flex items-center gap-2 pointer-events-auto">
              {camState === 'hotspot-found' && hotspot ? (
                <div className="flex flex-col items-center gap-1">
                  <div
                    className="rounded border px-3 py-1 text-xs font-mono"
                    style={{ borderColor: '#10b981', color: '#10b981', background: 'rgba(0,0,0,0.75)' }}
                  >
                    ● HOTSPOT LOCKED
                  </div>
                  <div
                    className="rounded px-2 py-0.5 text-xs font-mono"
                    style={{ color: '#a1a1aa', background: 'rgba(0,0,0,0.6)' }}
                  >
                    {hotspot.title}
                  </div>
                </div>
              ) : (
                <div
                  className="rounded border px-3 py-1 text-xs font-mono"
                  style={{ borderColor: '#27272a', color: '#71717a', background: 'rgba(0,0,0,0.6)' }}
                >
                  COMPOSITION GUIDE ACTIVE
                </div>
              )}
            </div>

            <button
              onClick={() => {
                if (!gps) {
                  toast.error('GPS location not resolved yet.');
                  return;
                }
                setShowPinModal(true);
              }}
              className="pointer-events-auto text-[10px] font-mono border border-zinc-800 bg-zinc-950/90 text-zinc-400 px-2.5 py-1 rounded hover:text-white hover:border-zinc-700 transition-colors duration-150"
            >
              PIN CURRENT LOCATION
            </button>
          </div>

          {/* GPS accuracy bottom-left */}
          {gps && (
            <div
              className="absolute bottom-24 left-4 pointer-events-none text-xs font-mono z-10"
              style={{ color: '#71717a' }}
            >
              ±{Math.round(gps.accuracy)}m
            </div>
          )}

          {/* Capture / Processing button */}
          <div className="absolute bottom-10 left-0 right-0 flex justify-center z-10">
            {camState === 'processing' ? (
              <div className="flex items-center gap-2 text-sm text-white">
                <Loader2 className="h-5 w-5 animate-spin text-emerald-500" />
                Analysing with AI…
              </div>
            ) : (
              <button
                onClick={captureFrame}
                disabled={['capturing', 'processing'].includes(camState)}
                id="capture-btn"
                aria-label="Capture photo"
                className={`h-16 w-16 rounded-full border-4 border-white flex items-center justify-center transition-all duration-150 active:scale-[0.95]
                  ${camState === 'hotspot-found' ? 'capture-btn-pulse' : ''}`}
                style={{ background: 'rgba(0,0,0,0.5)' }}
              >
                <div
                  className="h-10 w-10 rounded-full transition-colors duration-150"
                  style={{ background: camState === 'hotspot-found' ? '#10b981' : '#ffffff' }}
                />
              </button>
            )}
          </div>
        </>
      )}

      {/* ── Result Overlay ─────────────────────────────────────────────── */}
      {camState === 'result' && result && (
        <div className="absolute inset-0 flex flex-col justify-end z-20" style={{ background: 'rgba(0,0,0,0.85)' }}>
          <div className="p-6 flex flex-col gap-4 max-h-[70vh] overflow-y-auto">
            {/* Score */}
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold">Shot Analysed</h2>
              <Badge
                variant={result.matchAccuracy >= 95 ? 'perfect' : result.matchAccuracy >= 70 ? 'good' : 'low'}
              >
                {result.matchAccuracy}% match
              </Badge>
            </div>

            {/* Adjustments */}
            {result.adjustments.length > 0 && (
              <div className="border border-zinc-800 rounded-md p-3">
                <p className="text-xs text-zinc-500 mb-2 uppercase tracking-wide">Adjustments</p>
                <ul className="flex flex-col gap-1.5">
                  {result.adjustments.map((adj, i) => (
                    <li key={i} className="text-sm text-white flex gap-2">
                      <span className="text-amber-400 shrink-0">→</span>
                      {adj}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Caption */}
            <div className="border border-zinc-800 rounded-md p-3">
              <p className="text-xs text-zinc-500 mb-2 uppercase tracking-wide">AI Caption</p>
              <p className="text-sm text-white leading-relaxed">{result.caption}</p>
            </div>

            {/* Tags */}
            <div className="flex flex-wrap gap-1.5">
              {result.tags.map((tag) => (
                <span key={tag} className="text-xs text-emerald-400 font-mono">#{tag}</span>
              ))}
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => { setResult(null); setCamState('hotspot-found'); }}
              >
                Retake
              </Button>
              <Button
                className="flex-1"
                onClick={() => window.location.href = '/scrapbook'}
              >
                View Scrapbook
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Pin Hotspot Dialog Modal ─────────────────────────────────────── */}
      {showPinModal && (
        <div className="fixed inset-0 bg-black/90 z-40 flex items-center justify-center p-6 select-none animate-fade-in">
          <form 
            onSubmit={handlePinHotspot}
            className="w-full max-w-sm border border-zinc-900 bg-black p-8 flex flex-col gap-6"
          >
            <div>
              <h2 className="text-xl font-bold text-white tracking-tight uppercase">Pin Location</h2>
              <p className="text-xs text-zinc-500 font-mono mt-1">{"// SAVE CURRENT COORDINATES"}</p>
            </div>

            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-zinc-400 font-mono uppercase tracking-wider">Hotspot Title</label>
                <input
                  type="text"
                  placeholder="e.g. My Secret Sunset Spot"
                  value={pinTitle}
                  onChange={(e) => setPinTitle(e.target.value)}
                  className="bg-zinc-950 border border-zinc-900 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-zinc-700 font-mono"
                  required
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-zinc-400 font-mono uppercase tracking-wider">Description (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Align the shoreline..."
                  value={pinDescription}
                  onChange={(e) => setPinDescription(e.target.value)}
                  className="bg-zinc-950 border border-zinc-900 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-zinc-700 font-mono"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-zinc-400 font-mono uppercase tracking-wider">Reference Image URL</label>
                <input
                  type="url"
                  placeholder="Unsplash / Direct photo link"
                  value={pinImageUrl}
                  onChange={(e) => setPinImageUrl(e.target.value)}
                  className="bg-zinc-950 border border-zinc-900 rounded px-3 py-2 text-xs text-white focus:outline-none focus:border-zinc-700 font-mono"
                  required
                />
              </div>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowPinModal(false)}
                className="flex-1 border border-zinc-900 hover:border-zinc-800 text-zinc-400 hover:text-white rounded py-2.5 text-xs font-mono tracking-wider transition-colors duration-150 uppercase"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={pinLoading}
                className="flex-1 bg-white text-black hover:bg-zinc-200 disabled:opacity-50 rounded py-2.5 text-xs font-mono font-bold tracking-wider transition-colors duration-150 uppercase"
              >
                {pinLoading ? 'Saving...' : 'Pin Spot'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
