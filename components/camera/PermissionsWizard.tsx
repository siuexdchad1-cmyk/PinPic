'use client';

import { useState } from 'react';
import { MapPin, Camera, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface PermissionsWizardProps {
  onComplete: (coords: { latitude: number; longitude: number }) => void;
  onClose: () => void;
}

export default function PermissionsWizard({ onComplete, onClose }: PermissionsWizardProps) {
  const [step, setStep] = useState<1 | 2>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cachedCoords, setCachedCoords] = useState<{ latitude: number; longitude: number } | null>(null);

  // ── Step 1: Geolocation ──────────────────────────────────────────────────
  function requestGeolocation() {
    setLoading(true);
    setError(null);

    if (!('geolocation' in navigator)) {
      setError('This browser does not support GPS location.');
      setLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCachedCoords({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
        setLoading(false);
        setStep(2);
      },
      (errorObj) => {
        let msg = 'Location access was denied. PinPic needs GPS to find landmarks near you.';
        if (errorObj.code === errorObj.PERMISSION_DENIED) {
          msg = 'Permission Denied: Please allow location access in your device settings/browser permissions.';
        } else if (errorObj.code === errorObj.POSITION_UNAVAILABLE) {
          msg = 'Position Unavailable: Unable to detect GPS location. Ensure location services are on and you have signal.';
        } else if (errorObj.code === errorObj.TIMEOUT) {
          msg = 'Location Timeout: Took too long to acquire GPS signal. Try stepping outdoors or moving to an open area.';
        }
        setError(msg);
        setLoading(false);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
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

      if (cachedCoords) {
        onComplete(cachedCoords);
      } else {
        setError('GPS data was lost. Please go back and allow location again.');
        setStep(1);
        setLoading(false);
      }
    } catch {
      setError('Camera access was denied. PinPic needs the camera to overlay composition guides.');
      setLoading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black z-50 flex items-center justify-center p-6"
      style={{ transform: 'translate3d(0,0,0)' }}
    >
      <div className="w-full max-w-sm border border-zinc-900 bg-black p-8 flex flex-col">

        {/* Step indicator */}
        <div className="flex items-center gap-2 mb-10">
          <div className={`h-px flex-1 transition-colors duration-150 ${step >= 1 ? 'bg-white' : 'bg-zinc-800'}`} />
          <div className={`h-px flex-1 transition-colors duration-150 ${step >= 2 ? 'bg-white' : 'bg-zinc-800'}`} />
        </div>

        {/* ── STEP 1: Location Access ──────────────────────────────────────── */}
        {step === 1 && (
          <div className="flex flex-col">
            <MapPin className="h-6 w-6 text-white mb-8" />

            <h1 className="text-2xl font-bold text-white tracking-tight mb-2">
              Location Access
            </h1>
            <p className="text-sm text-zinc-400 leading-relaxed mb-8 max-w-xs">
              PinPic maps physical coordinates to check if you are standing at a cinematic reference landmark.
            </p>

            {error && (
              <div className="flex items-start gap-3 border border-zinc-800 p-4 mb-6 text-xs text-zinc-400">
                <AlertCircle className="h-4 w-4 text-zinc-500 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <Button
              onClick={requestGeolocation}
              disabled={loading}
              className="w-full bg-white text-black font-medium h-12 rounded-lg hover:bg-zinc-200 transition-colors duration-150 active:scale-[0.98]"
            >
              {loading ? 'Requesting…' : 'Allow Location'}
            </Button>
          </div>
        )}

        {/* ── STEP 2: Camera Access ────────────────────────────────────────── */}
        {step === 2 && (
          <div className="flex flex-col">
            <Camera className="h-6 w-6 text-white mb-8" />

            <h1 className="text-2xl font-bold text-white tracking-tight mb-2">
              Camera Access
            </h1>
            <p className="text-sm text-zinc-400 leading-relaxed mb-8 max-w-xs">
              PinPic overlays a composition guide on your camera feed so you can match the reference frame exactly.
            </p>

            {error && (
              <div className="flex items-start gap-3 border border-zinc-800 p-4 mb-6 text-xs text-zinc-400">
                <AlertCircle className="h-4 w-4 text-zinc-500 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <Button
              onClick={requestCamera}
              disabled={loading}
              className="w-full bg-white text-black font-medium h-12 rounded-lg hover:bg-zinc-200 transition-colors duration-150 active:scale-[0.98]"
            >
              {loading ? 'Opening Camera…' : 'Allow Camera'}
            </Button>
          </div>
        )}

        {/* Skip link */}
        <button
          onClick={onClose}
          className="mt-6 text-xs text-zinc-700 hover:text-zinc-400 transition-colors duration-150 text-left"
        >
          Skip for now
        </button>

      </div>
    </div>
  );
}
