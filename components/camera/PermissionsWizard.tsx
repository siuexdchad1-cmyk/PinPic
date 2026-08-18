'use client';

import { useState, useCallback } from 'react';
import { MapPin, Camera, AlertCircle, ArrowRight, Compass } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface PermissionsWizardProps {
  onComplete: (coords: { latitude: number; longitude: number }) => void;
  onClose: () => void;
}

// Default fallback coordinates (Mumbai)
const DEFAULT_COORDS = { latitude: 19.076, longitude: 72.877 };

export default function PermissionsWizard({ onComplete, onClose }: PermissionsWizardProps) {
  const [step, setStep] = useState<1 | 2>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cachedCoords, setCachedCoords] = useState<{ latitude: number; longitude: number } | null>(null);

  // ── Step 1: Geolocation with Fallback ────────────────────────────────────
  const applyDefaultLocation = useCallback(() => {
    setCachedCoords(DEFAULT_COORDS);
    setError(null);
    setLoading(false);
    setStep(2);
  }, []);

  function requestGeolocation() {
    setLoading(true);
    setError(null);

    if (!('geolocation' in navigator)) {
      setError('GPS Location is not supported by this browser. Using default location.');
      applyDefaultLocation();
      return;
    }

    // Try high accuracy first (8s timeout)
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCachedCoords({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
        setLoading(false);
        setStep(2);
      },
      (firstErr) => {
        console.warn('[GPS High Accuracy Failed, trying low accuracy]', firstErr.message);

        // Fallback retry with low accuracy (fast IP/cell triangulation)
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            setCachedCoords({
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
            });
            setLoading(false);
            setStep(2);
          },
          (secondErr) => {
            let msg = 'Location access error. You can continue using the default location below.';
            if (secondErr.code === secondErr.PERMISSION_DENIED) {
              msg = 'Permission Denied: Location access blocked in browser. Use default location to proceed.';
            } else if (secondErr.code === secondErr.POSITION_UNAVAILABLE) {
              msg = 'Position Unavailable: Unable to detect GPS location. Use default location to proceed.';
            } else if (secondErr.code === secondErr.TIMEOUT) {
              msg = 'Location Timeout: Took too long to acquire GPS signal indoors/desktop. Use default location to proceed.';
            }
            setError(msg);
            setLoading(false);
          },
          { enableHighAccuracy: false, timeout: 5000, maximumAge: 60000 }
        );
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
    );
  }

  // ── Step 2: Camera ───────────────────────────────────────────────────────
  async function requestCamera() {
    setLoading(true);
    setError(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false,
      });
      stream.getTracks().forEach((track) => track.stop());

      const coords = cachedCoords || DEFAULT_COORDS;
      onComplete(coords);
    } catch {
      setError('Camera access was denied. PinPic needs the camera to overlay composition guides.');
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col justify-between p-6 md:p-12 select-none animate-fade-in">
      {/* Top Header */}
      <div className="flex justify-between items-center w-full border-b border-zinc-900 pb-4">
        <span className="text-[10px] font-mono tracking-widest text-emerald-400 font-bold uppercase">
          ● PINPIC SETUP WIZARD
        </span>
        <span className="text-[10px] font-mono text-zinc-500">
          STEP {step} OF 2
        </span>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col justify-center max-w-md mx-auto w-full py-8">
        {step === 1 ? (
          <div className="flex flex-col animate-slide-up">
            <div className="h-12 w-12 border border-zinc-800 flex items-center justify-center bg-zinc-950 mb-8">
              <MapPin className="h-5 w-5 text-white" />
            </div>

            <h1 className="text-3xl font-bold tracking-tight text-white mb-4 uppercase font-mono">
              GPS LOCATION
            </h1>
            <p className="text-sm text-zinc-400 leading-relaxed mb-8">
              PinPic scans local geography to search for nearby photographic hotspots. We map coordinates to pull live reference stencils.
            </p>

            {error && (
              <div className="flex flex-col gap-3 border border-red-950/60 bg-red-950/20 p-4 mb-6 text-xs font-mono">
                <div className="flex items-start gap-2.5 text-red-400">
                  <AlertCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
                <button
                  type="button"
                  onClick={applyDefaultLocation}
                  className="self-start text-[10px] font-bold uppercase tracking-widest bg-emerald-500 hover:bg-emerald-400 text-black px-3 py-2 rounded-none transition-colors flex items-center gap-1.5 mt-1"
                >
                  <Compass className="h-3.5 w-3.5" />
                  Use Default Location (Mumbai) &rarr;
                </button>
              </div>
            )}

            <div className="flex flex-col gap-3">
              <Button
                onClick={requestGeolocation}
                disabled={loading}
                className="w-full bg-emerald-500 hover:bg-emerald-600 text-black font-mono font-bold h-14 rounded-none transition-all duration-150 flex items-center justify-center gap-2 tracking-wider"
              >
                {loading ? 'ACQUIRING FIX…' : 'GRANT LOCATION ACCESS'}
                {!loading && <ArrowRight className="h-4 w-4" />}
              </Button>

              <button
                type="button"
                onClick={applyDefaultLocation}
                className="w-full border border-zinc-800 hover:border-zinc-700 bg-zinc-950 hover:bg-zinc-900 text-zinc-400 hover:text-white font-mono text-xs py-3.5 transition-all flex items-center justify-center gap-2 uppercase tracking-wider"
              >
                <Compass className="h-3.5 w-3.5 text-emerald-500" />
                Use Default Location (Mumbai)
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col animate-slide-up">
            <div className="h-12 w-12 border border-zinc-800 flex items-center justify-center bg-zinc-950 mb-8">
              <Camera className="h-5 w-5 text-white" />
            </div>

            <h1 className="text-3xl font-bold tracking-tight text-white mb-4 uppercase font-mono">
              CAMERA VIEWPORT
            </h1>
            <p className="text-sm text-zinc-400 leading-relaxed mb-8">
              Overlay stencils directly onto your camera stream to align framing, angles, and horizon lines with reference images.
            </p>

            {error && (
              <div className="flex items-start gap-3 border border-red-950/40 bg-red-950/10 p-4 mb-6 text-xs text-red-400 font-mono">
                <AlertCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <Button
              onClick={requestCamera}
              disabled={loading}
              className="w-full bg-emerald-500 hover:bg-emerald-600 text-black font-mono font-bold h-14 rounded-none transition-all duration-150 flex items-center justify-center gap-2 tracking-wider"
            >
              {loading ? 'INITIALIZING VIEWPORT…' : 'ALLOW CAMERA ACCESS'}
              {!loading && <ArrowRight className="h-4 w-4" />}
            </Button>
          </div>
        )}
      </div>

      {/* Bottom Footer Actions */}
      <div className="flex justify-between items-center w-full border-t border-zinc-900 pt-4">
        <button
          onClick={onClose}
          className="text-[10px] font-mono text-zinc-500 hover:text-zinc-300 transition-colors uppercase tracking-wider"
        >
          Skip onboarding &rarr;
        </button>
        <span className="text-[9px] font-mono text-zinc-700">
          PINPIC PWA CORE v1.2
        </span>
      </div>
    </div>
  );
}
