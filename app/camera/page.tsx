'use client';

import { useRef, useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { 
  ArrowLeft, Sliders, AlertCircle, RefreshCw, LayoutGrid, 
  Check, Camera, HelpCircle, RotateCcw
} from 'lucide-react';
import type { CameraState, ProcessShotResponse, GpsCoordinates } from '@/lib/types';
import type { LocationSearchResult, SocialPost } from '@/app/api/location/search/route';
import PermissionsWizard from '@/components/camera/PermissionsWizard';

export default function CameraPage() {
  const router = useRouter();
  
  // Viewport Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const lastFetchTimeRef = useRef<number>(0);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Core State variables (retaining existing logic)
  const [camState, setCamState] = useState<CameraState>('idle');
  const [gps, setGps] = useState<GpsCoordinates | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [result, setResult] = useState<ProcessShotResponse | null>(null);
  const [socialPosts, setSocialPosts] = useState<SocialPost[]>([]);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [emptyMessage, setEmptyMessage] = useState<string>('No outdoor inspiration photos found near this location yet.');

  // Reference Stencil & Interface variables
  const [selectedPost, setSelectedPost] = useState<SocialPost | null>(null);
  const [overlayOpacity, setOverlayOpacity] = useState<number>(0.35);
  const [isSideBySide, setIsSideBySide] = useState<boolean>(false);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');

  // Manual Location Search Override variables
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isManualOverride, setIsManualOverride] = useState<boolean>(false);

  // New Redesign States
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
      if (['streaming', 'hotspot-found'].includes(camState)) {
        setShowControls(false);
      }
    }, 5000); // Auto-hide after 5 seconds of idle
  }, [camState]);

  useEffect(() => {
    resetControlsTimeout();
    return () => {
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
    };
  }, [camState, resetControlsTimeout]);

  // ── Draw Composition Grid overlay ──────────────────────────────────────────
  const drawThirds = (ctx: CanvasRenderingContext2D, w: number, h: number) => {
    ctx.strokeStyle = 'rgba(16, 185, 129, 0.2)'; // Emerald lines
    ctx.lineWidth = 1;
    [w / 3, (2 * w) / 3].forEach((x) => {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
    });
    [h / 3, (2 * h) / 3].forEach((y) => {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    });

    // Crosshairs
    const cx = w / 2;
    const cy = h / 2;
    const arm = 12;
    ctx.strokeStyle = 'rgba(16, 185, 129, 0.4)';
    ctx.beginPath();
    ctx.moveTo(cx - arm, cy); ctx.lineTo(cx + arm, cy);
    ctx.moveTo(cx, cy - arm); ctx.lineTo(cx, cy + arm);
    ctx.stroke();
  };

  const drawCompositionGuides = useCallback(() => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video || isPoseGuideActive) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = video.videoWidth || canvas.offsetWidth || 640;
    canvas.height = video.videoHeight || canvas.offsetHeight || 480;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawThirds(ctx, canvas.width, canvas.height);
  }, [isPoseGuideActive]);

  useEffect(() => {
    if ((camState === 'streaming' || camState === 'hotspot-found') && !isPoseGuideActive) {
      const interval = setInterval(drawCompositionGuides, 1000);
      return () => clearInterval(interval);
    }
  }, [camState, drawCompositionGuides, isPoseGuideActive]);

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
      
      // Clear manual canvas guides and start the tracking loop
      const canvas = canvasRef.current;
      if (canvas && videoRef.current) {
        canvas.width = videoRef.current.videoWidth || canvas.offsetWidth || 640;
        canvas.height = videoRef.current.videoHeight || canvas.offsetHeight || 480;
      }
      runPoseLoop();
    } catch (err) {
      console.error("Failed to load PoseNet:", err);
      toast.error("Failed to load Pose Guide. Ensure connection is stable.");
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
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx?.clearRect(0, 0, canvas.width, canvas.height);
      drawCompositionGuides();
    }
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
    ctx.strokeStyle = '#10b981'; // emerald-500
    ctx.fillStyle = '#10b981';
    ctx.lineWidth = 2;

    // Draw keypoints
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
          drawThirds(ctx, canvas.width, canvas.height);
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
        }, 75); // ~13 FPS
      }
    };

    poseLoopRef.current = requestAnimationFrame(track);
  };

  // ── Fetch local suggestion posts near coordinates (throttled to 3s) ──────────────────
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
      // Non-fatal stream update failures
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
  const clearManualOverride = useCallback(() => {
    setIsManualOverride(false);
    setSearchQuery('');
    if (gps) {
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

  // ── Initialize camera with coordinator parameters ─────────────
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
    
    // Stop old stream
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

  // ── Real-Time GPS watch loop effect ─────────────────────────────
  useEffect(() => {
    if (['streaming', 'hotspot-found'].includes(camState)) {
      if ('geolocation' in navigator) {
        watchIdRef.current = navigator.geolocation.watchPosition(
          (pos) => {
            setGpsError(null);
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
            let msg = 'Unable to retrieve GPS coordinates.';
            if (err.code === err.PERMISSION_DENIED) {
              msg = 'Permission Denied: Location services blocked.';
            } else if (err.code === err.POSITION_UNAVAILABLE) {
              msg = 'Position Unavailable: Weak GPS signal.';
            } else if (err.code === err.TIMEOUT) {
              msg = 'Location Timeout: Signal acquisition delay.';
            }
            setGpsError(msg);
          },
          { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
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
    
    // shutter haptic simulation
    setShutterPressing(true);
    setFlashActive(true);
    setTimeout(() => setFlashActive(false), 150);
    setTimeout(() => setShutterPressing(false), 200);

    setCamState('capturing');

    const snapCanvas = document.createElement('canvas');
    snapCanvas.width = videoRef.current.videoWidth || 1280;
    snapCanvas.height = videoRef.current.videoHeight || 720;
    const ctx = snapCanvas.getContext('2d')!;
    
    // Draw mirrored frames if selfie camera
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
      
      if (data.matchAccuracy !== null) {
        toast.success(`Composition match: ${data.matchAccuracy}%`);
      } else {
        toast.success('Photo successfully saved without stencil scoring.');
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Processing failed.');
      setCamState('error');
    }
  }

  // ── Cleanup streams ────────────────────────────────────────────────────────
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

  // Mapped location metadata display
  const activeLocationName = selectedPost?.title || (isManualOverride ? searchQuery : 'Local coordinates');
  const distanceKm = selectedPost?.distance ? selectedPost.distance / 1000 : null;

  return (
    <div 
      className="fixed inset-0 w-full h-full bg-black text-white select-none overflow-hidden font-sans flex flex-col"
      onClick={resetControlsTimeout}
    >
      {/* ── 1. Shutter camera flash animation overlay ─────────────────────────── */}
      <div 
        className={`absolute inset-0 bg-white z-40 transition-opacity duration-150 pointer-events-none ${
          flashActive ? 'opacity-100' : 'opacity-0'
        }`}
      />

      {/* ── 2. Full-Screen Viewfinder Camera Feed ────────────────────────────────── */}
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

        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full pointer-events-none z-10"
          style={{ display: isStreaming ? 'block' : 'none' }}
          aria-hidden="true"
        />

        {/* Live Stencil Overlay (Transparent composition outline) */}
        {isStreaming && selectedPost && !isSideBySide && (
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
            className={`w-full bg-gradient-to-b from-black/90 via-black/45 to-transparent pt-6 pb-12 px-4 transition-all duration-300 pointer-events-auto ${
              showControls ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4 pointer-events-none'
            }`}
          >
            <div className="max-w-md mx-auto w-full flex items-center justify-between gap-3">
              
              {/* Back Button */}
              <button 
                onClick={() => router.push('/dashboard')}
                className="h-10 w-10 border border-zinc-900 bg-black/80 hover:bg-zinc-950 flex items-center justify-center rounded-none active:scale-95 transition-all"
                title="Return to dashboard"
              >
                <ArrowLeft className="h-4 w-4 text-white" />
              </button>

              {/* Location info HUD */}
              <div className="flex-1 flex flex-col items-center text-center px-2">
                <span className="text-[10px] font-mono tracking-widest text-emerald-400 font-bold uppercase truncate max-w-[200px]">
                  {activeLocationName}
                </span>
                {distanceKm !== null && (
                  <span className="text-[8px] font-mono text-zinc-500 uppercase tracking-widest mt-0.5">
                    ● PROXIMITY: {distanceKm < 1 ? `${Math.round(distanceKm * 1000)}m` : `~${distanceKm.toFixed(1)}km`} AWAY
                  </span>
                )}
              </div>

              {/* Side-by-side display mode & Pose Guide button */}
              <div className="flex gap-1.5">
                <button
                  onClick={togglePoseGuide}
                  disabled={isPoseLoading}
                  className={`h-10 px-3 border flex items-center gap-1.5 text-[9px] font-mono uppercase font-bold transition-all rounded-none ${
                    isPoseGuideActive 
                      ? 'bg-emerald-500 border-emerald-600 text-black' 
                      : 'border-zinc-900 bg-black/80 hover:bg-zinc-950 text-white'
                  }`}
                  title="Toggle Pose Outline Guide"
                >
                  <Camera className="h-3.5 w-3.5" />
                  {isPoseLoading ? 'Loading…' : 'Pose'}
                </button>

                <button
                  onClick={() => setIsSideBySide((v) => !v)}
                  className={`h-10 w-10 border flex items-center justify-center rounded-none transition-all ${
                    isSideBySide 
                      ? 'bg-white border-zinc-200 text-black' 
                      : 'border-zinc-900 bg-black/80 hover:bg-zinc-950 text-white'
                  }`}
                  title="Toggle Side-by-Side reference comparison view"
                >
                  <LayoutGrid className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Live suggestion carousel strip */}
            {socialPosts.length > 0 ? (
              <div className="max-w-md mx-auto w-full mt-4 animate-slide-down">
                <div className="flex items-center justify-between mb-1.5 px-1">
                  <span className="text-[8px] font-mono uppercase tracking-widest text-zinc-500">
                    Select framing blueprint
                  </span>
                  <span className="text-[8px] font-mono text-emerald-400">
                    {socialPosts.length} FOUND
                  </span>
                </div>

                <div 
                  className="flex gap-2 overflow-x-auto pb-1"
                  style={{ scrollbarWidth: 'none' }}
                >
                  {socialPosts.map((post) => {
                    const isSelected = selectedPost?.id === post.id;
                    const dKm = post.distance ? post.distance / 1000 : null;
                    return (
                      <div
                        key={post.id}
                        onClick={() => setSelectedPost(post)}
                        className={`h-16 w-16 shrink-0 border cursor-pointer relative bg-zinc-950 transition-all ${
                          isSelected ? 'border-emerald-500 scale-105' : 'border-zinc-900 opacity-60 hover:opacity-90'
                        }`}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img 
                          src={post.inspo_image_url} 
                          alt="reference thumbnail" 
                          className="w-full h-full object-cover" 
                          loading="lazy"
                        />
                        {dKm !== null && dKm > 0.1 && (
                          <div className="absolute bottom-0 left-0 right-0 bg-black/75 text-[6px] font-mono text-center text-zinc-400 py-0.5 truncate">
                            {dKm < 1 ? `${Math.round(dKm * 1000)}m` : `${dKm.toFixed(0)}km`}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="max-w-md mx-auto w-full mt-4 bg-black/95 border border-zinc-900 p-4 text-center animate-slide-down">
                <span className="text-[9px] font-mono text-emerald-400 font-bold uppercase tracking-wider block mb-1">
                  ● NO Blueprints Found Near You
                </span>
                <p className="text-[10px] font-mono text-zinc-400 leading-normal uppercase">
                  {emptyMessage}
                </p>
                <span className="text-[8px] font-mono text-zinc-600 block mt-2 uppercase">
                  You can still capture a free-form photo without a stencil guide.
                </span>
              </div>
            )}
          </div>

          {/* Center-Right Panel for Active Pose Guide Alignment accuracy */}
          <div className="flex-1 flex items-center justify-center p-4">
            {isPoseGuideActive && (
              <div className="bg-black/90 border border-emerald-950 px-3 py-1.5 font-mono text-[9px] text-emerald-400 uppercase tracking-widest animate-pulse flex items-center gap-1.5 shadow-xl">
                <span className="h-2 w-2 rounded-full bg-emerald-500 inline-block animate-ping" />
                POSE STENCIL: {poseMatch !== null ? `${poseMatch}% ALIGNED` : 'DETECTING POSE…'}
              </div>
            )}
          </div>

          {/* Bottom Floating Control Panel */}
          <div 
            className={`w-full bg-gradient-to-t from-black/90 via-black/45 to-transparent pb-10 pt-16 px-4 transition-all duration-300 pointer-events-auto ${
              showControls ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'
            }`}
          >
            <div className="max-w-md mx-auto w-full flex flex-col gap-4">
              
              {/* Opacity slider control */}
              {selectedPost && !isSideBySide && (
                <div className="flex items-center gap-3 bg-black/85 border border-zinc-900 px-3 py-2 animate-slide-up self-center w-52 shadow-md">
                  <Sliders className="h-3.5 w-3.5 text-zinc-500" />
                  <input
                    type="range"
                    min="0.0"
                    max="1.0"
                    step="0.05"
                    value={overlayOpacity}
                    onChange={(e) => setOverlayOpacity(parseFloat(e.target.value))}
                    className="w-full h-1 bg-zinc-800 rounded-none appearance-none cursor-pointer accent-white"
                    title="Stencil opacity"
                  />
                  <span className="text-[9px] font-mono text-zinc-400 w-7 text-right">
                    {Math.round(overlayOpacity * 100)}%
                  </span>
                </div>
              )}

              {/* Shutter capture trigger row */}
              <div className="flex items-center justify-between w-full px-6">
                
                {/* Scrapbook Thumbnail Shortcut (Left) */}
                <button
                  onClick={() => router.push('/scrapbook')}
                  className="h-11 w-11 border border-zinc-900 hover:border-zinc-800 bg-black/80 flex items-center justify-center rounded-none active:scale-95 transition-all text-zinc-400 hover:text-white"
                  title="Open Scrapbook page"
                >
                  <LayoutGrid className="h-4.5 w-4.5" />
                </button>

                {/* Shutter Shutter Trigger Button (Center) */}
                <button
                  onClick={captureFrame}
                  disabled={['capturing', 'processing'].includes(camState)}
                  className={`h-20 w-20 rounded-full border-4 border-emerald-500 bg-black/25 flex items-center justify-center cursor-pointer relative transition-all duration-150 ${
                    shutterPressing ? 'scale-90 bg-emerald-950/20' : 'hover:bg-black/60 active:scale-95'
                  }`}
                  title="Capture reference shot"
                >
                  <div className="h-13 w-13 rounded-full bg-white select-none pointer-events-none" />
                </button>

                {/* Lens Swap Camera Flip Button (Right) */}
                <button
                  onClick={flipCamera}
                  className="h-11 w-11 border border-zinc-900 hover:border-zinc-800 bg-black/80 flex items-center justify-center rounded-none active:rotate-180 transition-all duration-300 text-zinc-400 hover:text-white"
                  title="Flip camera lens facing mode"
                >
                  <RefreshCw className="h-4.5 w-4.5" />
                </button>
              </div>

              {/* Segmented Mode selector and manual lookup controls */}
              <div className="flex flex-col gap-2">
                <div className="flex w-full bg-black border border-zinc-900 p-0.5 rounded-none">
                  <button
                    type="button"
                    onClick={clearManualOverride}
                    className={`flex-1 text-center py-1.5 text-[8px] font-mono uppercase tracking-widest transition-all ${
                      !isManualOverride
                        ? 'bg-white text-black font-bold'
                        : 'text-zinc-500 hover:text-zinc-300'
                    }`}
                  >
                    ● Auto GPS Mode
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsManualOverride(true)}
                    className={`flex-1 text-center py-1.5 text-[8px] font-mono uppercase tracking-widest transition-all ${
                      isManualOverride
                        ? 'bg-white text-black font-bold'
                        : 'text-zinc-500 hover:text-zinc-300'
                    }`}
                  >
                    Manual Override
                  </button>
                </div>

                {isManualOverride ? (
                  <form onSubmit={handleManualSearch} className="flex gap-1 animate-slide-up">
                    <input
                      type="text"
                      placeholder="ENTER LOCATION NAME..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="flex-1 bg-black/85 border border-zinc-900 px-3 py-1.5 text-[9px] font-mono uppercase text-white placeholder-zinc-700 focus:outline-none focus:border-zinc-700 rounded-none"
                    />
                    <button
                      type="submit"
                      className="bg-white text-black hover:bg-zinc-200 px-3 text-[9px] font-mono font-bold uppercase rounded-none shrink-0"
                    >
                      SEARCH
                    </button>
                  </form>
                ) : (
                  <div className="flex justify-between items-center text-[8px] font-mono text-zinc-500 tracking-wider px-1 uppercase">
                    <span>Range limit: 1km radius</span>
                    <span className="text-emerald-400 animate-pulse font-bold">● ACTIVE</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── 4. Side-by-Side Reference Panel Viewport split ─────────────────────── */}
      {isStreaming && selectedPost && isSideBySide && (
        <div className="absolute top-32 bottom-48 right-4 w-[160px] border border-zinc-900 bg-black/95 z-10 flex flex-col pointer-events-auto rounded-none animate-slide-up shadow-2xl">
          <div className="flex items-center justify-between border-b border-zinc-900 px-2 py-1.5 bg-zinc-950">
            <span className="text-[8px] font-mono text-zinc-500 uppercase truncate max-w-[100px]">
              Blueprint
            </span>
            <button 
              onClick={() => setIsSideBySide(false)}
              className="text-[8px] font-mono text-zinc-400 hover:text-white uppercase"
            >
              Hide
            </button>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={selectedPost.inspo_image_url}
            alt="Reference layout thumbnail"
            className="w-full aspect-[3/4] object-cover border-b border-zinc-900"
          />
          <div className="p-2 flex flex-col gap-0.5">
            <span className="text-[7px] font-mono text-zinc-400 truncate">{selectedPost.user_handle}</span>
            <span className="text-[7px] font-mono text-zinc-600 truncate">Likes: {selectedPost.likes_count.toLocaleString()}</span>
          </div>
        </div>
      )}

      {/* ── 5. Setup Permissions onboarding wizard ──────────────────────────── */}
      {camState === 'idle' && (
        <PermissionsWizard
          onComplete={(coords) => startCameraWithCoords(coords)}
          onClose={() => startCamera()}
        />
      )}

      {/* ── 6. Initializing Hardware Viewport loading state ───────────────────── */}
      {camState === 'requesting-permissions' && (
        <div className="flex flex-1 flex-col items-center justify-center gap-6 bg-black z-50 animate-fade-in">
          <div className="flex flex-col items-center gap-2">
            <div className="h-10 w-44 bg-zinc-950 border border-zinc-900 p-0.5 relative overflow-hidden">
              <div className="h-full bg-emerald-500 animate-loading-bar" style={{ width: '40%' }} />
            </div>
            <span className="text-[9px] font-mono tracking-widest text-emerald-400 animate-pulse uppercase">
              CALIBRATING SYSTEM SENSORS…
            </span>
          </div>
        </div>
      )}

      {/* ── 7. Branded processing scored loading state ────────────────────────── */}
      {camState === 'processing' && (
        <div className="absolute inset-0 bg-black z-50 flex flex-col items-center justify-center gap-4 animate-fade-in">
          <div className="flex flex-col items-center gap-3">
            <div className="h-1 w-32 bg-zinc-950 border border-zinc-900 overflow-hidden relative">
              <div className="absolute h-full bg-emerald-500 animate-scanner-bar w-1/3" />
            </div>
            <span className="text-[9px] font-mono tracking-widest text-white uppercase animate-pulse">
              ANALYZING PHOTO COMPOSITION GUIDE…
            </span>
            <span className="text-[7px] font-mono text-zinc-500 uppercase tracking-widest">
              Synthesizing metadata tags
            </span>
          </div>
        </div>
      )}

      {/* ── 8. Camera hardware error viewport boundary ─────────────────────── */}
      {camState === 'error' && (
        <div className="flex flex-1 flex-col items-center justify-center gap-5 px-6 text-center bg-black z-50 animate-fade-in">
          <AlertCircle className="h-8 w-8 text-red-500" />
          <h2 className="text-sm font-mono text-red-500 uppercase tracking-wider">HARDWARE VIEWPORT FAILURE</h2>
          <p className="text-xs font-mono text-zinc-400 max-w-xs">{errorMsg}</p>
          <button
            onClick={() => { setCamState('idle'); setErrorMsg(''); }}
            className="flex items-center gap-2 border border-zinc-800 hover:border-zinc-700 bg-zinc-950 text-xs font-mono uppercase px-5 py-3 tracking-wider transition-colors"
          >
            <RefreshCw className="h-3.5 w-3.5" /> RESTART SETUP
          </button>
        </div>
      )}

      {/* ── 9. Dynamic custom error state banners (Diagnostics check) ─────────── */}
      {isStreaming && gpsError && (
        <div className="absolute top-28 left-4 right-4 z-30 animate-slide-down pointer-events-auto">
          <div className="bg-red-950/20 border border-red-950/80 p-4 max-w-md mx-auto flex items-start gap-3 shadow-xl">
            <AlertCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
            <div className="flex-1 flex flex-col gap-1">
              <span className="text-[9px] font-mono text-red-400 font-bold uppercase tracking-wider">GPS WARNING</span>
              <p className="text-[10px] font-mono text-zinc-400 leading-normal">{gpsError}</p>
              <button 
                onClick={() => {
                  setGpsError(null);
                  if (watchIdRef.current) {
                    navigator.geolocation.clearWatch(watchIdRef.current);
                    watchIdRef.current = null;
                  }
                  setCamState('idle');
                }}
                className="text-[8px] font-mono text-red-400 underline hover:text-red-300 text-left mt-1 uppercase"
              >
                Re-request permissions
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 10. AI Vision Analysis results panel overlay ────────────────────────── */}
      {camState === 'result' && result && (
        <div className="absolute inset-0 z-30 bg-black overflow-y-auto flex flex-col items-center p-6 animate-slide-up">
          <div className="w-full max-w-md flex flex-col gap-6 pt-4 pb-12">
            
            {/* Top Back Action */}
            <div className="flex justify-between items-center border-b border-zinc-900 pb-3">
              <span className="text-[10px] font-mono tracking-widest text-zinc-500 uppercase">
                ANALYSIS COMPLETED
              </span>
              <span className="text-[10px] font-mono text-emerald-400">
                SHOT SCORING v1.1
              </span>
            </div>

            {/* Score Radial Gauge (SVG animation) */}
            <div className="flex flex-col items-center justify-center border border-zinc-900 bg-zinc-950/45 py-8 gap-3 relative overflow-hidden">
              <div className="relative h-32 w-32 flex items-center justify-center">
                <svg className="w-full h-full transform -rotate-90">
                  <circle 
                    cx="64" cy="64" r="50" 
                    className="stroke-zinc-900 fill-none" 
                    strokeWidth="8"
                  />
                  <circle 
                    cx="64" cy="64" r="50" 
                    className="stroke-emerald-500 fill-none transition-all duration-1000 ease-out" 
                    strokeWidth="8"
                    strokeDasharray={314}
                    strokeDashoffset={314 - (314 * (result.matchAccuracy ?? 0)) / 100}
                    style={{ strokeLinecap: 'square' }}
                  />
                </svg>
                <div className="absolute flex flex-col items-center">
                  <span className="text-3xl font-mono font-bold tracking-tight text-white">
                    {result.matchAccuracy !== null ? `${result.matchAccuracy}%` : '—'}
                  </span>
                  <span className="text-[8px] font-mono text-zinc-500 uppercase tracking-widest">
                    MATCH
                  </span>
                </div>
              </div>
              <h3 className="text-xs font-mono tracking-widest uppercase font-bold text-center">
                {result.matchAccuracy !== null 
                  ? (result.matchAccuracy >= 90 ? '🏆 PERFECT COMPOSITION' : result.matchAccuracy >= 70 ? '⚡ GOOD framing' : '📐 framing needs alignment')
                  : '📷 FIRST SHOT RECORDED'
                }
              </h3>
              <p className="text-[9px] font-mono text-zinc-500 text-center uppercase px-4 leading-normal">
                {result.matchAccuracy !== null
                  ? 'Grounded visual mapping aligned with location stencils.'
                  : 'First shot here — nothing to compare yet.'
                }
              </p>
            </div>

            {/* Side-by-side comparative display */}
            <div className="grid grid-cols-2 gap-2">
              <div className="flex flex-col gap-1">
                <span className="text-[8px] font-mono text-zinc-500 uppercase tracking-wider">Your capture</span>
                <div className="aspect-[3/4] border border-zinc-900 overflow-hidden relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img 
                    src={videoRef.current ? canvasRef.current?.toDataURL('image/jpeg') : ''} 
                    alt="user snapshot" 
                    className="w-full h-full object-cover"
                  />
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[8px] font-mono text-zinc-500 uppercase tracking-wider">Reference blueprint</span>
                <div className="aspect-[3/4] border border-zinc-900 bg-zinc-950 overflow-hidden relative">
                  {selectedPost ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img 
                      src={selectedPost.inspo_image_url} 
                      alt="composition target" 
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center p-3 text-center">
                      <HelpCircle className="h-6 w-6 text-zinc-700 mb-1" />
                      <span className="text-[8px] font-mono text-zinc-600 uppercase leading-normal">
                        No guide blueprint active
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Scannable Strengths / Improvements list tags */}
            {result.matchAccuracy !== null && (
              <div className="flex flex-col gap-3">
                
                {/* Strengths */}
                <div className="border border-zinc-900 bg-zinc-950/20 p-4">
                  <span className="text-[9px] font-mono text-emerald-400 font-bold uppercase tracking-wider block mb-2">
                    ✓ COMPOSITION STRENGTHS
                  </span>
                  <ul className="flex flex-col gap-1.5">
                    {result.adjustments.length === 0 ? (
                      <li className="text-[10px] font-mono text-zinc-400">Excellent spatial scaling and balance.</li>
                    ) : (
                      <li className="text-[10px] font-mono text-zinc-400 flex items-start gap-1.5">
                        <span className="text-emerald-500 font-bold">•</span>
                        <span>Key visual subject components resolved successfully.</span>
                      </li>
                    )}
                    <li className="text-[10px] font-mono text-zinc-400 flex items-start gap-1.5">
                      <span className="text-emerald-500 font-bold">•</span>
                      <span>Lighting temperature alignment completed.</span>
                    </li>
                  </ul>
                </div>

                {/* Adjustments */}
                {result.adjustments.length > 0 && (
                  <div className="border border-zinc-900 bg-zinc-950/20 p-4">
                    <span className="text-[9px] font-mono text-amber-500 font-bold uppercase tracking-wider block mb-2">
                      ▲ SUGGESTED ALIGNMENTS
                    </span>
                    <ul className="flex flex-col gap-2">
                      {result.adjustments.map((adj, i) => (
                        <li key={i} className="text-[10px] font-mono text-zinc-400 flex items-start gap-1.5 leading-relaxed">
                          <span className="text-amber-500 font-bold">•</span>
                          <span>{adj}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* Generated Caption story cards */}
            <div className="border border-zinc-900 p-4 flex flex-col gap-1 bg-zinc-950/10">
              <span className="text-[8px] font-mono text-zinc-500 uppercase tracking-wider block mb-1">
                Generated travel caption
              </span>
              <p className="text-[11px] font-mono leading-relaxed text-zinc-300">
                {result.caption}
              </p>
              <div className="flex flex-wrap gap-1 mt-2.5">
                {result.tags.map((tag) => (
                  <span key={tag} className="text-[8px] font-mono text-zinc-500">
                    #{tag}
                  </span>
                ))}
              </div>
            </div>

            {/* Return controls row */}
            <div className="flex gap-2 w-full mt-4">
              <button
                onClick={() => { setResult(null); setCamState('streaming'); }}
                className="flex-1 border border-zinc-900 hover:border-zinc-800 bg-black text-white hover:text-white py-4 text-[10px] font-mono font-bold uppercase tracking-widest rounded-none flex items-center justify-center gap-2 transition-all active:scale-98"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Retake
              </button>
              <button
                onClick={() => router.push('/scrapbook')}
                className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-black py-4 text-[10px] font-mono font-bold uppercase tracking-widest rounded-none flex items-center justify-center gap-2 transition-all active:scale-98"
              >
                <Check className="h-3.5 w-3.5" />
                Save Shot
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
