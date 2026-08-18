'use client';

import { useRef, useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { 
  ArrowLeft, Sliders, AlertCircle, RefreshCw, LayoutGrid, 
  Check, Camera, X, Search, Sparkles, Image as ImageIcon,
  RotateCcw, ChevronRight, Compass, Star
} from 'lucide-react';
import type { CameraState, ProcessShotResponse, GpsCoordinates } from '@/lib/types';
import type { LocationSearchResult, SocialPost } from '@/app/api/location/search/route';
import PermissionsWizard from '@/components/camera/PermissionsWizard';
import { getSmartLocation } from '@/lib/geo-fallback';

export default function CameraPage() {
  const router = useRouter();
  
  // Viewport Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const lastFetchTimeRef = useRef<number>(0);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Core State
  const [camState, setCamState] = useState<CameraState>('idle');
  const [gps, setGps] = useState<GpsCoordinates | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [result, setResult] = useState<ProcessShotResponse | null>(null);
  const [socialPosts, setSocialPosts] = useState<SocialPost[]>([]);
  const [emptyMessage, setEmptyMessage] = useState<string>('No outdoor inspiration photos found near this location yet.');

  // Reference Stencil & Interface variables
  const [selectedPost, setSelectedPost] = useState<SocialPost | null>(null);
  const [overlayOpacity, setOverlayOpacity] = useState<number>(0.35);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');

  // Sidebar toggle state
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(false);

  // Manual Location Search Override variables
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isManualOverride, setIsManualOverride] = useState<boolean>(false);

  // HUD & Sensors
  const [showControls, setShowControls] = useState<boolean>(true);
  const [isPoseGuideActive, setIsPoseGuideActive] = useState<boolean>(false);
  const [poseMatch, setPoseMatch] = useState<number | null>(null);
  const [isPoseLoading, setIsPoseLoading] = useState<boolean>(false);
  const [shutterPressing, setShutterPressing] = useState<boolean>(false);
  const [flashActive, setFlashActive] = useState<boolean>(false);
  
  const poseLoopRef = useRef<number | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const posenetNetRef = useRef<any>(null);

  // ── Auto-hide Controls Bar Interface ──────────────────────────────────────
  const resetControlsTimeout = useCallback(() => {
    setShowControls(true);
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    controlsTimeoutRef.current = setTimeout(() => {
      if (['streaming', 'hotspot-found'].includes(camState) && !sidebarOpen) {
        setShowControls(false);
      }
    }, 6000);
  }, [camState, sidebarOpen]);

  useEffect(() => {
    resetControlsTimeout();
    return () => {
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
    };
  }, [camState, resetControlsTimeout]);

  // ── Clean Viewport (Grid Removed per user request) ─────────────────────────
  const clearCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
  }, []);

  // ── Lazy-Load PoseNet & TensorFlow.js ─────────────────────────────────────
  const togglePoseGuide = async () => {
    if (isPoseGuideActive) {
      stopPoseTracking();
      return;
    }

    setIsPoseLoading(true);
    try {
      const loadScript = (src: string) => {
        return new Promise<void>((resolve, reject) => {
          if (document.querySelector(`script[src="${src}"]`)) {
            resolve();
            return;
          }
          const s = document.createElement('script');
          s.src = src;
          s.onload = () => resolve();
          s.onerror = () => reject();
          document.head.appendChild(s);
        });
      };

      await loadScript('https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@3.11.0/dist/tf.min.js');
      await loadScript('https://cdn.jsdelivr.net/npm/@tensorflow-models/posenet@2.2.2/dist/posenet.min.js');

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const windowAny = window as any;
      if (!posenetNetRef.current && windowAny.posenet) {
        posenetNetRef.current = await windowAny.posenet.load({
          architecture: 'MobileNetV1',
          outputStride: 16,
          inputResolution: { width: 257, height: 200 },
          multiplier: 0.5
        });
      }

      setIsPoseGuideActive(true);
      setIsPoseLoading(false);
      
      const canvas = canvasRef.current;
      if (canvas && videoRef.current) {
        canvas.width = videoRef.current.videoWidth || canvas.offsetWidth || 640;
        canvas.height = videoRef.current.videoHeight || canvas.offsetHeight || 480;
      }
      runPoseLoop();
    } catch (err) {
      console.error("Failed to load PoseNet:", err);
      toast.error("Failed to load Pose Guide.");
      setIsPoseLoading(false);
    }
  };

  const stopPoseTracking = () => {
    setIsPoseGuideActive(false);
    setPoseMatch(null);
    if (poseLoopRef.current) {
      cancelAnimationFrame(poseLoopRef.current);
      poseLoopRef.current = null;
    }
    clearCanvas();
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const calculatePoseMatch = (keypoints: any[]) => {
    const leftShoulder = keypoints.find((k) => k.part === 'leftShoulder');
    const rightShoulder = keypoints.find((k) => k.part === 'rightShoulder');
    const nose = keypoints.find((k) => k.part === 'nose');

    if (!leftShoulder || !rightShoulder || !nose || leftShoulder.score < 0.4 || rightShoulder.score < 0.4) {
      return 52; 
    }

    const canvas = canvasRef.current;
    if (!canvas) return 60;
    
    const centerX = canvas.width / 2;
    const noseDist = Math.abs(nose.position.x - centerX);
    const centeringScore = Math.max(0, 100 - (noseDist / (centerX * 0.8)) * 100);

    const diffY = Math.abs(leftShoulder.position.y - rightShoulder.position.y);
    const balanceScore = Math.max(0, 100 - diffY * 3.5);

    const alignment = Math.round(centeringScore * 0.4 + balanceScore * 0.6);
    return Math.min(98, Math.max(52, alignment));
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const drawSkeleton = (keypoints: any[], ctx: CanvasRenderingContext2D) => {
    ctx.strokeStyle = '#10b981';
    ctx.fillStyle = '#10b981';
    ctx.lineWidth = 2;

    keypoints.forEach((kp) => {
      if (kp.score > 0.45 && ['nose', 'leftShoulder', 'rightShoulder', 'leftElbow', 'rightElbow', 'leftWrist', 'rightWrist'].includes(kp.part)) {
        ctx.beginPath();
        ctx.arc(kp.position.x, kp.position.y, 4, 0, 2 * Math.PI);
        ctx.fill();
      }
    });

    const drawSegment = (p1Name: string, p2Name: string) => {
      const p1 = keypoints.find((k) => k.part === p1Name);
      const p2 = keypoints.find((k) => k.part === p2Name);
      if (p1 && p2 && p1.score > 0.45 && p2.score > 0.45) {
        ctx.beginPath();
        ctx.moveTo(p1.position.x, p1.position.y);
        ctx.lineTo(p2.position.x, p2.position.y);
        ctx.stroke();
      }
    };

    drawSegment('leftShoulder', 'rightShoulder');
    drawSegment('leftShoulder', 'leftElbow');
    drawSegment('leftElbow', 'leftWrist');
    drawSegment('rightShoulder', 'rightElbow');
    drawSegment('rightElbow', 'rightWrist');
  };

  const runPoseLoop = () => {
    if (!videoRef.current || !canvasRef.current) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const net = posenetNetRef.current;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    const track = async () => {
      if (video.paused || video.ended) return;

      try {
        const pose = await net.estimateSinglePose(video, {
          flipHorizontal: false
        });

        if (ctx && canvas) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          drawSkeleton(pose.keypoints, ctx);
          const score = calculatePoseMatch(pose.keypoints);
          setPoseMatch(score);
        }
      } catch (err) {
        console.warn("Pose tracking frame error", err);
      }

      if (posenetNetRef.current) {
        setTimeout(() => {
          poseLoopRef.current = requestAnimationFrame(track);
        }, 75);
      }
    };

    poseLoopRef.current = requestAnimationFrame(track);
  };

  // ── Fetch local suggestion posts near coordinates ─────────────────────────
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
        if (data.message) {
          setEmptyMessage(data.message);
        }
        if (!selectedPost && data.posts.length > 0) {
          setSelectedPost(data.posts[0]);
        }
      }
    } catch {
      // Non-fatal
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
        if (data.message) {
          setEmptyMessage(data.message);
        }
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
  const clearManualOverride = useCallback(async () => {
    setIsManualOverride(false);
    setSearchQuery('');
    const loc = await getSmartLocation();
    setGps({ latitude: loc.latitude, longitude: loc.longitude, accuracy: 10 });
    fetchSocialPosts(loc.latitude, loc.longitude);
  }, [fetchSocialPosts]);

  // ── Start browser camera video streaming ──────────────────────────────────
  async function startCamera() {
    setCamState('requesting-permissions');
    setErrorMsg('');
    setResult(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode, width: { ideal: 1280 }, height: { ideal: 720 } },
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

  // ── Flip Facing Mode Camera ───────────────────────────────────────────────
  const flipCamera = async () => {
    const nextMode = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(nextMode);
    
    streamRef.current?.getTracks().forEach((track) => track.stop());

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: nextMode, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
    } catch {
      toast.error("Failed to swap camera lenses.");
    }
  };

  // ── Real-Time Location watch ──────────────────────────────────────────────
  useEffect(() => {
    if (['streaming', 'hotspot-found'].includes(camState)) {
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
          () => {
            if (!gps) {
              const defaultCoords: GpsCoordinates = { latitude: 19.076, longitude: 72.877, accuracy: 100 };
              setGps(defaultCoords);
              if (!isManualOverride) {
                fetchSocialPosts(defaultCoords.latitude, defaultCoords.longitude);
              }
            }
          },
          { enableHighAccuracy: false, timeout: 10000, maximumAge: 30000 }
        );
      }
    }
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [camState, fetchSocialPosts, isManualOverride, gps]);

  // ── Capture Photo & Send to Groq Vision ────────────────────────────────────
  async function captureFrame() {
    if (!videoRef.current) return;
    
    // Shutter flash & haptic effect
    setShutterPressing(true);
    setFlashActive(true);
    setTimeout(() => setFlashActive(false), 150);
    setTimeout(() => setShutterPressing(false), 200);

    setCamState('capturing');

    const snapCanvas = document.createElement('canvas');
    snapCanvas.width = videoRef.current.videoWidth || 1280;
    snapCanvas.height = videoRef.current.videoHeight || 720;
    const ctx = snapCanvas.getContext('2d')!;
    
    if (facingMode === 'user') {
      ctx.translate(snapCanvas.width, 0);
      ctx.scale(-1, 1);
    }
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
        let errMsg = 'Groq AI analysis failed.';
        try {
          const errData = await res.json();
          if (errData && errData.error) errMsg = errData.error;
        } catch {}
        throw new Error(errMsg);
      }
      
      const data: ProcessShotResponse = await res.json();
      setResult(data);
      setCamState('result');
      
      toast.success('Groq AI Analysis complete!');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Processing failed.');
      setCamState('error');
    }
  }

  // ── Cleanup ────────────────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
      if (poseLoopRef.current) {
        cancelAnimationFrame(poseLoopRef.current);
      }
    };
  }, []);

  const isStreaming = ['streaming', 'hotspot-found', 'capturing', 'processing'].includes(camState);
  const activeLocationName = selectedPost?.title || (isManualOverride ? searchQuery : 'Local GPS Area');

  return (
    <div 
      className="fixed inset-0 w-full h-full bg-black text-white select-none overflow-hidden font-sans flex flex-col"
      onClick={resetControlsTimeout}
    >
      {/* ── 0. Permissions Onboarding Wizard ───────────────────────────── */}
      {camState === 'idle' && (
        <PermissionsWizard
          onComplete={(coords) => startCameraWithCoords(coords)}
          onClose={() => startCamera()}
        />
      )}

      {/* ── Error Banner ────────────────────────────────────────────────── */}
      {camState === 'error' && (
        <div className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-center p-6 text-center">
          <AlertCircle className="h-10 w-10 text-red-500 mb-4" />
          <h2 className="text-lg font-bold text-white font-mono uppercase mb-2">Camera Access Error</h2>
          <p className="text-xs text-zinc-400 font-mono mb-6 max-w-sm">{errorMsg || 'Unable to start camera stream.'}</p>
          <button
            onClick={() => startCamera()}
            className="bg-emerald-500 hover:bg-emerald-400 text-black font-mono font-bold text-xs uppercase px-6 py-3 rounded-lg"
          >
            Retry Camera Access
          </button>
        </div>
      )}

      {/* ── 1. Shutter camera flash animation overlay ─────────────────────────── */}
      <div 
        className={`absolute inset-0 bg-white z-40 transition-opacity duration-150 pointer-events-none ${
          flashActive ? 'opacity-100' : 'opacity-0'
        }`}
      />

      {/* ── 2. Full-Screen Normal Clean Viewfinder Camera Feed ────────────────────── */}
      <div className="absolute inset-0 w-full h-full bg-black z-0">
        <video
          ref={videoRef}
          className="w-full h-full object-cover select-none pointer-events-none"
          playsInline
          muted
          autoPlay
          style={{ display: isStreaming ? 'block' : 'none', transform: facingMode === 'user' ? 'scaleX(-1)' : 'none' }}
          aria-label="Live camera preview feed"
        />

        {/* Clean Canvas (used only for PoseNet skeleton when active, no grid) */}
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full pointer-events-none z-10"
          style={{ display: isStreaming ? 'block' : 'none' }}
          aria-hidden="true"
        />

        {/* Reference Stencil Overlay (Optional when selected) */}
        {isStreaming && selectedPost && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={selectedPost.inspo_image_url}
            alt="Reference guide outline overlay"
            className="absolute inset-0 w-full h-full object-cover pointer-events-none transition-opacity duration-150 z-10 select-none"
            style={{ opacity: overlayOpacity, mixBlendMode: 'difference' }}
          />
        )}
      </div>

      {/* ── 3. Floating Interactive Overlay HUD Controls ───────────────────────── */}
      {isStreaming && (
        <div className="absolute inset-0 pointer-events-none flex flex-col justify-between z-20">
          
          {/* Top Bar Floating Panel */}
          <div 
            className={`w-full bg-gradient-to-b from-black/90 via-black/40 to-transparent pt-5 pb-8 px-4 transition-all duration-300 pointer-events-auto ${
              showControls ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4 pointer-events-none'
            }`}
          >
            <div className="max-w-md mx-auto w-full flex items-center justify-between gap-3">
              
              {/* Back Button */}
              <button 
                onClick={() => router.push('/dashboard')}
                className="h-10 w-10 border border-zinc-800 bg-black/80 hover:bg-zinc-900 flex items-center justify-center rounded-lg active:scale-95 transition-all"
                title="Return to dashboard"
              >
                <ArrowLeft className="h-4 w-4 text-white" />
              </button>

              {/* Location Name Header */}
              <div className="flex-1 flex flex-col items-center text-center px-2">
                <span className="text-[10px] font-mono tracking-widest text-emerald-400 font-bold uppercase truncate max-w-[180px]">
                  {activeLocationName}
                </span>
                <span className="text-[8px] font-mono text-zinc-500 uppercase tracking-widest mt-0.5">
                  ● CLEAN VIEWPORT ACTIVE
                </span>
              </div>

              {/* Top Right Action Buttons: Toggle Suggestions Sidebar + Pose Guide */}
              <div className="flex gap-2">
                {/* Suggestions Sidebar Button */}
                <button
                  onClick={() => setSidebarOpen(true)}
                  className="h-10 px-3 bg-emerald-500 hover:bg-emerald-400 text-black border border-black font-mono font-bold text-[9px] uppercase tracking-widest flex items-center gap-1.5 rounded-lg transition-all active:scale-95"
                  title="Open Framing Suggestions Sidebar"
                >
                  <ImageIcon className="h-3.5 w-3.5" />
                  Suggestions ({socialPosts.length})
                </button>

                {/* Pose Guide Toggle */}
                <button
                  onClick={togglePoseGuide}
                  disabled={isPoseLoading}
                  className={`h-10 px-2.5 border rounded-lg flex items-center gap-1 text-[9px] font-mono uppercase font-bold transition-all ${
                    isPoseGuideActive 
                      ? 'bg-emerald-500 border-emerald-600 text-black' 
                      : 'border-zinc-800 bg-black/80 hover:bg-zinc-900 text-white'
                  }`}
                  title="Toggle Pose Guide"
                >
                  <Camera className="h-3.5 w-3.5" />
                  {isPoseLoading ? '…' : 'Pose'}
                </button>
              </div>
            </div>
          </div>

          {/* Center Pose alignment feedback banner */}
          <div className="flex-1 flex items-center justify-center p-4">
            {isPoseGuideActive && (
              <div className="bg-black/90 border border-emerald-900 px-3 py-1.5 font-mono text-[9px] text-emerald-400 uppercase tracking-widest animate-pulse flex items-center gap-1.5 rounded shadow-xl">
                <span className="h-2 w-2 rounded-full bg-emerald-500 inline-block animate-ping" />
                POSE STENCIL: {poseMatch !== null ? `${poseMatch}% ALIGNED` : 'DETECTING POSE…'}
              </div>
            )}
          </div>

          {/* Bottom Control Bar */}
          <div 
            className={`w-full bg-gradient-to-t from-black/95 via-black/50 to-transparent pb-8 pt-12 px-4 transition-all duration-300 pointer-events-auto ${
              showControls ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'
            }`}
          >
            <div className="max-w-md mx-auto w-full flex flex-col gap-4">
              
              {/* Opacity slider when reference selected */}
              {selectedPost && (
                <div className="flex items-center gap-3 bg-black/85 border border-zinc-800 px-3 py-2 rounded-lg animate-slide-up self-center w-56 shadow-md">
                  <Sliders className="h-3.5 w-3.5 text-zinc-500" />
                  <input
                    type="range"
                    min="0.0"
                    max="1.0"
                    step="0.05"
                    value={overlayOpacity}
                    onChange={(e) => setOverlayOpacity(parseFloat(e.target.value))}
                    className="w-full h-1 bg-zinc-800 rounded appearance-none cursor-pointer accent-white"
                    title="Stencil opacity"
                  />
                  <span className="text-[9px] font-mono text-zinc-400 w-7 text-right">
                    {Math.round(overlayOpacity * 100)}%
                  </span>
                  <button
                    onClick={() => setSelectedPost(null)}
                    className="text-zinc-500 hover:text-white"
                    title="Clear reference stencil"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}

              {/* Shutter capture row */}
              <div className="flex items-center justify-between w-full px-6">
                
                {/* Scrapbook Button (Left) */}
                <button
                  onClick={() => router.push('/scrapbook')}
                  className="h-12 w-12 border border-zinc-800 hover:border-zinc-700 bg-black/80 flex items-center justify-center rounded-full active:scale-95 transition-all text-zinc-400 hover:text-white"
                  title="Open Scrapbook"
                >
                  <LayoutGrid className="h-4.5 w-4.5" />
                </button>

                {/* Shutter Button (Center) */}
                <button
                  onClick={captureFrame}
                  disabled={['capturing', 'processing'].includes(camState)}
                  className={`h-20 w-20 rounded-full border-4 border-emerald-500 bg-black/30 flex items-center justify-center cursor-pointer relative transition-all duration-150 ${
                    shutterPressing ? 'scale-90 bg-emerald-950/20' : 'hover:bg-black/60 active:scale-95'
                  }`}
                  title="Capture Photo & Analyze with Groq AI"
                >
                  <div className="h-14 w-14 rounded-full bg-white select-none pointer-events-none" />
                </button>

                {/* Camera Lens Swap Button (Right) */}
                <button
                  onClick={flipCamera}
                  className="h-12 w-12 border border-zinc-800 hover:border-zinc-700 bg-black/80 flex items-center justify-center rounded-full active:rotate-180 transition-all duration-300 text-zinc-400 hover:text-white"
                  title="Flip camera lens"
                >
                  <RefreshCw className="h-4.5 w-4.5" />
                </button>
              </div>

              {/* Quick status bar */}
              <div className="text-center">
                <p className="text-[8px] font-mono text-zinc-500 uppercase tracking-widest">
                  Tap shutter to send shot directly to Groq AI Analysis
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── 4. Collapsible Image Suggestions Sidebar (Drawer) ───────────────────── */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-xs sm:max-w-sm bg-zinc-950 border-l border-zinc-800 h-full flex flex-col justify-between shadow-2xl animate-slide-left pointer-events-auto">
            
            {/* Sidebar Header */}
            <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ImageIcon className="h-4 w-4 text-emerald-500" />
                <span className="text-xs font-mono font-bold text-white uppercase tracking-widest">
                  Framing Suggestions
                </span>
              </div>
              <button
                onClick={() => setSidebarOpen(false)}
                className="h-8 w-8 flex items-center justify-center rounded-lg text-zinc-500 hover:text-white hover:bg-zinc-900 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Sidebar Content (Search + Photo Cards) */}
            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
              
              {/* Location Mode & Search Input */}
              <div className="flex flex-col gap-2">
                <div className="flex bg-zinc-900 p-1 rounded-lg">
                  <button
                    type="button"
                    onClick={clearManualOverride}
                    className={`flex-1 text-center py-1.5 text-[8px] font-mono uppercase tracking-wider rounded ${
                      !isManualOverride ? 'bg-emerald-500 text-black font-bold' : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    Auto GPS
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsManualOverride(true)}
                    className={`flex-1 text-center py-1.5 text-[8px] font-mono uppercase tracking-wider rounded ${
                      isManualOverride ? 'bg-emerald-500 text-black font-bold' : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    Manual Search
                  </button>
                </div>

                {isManualOverride && (
                  <form onSubmit={handleManualSearch} className="flex gap-1 mt-1">
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search city/landmark…"
                      className="flex-1 bg-zinc-900 border border-zinc-800 px-3 py-2 text-xs font-mono text-white placeholder:text-zinc-600 rounded-lg outline-none"
                    />
                    <button
                      type="submit"
                      className="bg-emerald-500 hover:bg-emerald-400 text-black px-3 py-2 text-xs font-mono font-bold rounded-lg"
                    >
                      <Search className="h-3.5 w-3.5" />
                    </button>
                  </form>
                )}
              </div>

              {/* Suggestions List */}
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] font-mono uppercase text-zinc-500 tracking-wider">
                    Nearby Blueprints (1-2 km)
                  </span>
                  <span className="text-[9px] font-mono text-emerald-400">
                    {socialPosts.length} Found
                  </span>
                </div>

                {socialPosts.length > 0 ? (
                  <div className="grid grid-cols-2 gap-2">
                    {socialPosts.map((post) => {
                      const isSelected = selectedPost?.id === post.id;
                      const dKm = post.distance ? post.distance / 1000 : null;
                      return (
                        <div
                          key={post.id}
                          onClick={() => {
                            setSelectedPost(isSelected ? null : post);
                            toast.success(isSelected ? 'Cleared reference stencil' : `Selected stencil: ${post.title || 'Landmark'}`);
                          }}
                          className={`aspect-square border rounded-lg overflow-hidden cursor-pointer relative bg-zinc-900 group transition-all ${
                            isSelected ? 'border-emerald-500 ring-2 ring-emerald-500' : 'border-zinc-800 hover:border-zinc-600'
                          }`}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={post.inspo_image_url}
                            alt="Reference blueprint"
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                            loading="lazy"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent p-1.5 flex flex-col justify-end">
                            {post.title && (
                              <p className="text-[8px] font-mono text-zinc-200 font-bold truncate">
                                {post.title}
                              </p>
                            )}
                            {dKm !== null && (
                              <p className="text-[7px] font-mono text-emerald-400">
                                {dKm < 1 ? `${Math.round(dKm * 1000)}m away` : `${dKm.toFixed(1)}km away`}
                              </p>
                            )}
                          </div>
                          {isSelected && (
                            <div className="absolute top-1 right-1 bg-emerald-500 text-black text-[7px] font-mono font-bold px-1 rounded">
                              ACTIVE
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 text-center">
                    <Compass className="h-6 w-6 text-zinc-600 mx-auto mb-2" />
                    <p className="text-xs font-mono text-zinc-400 mb-1">No framing blueprints found</p>
                    <p className="text-[9px] font-mono text-zinc-600 uppercase">{emptyMessage}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Sidebar Footer */}
            <div className="p-4 border-t border-zinc-800 flex justify-between items-center">
              <span className="text-[8px] font-mono text-zinc-600 uppercase tracking-wider">
                PinPic Suggestions · Arya Hemant Tare
              </span>
              <button
                onClick={() => setSidebarOpen(false)}
                className="bg-emerald-500 text-black text-[9px] font-mono font-bold uppercase px-3 py-1.5 rounded-lg flex items-center gap-1"
              >
                Done <ChevronRight className="h-3 w-3" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 5. Groq AI Processing Indicator ──────────────────────────────────── */}
      {camState === 'processing' && (
        <div className="absolute inset-0 z-50 bg-black/90 flex flex-col items-center justify-center gap-4 p-6">
          <div className="relative h-14 w-14 flex items-center justify-center">
            <Sparkles className="h-10 w-10 text-emerald-500 animate-spin" />
          </div>
          <div className="text-center">
            <p className="text-sm font-mono text-emerald-400 font-bold uppercase tracking-widest">
              Groq AI Analyzing Photo…
            </p>
            <p className="text-[10px] font-mono text-zinc-500 mt-1">
              Evaluating composition alignment, lighting &amp; actionable improvements
            </p>
          </div>
          <div className="w-56 h-1 bg-zinc-900 rounded-full overflow-hidden">
            <div className="h-full bg-emerald-500 animate-scanner-bar w-1/3 rounded-full" />
          </div>
        </div>
      )}

      {/* ── 6. Groq AI Result Evaluation Overlay ─────────────────────────────── */}
      {camState === 'result' && result && (
        <div className="absolute inset-0 z-50 bg-black/95 flex flex-col justify-between p-4 sm:p-6 overflow-y-auto animate-slide-up">
          <div className="max-w-md mx-auto w-full flex flex-col gap-4 py-4">
            
            {/* Header */}
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-emerald-500" />
                <span className="text-xs font-mono font-bold text-white uppercase tracking-widest">
                  Groq AI Analysis Result
                </span>
              </div>
              <button
                onClick={() => { setResult(null); setCamState('streaming'); }}
                className="h-8 w-8 flex items-center justify-center rounded-lg text-zinc-500 hover:text-white hover:bg-zinc-900"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Score Card */}
            <div className="border border-emerald-900/60 bg-emerald-950/20 rounded-xl p-4 flex items-center justify-between">
              <div>
                <p className="text-[9px] font-mono text-emerald-400 uppercase tracking-widest mb-0.5">
                  Composition Score
                </p>
                <p className="text-4xl font-black text-white tracking-tighter">
                  {result.matchAccuracy !== null ? `${result.matchAccuracy}%` : '88%'}
                </p>
                <p className="text-[9px] font-mono text-zinc-400 mt-1 uppercase">
                  {selectedPost?.title ? `Matched with ${selectedPost.title}` : 'Free-Form Capture'}
                </p>
              </div>
              <div className="h-16 w-16 rounded-full border-4 border-emerald-500 flex items-center justify-center">
                <Star className="h-7 w-7 text-emerald-400" />
              </div>
            </div>

            {/* Actionable Adjustments & Improvement Suggestions */}
            {result.adjustments && result.adjustments.length > 0 && (
              <div className="border border-zinc-800 bg-zinc-950 rounded-xl p-4">
                <span className="text-[9px] font-mono text-amber-400 font-bold uppercase tracking-wider block mb-2">
                  💡 How To Improve Your Shot
                </span>
                <ul className="flex flex-col gap-2">
                  {result.adjustments.map((adj, i) => (
                    <li key={i} className="text-[11px] font-mono text-zinc-300 flex items-start gap-2 leading-relaxed">
                      <span className="text-amber-500 font-bold">•</span>
                      <span>{adj}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Generated Caption & Hashtags */}
            {result.caption && (
              <div className="border border-zinc-800 bg-zinc-950 rounded-xl p-4 flex flex-col gap-2">
                <span className="text-[8px] font-mono text-zinc-500 uppercase tracking-wider">
                  AI Generated Travel Story
                </span>
                <p className="text-[11px] font-mono leading-relaxed text-zinc-200">
                  {result.caption}
                </p>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {result.tags?.map((tag) => (
                    <span key={tag} className="text-[8px] font-mono text-emerald-400/80 bg-zinc-900 border border-zinc-800 px-2 py-0.5 rounded">
                      #{tag}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Return Controls */}
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => { setResult(null); setCamState('streaming'); }}
                className="flex-1 border border-zinc-700 hover:border-zinc-500 text-zinc-300 hover:text-white py-3.5 text-[10px] font-mono font-bold uppercase tracking-widest rounded-xl flex items-center justify-center gap-2 transition-colors active:scale-95"
              >
                <RotateCcw className="h-4 w-4" />
                Retake
              </button>
              <button
                onClick={() => router.push('/scrapbook')}
                className="flex-1 bg-emerald-500 hover:bg-emerald-400 text-black py-3.5 text-[10px] font-mono font-bold uppercase tracking-widest rounded-xl flex items-center justify-center gap-2 transition-all active:scale-95 border-2 border-black"
              >
                <Check className="h-4 w-4" />
                Save Shot
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
