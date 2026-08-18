'use client';

import { useState, useCallback } from 'react';
import { MapPin, Camera, AlertCircle, ArrowRight, Compass } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getSmartLocation } from '@/lib/geo-fallback';

interface PermissionsWizardProps {
  onComplete: (coords: { latitude: number; longitude: number }) => void;
  onClose: () => void;
}

const DEFAULT_COORDS = { latitude: 19.076, longitude: 72.877 };

export default function PermissionsWizard({ onComplete, onClose }: PermissionsWizardProps) {
  const [step, setStep] = useState<1 | 2>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cachedCoords, setCachedCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locationSource, setLocationSource] = useState<string | null>(null);

  const applyDefaultLocation = useCallback(() => {
    setCachedCoords(DEFAULT_COORDS);
    setLocationSource('default');
    setError(null);
    setLoading(false);
    setStep(2);
  }, []);

  async function requestGeolocation() {
    setLoading(true);
    setError(null);

    try {
      const loc = await getSmartLocation();
      setCachedCoords({ latitude: loc.latitude, longitude: loc.longitude });
      setLocationSource(loc.source);
      setLoading(false);
      setStep(2);
    } catch {
      applyDefaultLocation();
    }
  }

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
              LOCATION FIX
            </h1>
            <p className="text-sm text-zinc-400 leading-relaxed mb-8">
              PinPic scans local geography to search for nearby photographic hotspots. We use GPS or IP location to pull live 1–2 km reference stencils.
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
                {loading ? 'RESOLVING LOCATION…' : 'DETECT LOCATION (GPS / IP)'}
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
            <p className="text-sm text-zinc-400 leading-relaxed mb-4">
              Overlay stencils directly onto your camera stream to align framing, angles, and horizon lines with reference images.
            </p>

            {locationSource && (
              <div className="mb-6 px-3 py-2 bg-zinc-900/80 border border-zinc-800 rounded text-[9px] font-mono text-zinc-400 uppercase tracking-widest flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                Location Fix: <span className="text-emerald-400 font-bold">{locationSource.toUpperCase()}</span> ({cachedCoords?.latitude.toFixed(3)}°, {cachedCoords?.longitude.toFixed(3)}°)
              </div>
            )}

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
