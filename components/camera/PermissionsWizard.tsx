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
      setError('Camera access denied.');
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center p-4 select-none animate-fade-in">
      
      {/* Compact Wizard Card */}
      <div className="w-full max-w-sm bg-zinc-950 border border-zinc-800 rounded-2xl p-6 shadow-2xl flex flex-col justify-between animate-slide-up">
        
        {/* Top Header */}
        <div className="flex justify-between items-center w-full border-b border-zinc-850 pb-3 mb-4">
          <span className="text-[9px] font-mono tracking-widest text-emerald-400 font-bold uppercase flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            PINPIC SETUP
          </span>
          <span className="text-[9px] font-mono text-zinc-500">
            STEP {step} OF 2
          </span>
        </div>

        {/* Step Content */}
        <div className="py-2">
          {step === 1 ? (
            <div className="flex flex-col">
              <div className="h-9 w-9 border border-zinc-800 rounded-lg flex items-center justify-center bg-zinc-900 mb-4 text-emerald-400">
                <MapPin className="h-4 w-4" />
              </div>

              <h2 className="text-base font-bold tracking-tight text-white mb-1.5 uppercase font-mono">
                LOCATION FIX
              </h2>
              <p className="text-xs text-zinc-400 font-mono leading-relaxed mb-5">
                PinPic maps your location (GPS or IP) to load nearby 1–2 km photo inspiration.
              </p>

              {error && (
                <div className="flex flex-col gap-2 border border-red-950/60 bg-red-950/20 p-3 mb-4 rounded-lg text-xs font-mono">
                  <div className="flex items-start gap-2 text-red-400 text-[11px]">
                    <AlertCircle className="h-3.5 w-3.5 text-red-500 shrink-0 mt-0.5" />
                    <span>{error}</span>
                  </div>
                </div>
              )}

              <div className="flex flex-col gap-2.5">
                <Button
                  onClick={requestGeolocation}
                  disabled={loading}
                  className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-mono font-bold h-11 text-xs rounded-xl transition-all flex items-center justify-center gap-2 tracking-wider"
                >
                  {loading ? 'RESOLVING…' : 'DETECT LOCATION'}
                  {!loading && <ArrowRight className="h-3.5 w-3.5" />}
                </Button>

                <button
                  type="button"
                  onClick={applyDefaultLocation}
                  className="w-full border border-zinc-800 hover:border-zinc-700 bg-zinc-900 hover:bg-zinc-850 text-zinc-300 font-mono text-[10px] py-2.5 rounded-xl transition-all flex items-center justify-center gap-1.5 uppercase tracking-wider"
                >
                  <Compass className="h-3 w-3 text-emerald-500" />
                  Use Default Location (Mumbai)
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col">
              <div className="h-9 w-9 border border-zinc-800 rounded-lg flex items-center justify-center bg-zinc-900 mb-4 text-emerald-400">
                <Camera className="h-4 w-4" />
              </div>

              <h2 className="text-base font-bold tracking-tight text-white mb-1.5 uppercase font-mono">
                CAMERA ACCESS
              </h2>
              <p className="text-xs text-zinc-400 font-mono leading-relaxed mb-4">
                Allow camera access to take photos and analyze composition with Groq AI.
              </p>

              {locationSource && (
                <div className="mb-4 px-2.5 py-1.5 bg-zinc-900 border border-zinc-800 rounded-lg text-[9px] font-mono text-zinc-400 uppercase tracking-widest flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  Location: <span className="text-emerald-400 font-bold">{locationSource.toUpperCase()}</span> ({cachedCoords?.latitude.toFixed(2)}°, {cachedCoords?.longitude.toFixed(2)}°)
                </div>
              )}

              {error && (
                <div className="flex items-start gap-2 border border-red-950/40 bg-red-950/10 p-3 mb-4 rounded-lg text-[11px] text-red-400 font-mono">
                  <AlertCircle className="h-3.5 w-3.5 text-red-500 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <Button
                onClick={requestCamera}
                disabled={loading}
                className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-mono font-bold h-11 text-xs rounded-xl transition-all flex items-center justify-center gap-2 tracking-wider"
              >
                {loading ? 'STARTING…' : 'ALLOW CAMERA ACCESS'}
                {!loading && <ArrowRight className="h-3.5 w-3.5" />}
              </Button>
            </div>
          )}
        </div>

        {/* Bottom Footer Actions */}
        <div className="flex justify-between items-center w-full border-t border-zinc-850 pt-3 mt-4">
          <button
            onClick={onClose}
            className="text-[9px] font-mono text-zinc-500 hover:text-zinc-300 transition-colors uppercase tracking-wider"
          >
            Skip &rarr;
          </button>
          <span className="text-[8px] font-mono text-zinc-600 uppercase">
            PINPIC CORE v1.2
          </span>
        </div>

      </div>
    </div>
  );
}
