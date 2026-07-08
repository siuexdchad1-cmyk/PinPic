'use client';

import { useRef, useEffect, useState, useCallback } from 'react';
import { toast } from 'sonner';
import { Loader2, AlertCircle, RefreshCw, Search, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { throttle } from '@/lib/utils';
import type { NearbyHotspot, CameraState, ProcessShotResponse, GpsCoordinates } from '@/lib/types';
import type { SuggestedSpot } from '@/app/api/location/suggest/route';
import type { LocationSearchResult } from '@/app/api/location/search/route';
import PermissionsWizard from '@/components/camera/PermissionsWizard';

// ── TensorFlow.js / PoseNet Keypoint Interface ────────────────────────────────
interface Keypoint {
  part: string;
  position: { x: number; y: number };
  score: number;
}

// ── TF.js and PoseNet Dynamic Loader ─────────────────────────────────────────
function loadExternalScripts(urls: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    let loadedCount = 0;
    const onLoad = () => {
      loadedCount++;
      if (loadedCount === urls.length) {
        resolve();
      }
    };
    const onError = () => {
      reject(new Error('Failed to load TF.js / PoseNet scripts'));
    };

    urls.forEach((url) => {
      if (document.querySelector(`script[src="${url}"]`)) {
        onLoad();
        return;
      }
      const script = document.createElement('script');
      script.src = url;
      script.async = true;
      script.onload = onLoad;
      script.onerror = onError;
      document.body.appendChild(script);
    });
  });
}

// ── Pose Guide Templates & Skeleton Drawing Helpers ──────────────────────────
interface Point {
  x: number;
  y: number;
}
interface PoseTemplate {
  name: string;
  description: string;
  joints: {
    head: Point;
    neck: Point;
    lShoulder: Point;
    rShoulder: Point;
    lElbow: Point;
    rElbow: Point;
    lWrist: Point;
    rWrist: Point;
    lHip: Point;
    rHip: Point;
    lKnee: Point;
    rKnee: Point;
    lAnkle: Point;
    rAnkle: Point;
  };
}

const POSE_TEMPLATES: Record<string, PoseTemplate> = {
  'classic-stand': {
    name: 'Model Stand',
    description: 'Casual posture with hands resting on hips',
    joints: {
      head: { x: 0.5, y: 0.16 },
      neck: { x: 0.5, y: 0.24 },
      lShoulder: { x: 0.42, y: 0.26 },
      rShoulder: { x: 0.58, y: 0.26 },
      lElbow: { x: 0.36, y: 0.40 },
      rElbow: { x: 0.64, y: 0.40 },
      lWrist: { x: 0.42, y: 0.52 },
      rWrist: { x: 0.58, y: 0.52 },
      lHip: { x: 0.44, y: 0.54 },
      rHip: { x: 0.56, y: 0.54 },
      lKnee: { x: 0.45, y: 0.72 },
      rKnee: { x: 0.55, y: 0.72 },
      lAnkle: { x: 0.46, y: 0.88 },
      rAnkle: { x: 0.54, y: 0.88 },
    }
  },
  'cafe-sit': {
    name: 'Cafe Sitting',
    description: 'Relaxed sitting pose resting chin on hand',
    joints: {
      head: { x: 0.46, y: 0.22 },
      neck: { x: 0.48, y: 0.30 },
      lShoulder: { x: 0.36, y: 0.34 },
      rShoulder: { x: 0.56, y: 0.34 },
      lElbow: { x: 0.30, y: 0.52 },
      rElbow: { x: 0.52, y: 0.48 },
      lWrist: { x: 0.42, y: 0.32 },
      rWrist: { x: 0.56, y: 0.62 },
      lHip: { x: 0.40, y: 0.66 },
      rHip: { x: 0.58, y: 0.66 },
      lKnee: { x: 0.30, y: 0.80 },
      rKnee: { x: 0.64, y: 0.82 },
      lAnkle: { x: 0.32, y: 0.92 },
      rAnkle: { x: 0.60, y: 0.92 },
    }
  },
  'action-walk': {
    name: 'Casual Stride',
    description: 'Dynamic walking posture with active leg stride',
    joints: {
      head: { x: 0.50, y: 0.18 },
      neck: { x: 0.50, y: 0.26 },
      lShoulder: { x: 0.44, y: 0.28 },
      rShoulder: { x: 0.56, y: 0.28 },
      lElbow: { x: 0.40, y: 0.42 },
      rElbow: { x: 0.60, y: 0.42 },
      lWrist: { x: 0.44, y: 0.54 },
      rWrist: { x: 0.62, y: 0.52 },
      lHip: { x: 0.45, y: 0.56 },
      rHip: { x: 0.55, y: 0.56 },
      lKnee: { x: 0.38, y: 0.72 },
      rKnee: { x: 0.62, y: 0.72 },
      lAnkle: { x: 0.32, y: 0.88 },
      rAnkle: { x: 0.66, y: 0.88 },
    }
  }
};

function drawTemplateSkeleton(ctx: CanvasRenderingContext2D, w: number, h: number, template: PoseTemplate) {
  const joints = template.joints;
  
  const pt = (p: Point) => ({ x: p.x * w, y: p.y * h });

  const hd = pt(joints.head);
  const nk = pt(joints.neck);
  const ls = pt(joints.lShoulder);
  const rs = pt(joints.rShoulder);
  const le = pt(joints.lElbow);
  const re = pt(joints.rElbow);
  const lw = pt(joints.lWrist);
  const rw = pt(joints.rWrist);
  const lh = pt(joints.lHip);
  const rh = pt(joints.rHip);
  const lk = pt(joints.lKnee);
  const rk = pt(joints.rKnee);
  const la = pt(joints.lAnkle);
  const ra = pt(joints.rAnkle);

  // ── 1. Draw Thick Silhouette Body Capsules (Glassmorphic limbs) ───────────
  ctx.strokeStyle = 'rgba(168, 85, 247, 0.15)';
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  const drawLimbCapsule = (p1: { x: number, y: number }, p2: { x: number, y: number }) => {
    ctx.lineWidth = 24; // Thick body capsule width
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.stroke();
  };

  // Draw limb capsules
  drawLimbCapsule(ls, le);
  drawLimbCapsule(le, lw);
  drawLimbCapsule(rs, re);
  drawLimbCapsule(re, rw);
  drawLimbCapsule(lh, lk);
  drawLimbCapsule(lk, la);
  drawLimbCapsule(rh, rk);
  drawLimbCapsule(rk, ra);

  // ── 2. Draw Filled Torso & Head ──────────────────────────────────────────
  // Torso polygon
  ctx.fillStyle = 'rgba(168, 85, 247, 0.1)';
  ctx.beginPath();
  ctx.moveTo(ls.x, ls.y);
  ctx.lineTo(rs.x, rs.y);
  ctx.lineTo(rh.x, rh.y);
  ctx.lineTo(lh.x, lh.y);
  ctx.closePath();
  ctx.fill();

  // Head filled circle
  ctx.fillStyle = 'rgba(168, 85, 247, 0.2)';
  ctx.beginPath();
  ctx.arc(hd.x, hd.y, 0.045 * h, 0, 2 * Math.PI);
  ctx.fill();

  // ── 3. Draw Sharp Outline Skeleton (Center bone guides) ────────────────────
  ctx.strokeStyle = 'rgba(168, 85, 247, 0.7)';
  ctx.lineWidth = 2;

  const drawBoneLine = (p1: { x: number, y: number }, p2: { x: number, y: number }) => {
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.stroke();
  };

  drawBoneLine(hd, nk);
  drawBoneLine(ls, rs);
  drawBoneLine(lh, rh);
  drawBoneLine(ls, le);
  drawBoneLine(le, lw);
  drawBoneLine(rs, re);
  drawBoneLine(re, rw);
  drawBoneLine(lh, lk);
  drawBoneLine(lk, la);
  drawBoneLine(rh, rk);
  drawBoneLine(rk, ra);
  
  const hipCenter = { x: (lh.x + rh.x) / 2, y: (lh.y + rh.y) / 2 };
  drawBoneLine(nk, hipCenter);

  // ── 4. Draw Glowing white-rimmed target joint nodes ────────────────────────
  const drawTargetJoint = (p: { x: number, y: number }) => {
    ctx.fillStyle = 'rgba(168, 85, 247, 0.9)';
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 5, 0, 2 * Math.PI);
    ctx.fill();
    ctx.stroke();
  };

  [hd, ls, rs, le, re, lw, rw, lh, rh, lk, rk, la, ra].forEach((j) => {
    drawTargetJoint(j);
  });
}

function drawLiveSkeleton(ctx: CanvasRenderingContext2D, keypoints: Keypoint[]) {
  const minConfidence = 0.4;
  
  // Neon emerald green for user live skeleton tracking
  ctx.strokeStyle = '#10b981';
  ctx.fillStyle = '#10b981';
  ctx.lineWidth = 4;
  ctx.shadowColor = '#10b981';
  ctx.shadowBlur = 8;
  
  const kp = (name: string) => {
    const point = keypoints.find((k) => k.part === name);
    return point && point.score >= minConfidence ? point.position : null;
  };

  const drawBone = (p1: { x: number, y: number } | null, p2: { x: number, y: number } | null) => {
    if (p1 && p2) {
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
    }
  };

  const ls = kp('leftShoulder');
  const rs = kp('rightShoulder');
  const le = kp('leftElbow');
  const re = kp('rightElbow');
  const lw = kp('leftWrist');
  const rw = kp('rightWrist');
  const lh = kp('leftHip');
  const rh = kp('rightHip');
  const lk = kp('leftKnee');
  const rk = kp('rightKnee');
  const la = kp('leftAnkle');
  const ra = kp('rightAnkle');

  drawBone(ls, rs);
  drawBone(lh, rh);
  drawBone(ls, le);
  drawBone(le, lw);
  drawBone(rs, re);
  drawBone(re, rw);
  
  if (ls && rs && lh && rh) {
    const midShoulder = { x: (ls.x + rs.x) / 2, y: (ls.y + rs.y) / 2 };
    const midHip = { x: (lh.x + rh.x) / 2, y: (lh.y + rh.y) / 2 };
    drawBone(midShoulder, midHip);
  }
  
  drawBone(lh, lk);
  drawBone(lk, la);
  drawBone(rh, rk);
  drawBone(rk, ra);

  // Draw joints
  keypoints.forEach((k) => {
    if (k.score >= minConfidence) {
      ctx.beginPath();
      ctx.arc(k.position.x, k.position.y, 6, 0, 2 * Math.PI);
      ctx.fill();
    }
  });

  ctx.shadowBlur = 0;
}

function calculatePoseScore(keypoints: Keypoint[], template: PoseTemplate): number {
  const parts = ['head', 'lShoulder', 'rShoulder', 'lElbow', 'rElbow', 'lWrist', 'rWrist', 'lHip', 'rHip', 'lKnee', 'rKnee', 'lAnkle', 'rAnkle'];
  const mapping: Record<string, string> = {
    head: 'nose',
    lShoulder: 'leftShoulder',
    rShoulder: 'rightShoulder',
    lElbow: 'leftElbow',
    rElbow: 'rightElbow',
    lWrist: 'leftWrist',
    rWrist: 'rightWrist',
    lHip: 'leftHip',
    rHip: 'rightHip',
    lKnee: 'leftKnee',
    rKnee: 'rightKnee',
    lAnkle: 'leftAnkle',
    rAnkle: 'rightAnkle'
  };

  const validKps = keypoints.filter(k => k.score >= 0.4);
  if (validKps.length < 5) return 0;

  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  validKps.forEach(k => {
    if (k.position.x < minX) minX = k.position.x;
    if (k.position.x > maxX) maxX = k.position.x;
    if (k.position.y < minY) minY = k.position.y;
    if (k.position.y > maxY) maxY = k.position.y;
  });

  const width = maxX - minX || 1;
  const height = maxY - minY || 1;

  const templatePoints = Object.values(template.joints);
  let tMinX = Infinity, tMaxX = -Infinity, tMinY = Infinity, tMaxY = -Infinity;
  templatePoints.forEach(p => {
    if (p.x < tMinX) tMinX = p.x;
    if (p.x > tMaxX) tMaxX = p.x;
    if (p.y < tMinY) tMinY = p.y;
    if (p.y > tMaxY) tMaxY = p.y;
  });
  const tWidth = tMaxX - tMinX || 1;
  const tHeight = tMaxY - tMinY || 1;

  let totalDiff = 0;
  let count = 0;

  parts.forEach(part => {
    const userKp = keypoints.find(k => k.part === mapping[part]);
    if (userKp && userKp.score >= 0.4) {
      const normUserX = (userKp.position.x - minX) / width;
      const normUserY = (userKp.position.y - minY) / height;

      const tPt = template.joints[part as keyof typeof template.joints];
      const normTemplateX = (tPt.x - tMinX) / tWidth;
      const normTemplateY = (tPt.y - tMinY) / tHeight;

      const dist = Math.sqrt(
        Math.pow(normUserX - normTemplateX, 2) +
        Math.pow(normUserY - normTemplateY, 2)
      );
      totalDiff += dist;
      count++;
    }
  });

  if (count === 0) return 0;
  const avgDiff = totalDiff / count;

  return Math.max(0, Math.min(100, Math.round(100 - (avgDiff * 300))));
}

// Global variable to persist loaded PoseNet model across state renders
let poseNetModel: unknown = null;

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

  const [suggestions, setSuggestions] = useState<SuggestedSpot[]>([]);
  const [placeName, setPlaceName]     = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);

  // ── Search & Pose states ──────────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);

  const [poseGuideActive, setPoseGuideActive] = useState(false);
  const [selectedPose, setSelectedPose]         = useState<string>('classic-stand');
  const [isPoseNetLoading, setIsPoseNetLoading] = useState(false);
  const [isPoseNetActive, setIsPoseNetActive]   = useState(false);
  const [poseMatchScore, setPoseMatchScore]     = useState<number | null>(null);


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
      fetchSuggestions(coords.latitude, coords.longitude);

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

  async function fetchSuggestions(lat: number, lng: number) {
    try {
      const res = await fetch(`/api/location/suggest?lat=${lat}&lng=${lng}`);
      if (!res.ok) return;
      const data = await res.json();
      if (data.placeName) setPlaceName(data.placeName);
      if (data.spots?.length > 0) {
        setSuggestions(data.spots);
        setShowSuggestions(true);
      }
    } catch {
      // Suggestions are non-fatal
    }
  }

  // ── PoseNet Initializer ────────────────────────────────────────────────────
  async function initPoseNet() {
    if (poseNetModel) return poseNetModel;
    setIsPoseNetLoading(true);
    try {
      await loadExternalScripts([
        'https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@3.11.0/dist/tf.min.js',
        'https://cdn.jsdelivr.net/npm/@tensorflow-models/posenet@2.2.2/dist/posenet.min.js'
      ]);

      const tf = (window as Window & { tf?: unknown }).tf;
      const posenet = (window as Window & { posenet?: { load: (cfg: unknown) => Promise<unknown> } }).posenet;

      if (tf && posenet) {
        poseNetModel = await posenet.load({
          architecture: 'MobileNetV1',
          outputStride: 16,
          inputResolution: { width: 257, height: 200 },
          multiplier: 0.5
        });
        setIsPoseNetActive(true);
        return poseNetModel;
      } else {
        throw new Error('TensorFlow / PoseNet failed to mount on window.');
      }
    } catch (err) {
      console.error('[PoseNet Load Error]', err);
      toast.error('Failed to start Live Pose Tracker.');
    } finally {
      setIsPoseNetLoading(false);
    }
  }

  // ── Worldwide Geocoding Search Handler ──────────────────────────────────────
  async function handleSearchLocation(e: React.FormEvent) {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    try {
      const res = await fetch(`/api/location/search?q=${encodeURIComponent(searchQuery)}`);
      if (!res.ok) {
        throw new Error('Location not found. Try searching another landmark.');
      }
      const data: LocationSearchResult = await res.json();

      const virtualGps: GpsCoordinates = {
        latitude: data.lat,
        longitude: data.lng,
        accuracy: 10,
      };
      setGps(virtualGps);
      
      const briefName = data.displayName.split(',')[0];
      setPlaceName(briefName);

      if (data.photos && data.photos.length > 0) {
        const spotSuggestions: SuggestedSpot[] = data.photos.map((url, idx) => {
          const platforms = ['Instagram', 'Snapchat', 'Flickr', 'Twitter'];
          const platform = platforms[idx % platforms.length];
          return {
            name: `${briefName} capture`,
            type: `${platform} Post`,
            imageUrl: url,
            lat: data.lat,
            lng: data.lng,
            distanceM: Math.round(Math.random() * 120 + 10)
          };
        });
        setSuggestions(spotSuggestions);
        setShowSuggestions(true);
        setPinImageUrl(data.photos[0]);
        drawStencil(data.photos[0]);
      }

      toast.success(`Teleported to ${briefName}! Inspiration photos loaded.`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Search failed.';
      toast.error(msg);
    } finally {
      setIsSearching(false);
    }
  }

  // ── Live Pose Guide and Skeleton Overlay Animation Loop ────────────────────
  useEffect(() => {
    let active = true;
    let animId: number;

    const runEstimation = async () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || !active || !poseGuideActive) return;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      canvas.width = video.videoWidth || canvas.offsetWidth || 640;
      canvas.height = video.videoHeight || canvas.offsetHeight || 480;
      const w = canvas.width;
      const h = canvas.height;

      ctx.clearRect(0, 0, w, h);

      // Redraw rule-of-thirds grid
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.lineWidth = 1;
      [w / 3, (2 * w) / 3].forEach((x) => {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
      });
      [h / 3, (2 * h) / 3].forEach((y) => {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
      });

      // Draw the silhouette template skeleton
      const template = POSE_TEMPLATES[selectedPose];
      if (template) {
        drawTemplateSkeleton(ctx, w, h, template);
      }

      // Estimate live user posture
      if (poseNetModel && isPoseNetActive) {
        try {
          const pose = await (poseNetModel as {
            estimateSinglePose: (img: HTMLVideoElement, config: Record<string, unknown>) => Promise<{ keypoints: Keypoint[] }>
          }).estimateSinglePose(video, {
            flipHorizontal: false
          });

          if (pose && pose.keypoints) {
            drawLiveSkeleton(ctx, pose.keypoints);
            const score = calculatePoseScore(pose.keypoints, template);
            setPoseMatchScore(score);
          }
        } catch {
          // loop exceptions are non-fatal
        }
      }

      if (active) {
        animId = requestAnimationFrame(runEstimation);
      }
    };

    if (poseGuideActive) {
      if (!poseNetModel) {
        initPoseNet().then(() => {
          runEstimation();
        });
      } else {
        runEstimation();
      }
    } else {
      // Clear canvas overlay when pose guide is closed
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        ctx?.clearRect(0, 0, canvas.width, canvas.height);
      }
      setPoseMatchScore(null);
    }

    return () => {
      active = false;
      cancelAnimationFrame(animId);
    };
  }, [poseGuideActive, selectedPose, isPoseNetActive]);


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

  // ── Load hotspot preset from query param ────────────────────────────────────
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const refId = params.get('ref');
    if (refId) {
      fetch('/api/hotspots')
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data && data.hotspots) {
            const found = (data.hotspots as {
              id: string;
              title: string;
              description: string | null;
              inspo_image_url: string;
              lat: number;
              lng: number;
            }[]).find((h) => h.id === refId);
            if (found) {
              setHotspot({
                id: found.id,
                title: found.title,
                description: found.description,
                inspo_image_url: found.inspo_image_url,
                location: `POINT(${found.lng} ${found.lat})`,
                license_source: 'Unsplash-Open-Asset',
                created_at: new Date().toISOString(),
                distance_m: 0,
              });
              setCamState('hotspot-found');
              setPinImageUrl(found.inspo_image_url);
              drawStencil(found.inspo_image_url);
              toast.success(`Reference photo set: ${found.title}`);
            }
          }
        })
        .catch((err) => console.error('Error fetching ref hotspot:', err));
    }
  }, [drawStencil]);

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

          {/* Top Search Bar & Controls */}
          <div className="absolute top-4 left-4 right-4 z-20 flex flex-col gap-2 pointer-events-auto">
            <form onSubmit={handleSearchLocation} className="w-full flex gap-1.5">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-zinc-500" />
                <input
                  type="text"
                  placeholder="Search location worldwide..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full h-9 pl-9 pr-4 bg-zinc-950/90 border border-zinc-800 rounded text-xs font-mono text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-700"
                />
              </div>
              <button
                type="submit"
                disabled={isSearching}
                className="px-3 bg-zinc-950 border border-zinc-800 hover:bg-zinc-900 text-xs font-mono rounded text-zinc-300 hover:text-white"
              >
                {isSearching ? '...' : 'Search'}
              </button>
              <button
                type="button"
                onClick={() => setPoseGuideActive(v => !v)}
                className={`p-2 border rounded transition-colors ${poseGuideActive ? 'bg-purple-600 border-purple-500 text-white' : 'bg-zinc-950/90 border-zinc-800 text-zinc-400 hover:text-white'}`}
                title="Toggle Pose Guide"
              >
                <Sparkles className="h-4 w-4" />
              </button>
            </form>

            {/* Context status pills */}
            <div className="flex justify-between items-center px-1">
              <div className="flex items-center gap-1.5">
                {camState === 'hotspot-found' && hotspot ? (
                  <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/60 border border-emerald-900/50 px-2.5 py-0.5 rounded">
                    ● HOTSPOT: {hotspot.title}
                  </span>
                ) : (
                  <span className="text-[10px] font-mono text-zinc-500 bg-zinc-950/70 border border-zinc-800/80 px-2.5 py-0.5 rounded">
                    ● COMPOSER ACTIVE
                  </span>
                )}
                {placeName && (
                  <span className="text-[9px] font-mono text-zinc-400 max-w-[120px] truncate">
                    @{placeName}
                  </span>
                )}
              </div>
              <button
                onClick={() => {
                  if (!gps) {
                    toast.error('GPS coordinates not resolved yet.');
                    return;
                  }
                  setShowPinModal(true);
                }}
                className="text-[9px] font-mono border border-zinc-850 bg-zinc-950/90 text-zinc-400 px-2 py-0.5 rounded hover:text-white hover:border-zinc-700 transition-colors"
              >
                PIN CURRENT
              </button>
            </div>
          </div>

          {/* Floating Pose Selection HUD */}
          {poseGuideActive && (
            <div className="absolute top-24 right-4 z-20 flex flex-col gap-2 items-end pointer-events-auto">
              <div className="bg-zinc-950/95 border border-zinc-800 rounded p-2 flex flex-col gap-1 text-[10px] font-mono text-zinc-400 w-32 shadow-xl">
                <span className="text-zinc-500 text-[8px] uppercase tracking-wide">Pose Preset</span>
                {Object.entries(POSE_TEMPLATES).map(([key, t]) => (
                  <button
                    key={key}
                    onClick={() => setSelectedPose(key)}
                    className={`px-1.5 py-0.5 rounded text-left transition-colors truncate ${selectedPose === key ? 'bg-purple-600 text-white' : 'hover:bg-zinc-900'}`}
                  >
                    {t.name}
                  </button>
                ))}
              </div>
              {isPoseNetLoading && (
                <div className="bg-zinc-950/90 border border-zinc-800 rounded px-2 py-1 text-[10px] font-mono text-zinc-400 flex items-center gap-1.5">
                  <Loader2 className="h-3 w-3 animate-spin text-purple-500" />
                  Loading AI Pose...
                </div>
              )}
              {poseMatchScore !== null && (
                <div className="bg-zinc-950/90 border border-zinc-800 rounded px-2.5 py-1 flex items-center gap-1.5 font-mono text-xs shadow-xl">
                  <span className="text-zinc-500">Pose Match:</span>
                  <span className={poseMatchScore >= 75 ? 'text-emerald-400 font-bold' : 'text-amber-400'}>
                    {poseMatchScore}%
                  </span>
                </div>
              )}
            </div>
          )}

          {/* GPS accuracy bottom-left */}
          {gps && (
            <div
              className="absolute bottom-24 left-4 pointer-events-none text-xs font-mono z-10"
              style={{ color: '#71717a' }}
            >
              ±{Math.round(gps.accuracy)}m
            </div>
          )}

          {/* ── Community Inspiration Feed Tray ───────────────────────────── */}
          {suggestions.length > 0 && (
            <div className="absolute bottom-28 left-0 right-0 z-10 px-2 pointer-events-auto">
              <div
                style={{
                  background: 'rgba(0,0,0,0.85)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: '14px',
                  backdropFilter: 'blur(16px)',
                }}
              >
                {/* Header row */}
                <div className="flex items-center justify-between px-3.5 py-2">
                  <div className="flex items-center gap-1.5">
                    <span style={{ fontSize: '9px', letterSpacing: '0.12em', color: '#10b981', fontFamily: 'monospace' }}>
                      ● COMMUNITY FEED
                    </span>
                    {placeName && (
                      <span style={{ fontSize: '9px', color: '#71717a', fontFamily: 'monospace' }}>
                        near {placeName}
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => setShowSuggestions(v => !v)}
                    style={{ fontSize: '9px', color: '#52525b', fontFamily: 'monospace', background: 'none', border: 'none', cursor: 'pointer' }}
                  >
                    {showSuggestions ? '▾ COLLAPSE FEED' : '▸ EXPAND FEED'}
                  </button>
                </div>

                {/* Scrollable cards */}
                {showSuggestions && (
                  <div
                    className="flex gap-3 overflow-x-auto pb-3 px-3.5"
                    style={{ scrollbarWidth: 'none' }}
                  >
                    {suggestions.map((spot, i) => {
                      const platforms = ['Instagram', 'Snapchat', 'Flickr', 'Twitter'];
                      const platform = spot.type.includes('Post') ? spot.type.split(' ')[0] : platforms[i % platforms.length];
                      const platformColors: Record<string, string> = {
                        Instagram: '#e1306c',
                        Snapchat: '#eab308',
                        Flickr: '#0063db',
                        Twitter: '#1da1f2'
                      };
                      const userNames = ['@lens_traveler', '@frame_master', '@viewfinder_pro', '@composition_guru', '@pic_nomad', '@travel_reels'];
                      const userName = userNames[i % userNames.length];
                      const initials = userName.substring(1, 3).toUpperCase();

                      return (
                        <div
                          key={i}
                          style={{
                            minWidth: '150px',
                            maxWidth: '150px',
                            borderRadius: '12px',
                            overflow: 'hidden',
                            border: '1px solid rgba(255,255,255,0.08)',
                            background: '#09090b',
                            flexShrink: 0,
                            display: 'flex',
                            flexDirection: 'column',
                          }}
                        >
                          {/* Profile header */}
                          <div style={{ padding: '6px 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                              <div style={{ width: '16px', height: '16px', borderRadius: '50%', background: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '7px', fontWeight: 'bold', color: '#a1a1aa' }}>
                                {initials}
                              </div>
                              <span style={{ fontSize: '8px', color: '#e4e4e7', fontWeight: 600, fontFamily: 'monospace' }}>
                                {userName}
                              </span>
                            </div>
                            <span style={{ fontSize: '7px', fontWeight: 'bold', color: platformColors[platform] ?? '#a1a1aa', fontFamily: 'monospace', marginLeft: 'auto' }}>
                              {platform.toUpperCase()}
                            </span>
                          </div>

                          {/* Image */}
                          <div style={{ position: 'relative', width: '100%', height: '90px' }}>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={spot.imageUrl}
                              alt={spot.name}
                              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            />
                          </div>

                          {/* Action Info */}
                          <div style={{ padding: '6px 8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <p style={{ fontSize: '8px', color: '#a1a1aa', fontFamily: 'monospace', margin: 0, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                              📍 {spot.name}
                            </p>
                            <button
                              onClick={() => {
                                setPinImageUrl(spot.imageUrl);
                                drawStencil(spot.imageUrl);
                                setShowSuggestions(false);
                                toast.success(`Composition set from ${userName}'s post`);
                              }}
                              style={{
                                width: '100%',
                                padding: '4px 0',
                                background: 'rgba(255,255,255,0.08)',
                                border: '1px solid rgba(255,255,255,0.12)',
                                borderRadius: '6px',
                                color: '#f4f4f5',
                                fontSize: '8px',
                                fontWeight: 600,
                                fontFamily: 'monospace',
                                cursor: 'pointer',
                                textAlign: 'center',
                              }}
                            >
                              USE COMPOSITION
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
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
