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


  // ── Draw wireframe stencil on canvas ──────────────────────────────────────
  const drawStencil = useCallback((imageUrl: string) => {
    const canvas = canvasRef.current;
    const video  = videoRef.current;
    if (!canvas || !video) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width  = video.videoWidth  || canvas.offsetWidth;
    canvas.height = video.videoHeight || canvas.offsetHeight;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Load reference image for edge analysis
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      // ctx is guaranteed non-null here — checked above before setting img.src
      const c = ctx!;
      const w = canvas.width;
      const h = canvas.height;

      // Draw low-opacity reference image as silhouette guide
      c.globalAlpha = 0.18;
      c.drawImage(img, 0, 0, w, h);
      c.globalAlpha = 1;

      // Draw rule-of-thirds grid
      c.strokeStyle = 'rgba(16,185,129,0.3)';
      c.lineWidth   = 1;
      c.setLineDash([4, 4]);
      [w / 3, (2 * w) / 3].forEach((x) => {
        c.beginPath(); c.moveTo(x, 0); c.lineTo(x, h); c.stroke();
      });
      [h / 3, (2 * h) / 3].forEach((y) => {
        c.beginPath(); c.moveTo(0, y); c.lineTo(w, y); c.stroke();
      });
      c.setLineDash([]);

      // Draw human pose wireframe skeleton
      c.strokeStyle = '#10b981';
      c.lineWidth   = 2;
      c.globalAlpha = 0.85;

      const cx = w / 2;
      const scale = h / 440;

      function line(x1: number, y1: number, x2: number, y2: number) {
        c.beginPath();
        c.moveTo(cx + (x1 - 110) * scale, y1 * scale);
        c.lineTo(cx + (x2 - 110) * scale, y2 * scale);
        c.stroke();
      }
      function dot(x: number, y: number) {
        c.beginPath();
        c.arc(cx + (x - 110) * scale, y * scale, 3 * scale, 0, Math.PI * 2);
        c.fillStyle = '#10b981';
        c.fill();
      }

      // Head
      c.beginPath();
      c.arc(cx, 120 * scale, 18 * scale, 0, Math.PI * 2);
      c.stroke();

      // Body
      line(110, 138, 110, 158); // neck
      line(70, 165, 150, 165);  // shoulders
      line(110, 158, 110, 265); // torso
      line(82, 265, 138, 265);  // hips
      // Arms
      line(70, 165, 50, 215); line(50, 215, 40, 250);
      line(150, 165, 170, 215); line(170, 215, 180, 250);
      // Legs
      line(90, 265, 82, 330); line(82, 330, 78, 390);
      line(130, 265, 138, 330); line(138, 330, 142, 390);
      // Feet
      line(70, 390, 88, 390); line(132, 390, 152, 390);

      // Joints
      [[70,165],[150,165],[50,215],[170,215],[82,265],[138,265]].forEach(
        ([x,y]) => dot(x,y)
      );

      c.globalAlpha = 1;
    };
    img.onerror = () => {
      // If image fails to load, still show the grid and skeleton
      drawFallbackStencil(ctx, canvas.width, canvas.height);
    };
    img.src = imageUrl;
  }, []);

  function drawFallbackStencil(ctx: CanvasRenderingContext2D, w: number, h: number) {
    ctx.clearRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(16,185,129,0.3)';
    ctx.lineWidth   = 1;
    ctx.setLineDash([4, 4]);
    [w/3, 2*w/3].forEach(x => { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,h); ctx.stroke(); });
    [h/3, 2*h/3].forEach(y => { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(w,y); ctx.stroke(); });
    ctx.setLineDash([]);
  }

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
            const canvas = canvasRef.current;
            if (canvas) {
              const ctx = canvas.getContext('2d');
              ctx?.clearRect(0, 0, canvas.width, canvas.height);
            }
          }
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

  // ── Capture frame ──────────────────────────────────────────────────────────
  async function captureFrame() {
    if (!videoRef.current || !hotspot) return;
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
          hotspotImageUrl: hotspot.inspo_image_url,
          hotspotId:       hotspot.id,
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
        style={{ display: camState === 'hotspot-found' ? 'block' : 'none' }}
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
          {/* Top status bar */}
          <div className="absolute top-4 left-0 right-0 flex justify-center pointer-events-none z-10">
            {camState === 'hotspot-found' && hotspot ? (
              <div className="flex flex-col items-center gap-1">
                <div
                  className="rounded border px-3 py-1 text-xs font-mono"
                  style={{ borderColor: '#10b981', color: '#10b981', background: 'rgba(0,0,0,0.75)' }}
                >
                  ● HOTSPOT LOCKED
                </div>
                <div
                  className="rounded px-2 py-0.5 text-xs"
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
                SCANNING FOR HOTSPOT…
              </div>
            )}
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
                disabled={camState !== 'hotspot-found'}
                id="capture-btn"
                aria-label="Capture photo"
                className={`h-16 w-16 rounded-full border-4 border-white flex items-center justify-center transition-opacity
                  ${camState === 'hotspot-found' ? 'opacity-100 capture-btn-pulse' : 'opacity-30 cursor-not-allowed'}`}
                style={{ background: 'rgba(0,0,0,0.5)' }}
              >
                <div
                  className="h-10 w-10 rounded-full"
                  style={{ background: camState === 'hotspot-found' ? '#10b981' : '#fff' }}
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
    </div>
  );
}
