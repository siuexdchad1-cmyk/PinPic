'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { MapPin } from 'lucide-react';

// ── Minimal Rule-of-Thirds composition canvas ─────────────────────────────
function CompositionCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const parent = canvas.parentElement;
    if (!parent) return;

    const draw = () => {
      const w = parent.offsetWidth;
      const h = parent.offsetHeight;
      canvas.width  = w;
      canvas.height = h;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.clearRect(0, 0, w, h);

      // Rule of thirds grid — crisp 1px white lines
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
      ctx.lineWidth   = 1;

      // Vertical thirds
      [w / 3, (2 * w) / 3].forEach((x) => {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      });

      // Horizontal thirds
      [h / 3, (2 * h) / 3].forEach((y) => {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      });

      // Corner bracket guides — stronger white
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
      const arm = Math.min(w, h) * 0.1;
      const pad = 16;

      // Top-left
      ctx.beginPath(); ctx.moveTo(pad, pad + arm); ctx.lineTo(pad, pad); ctx.lineTo(pad + arm, pad); ctx.stroke();
      // Top-right
      ctx.beginPath(); ctx.moveTo(w - pad - arm, pad); ctx.lineTo(w - pad, pad); ctx.lineTo(w - pad, pad + arm); ctx.stroke();
      // Bottom-left
      ctx.beginPath(); ctx.moveTo(pad, h - pad - arm); ctx.lineTo(pad, h - pad); ctx.lineTo(pad + arm, h - pad); ctx.stroke();
      // Bottom-right
      ctx.beginPath(); ctx.moveTo(w - pad - arm, h - pad); ctx.lineTo(w - pad, h - pad); ctx.lineTo(w - pad, h - pad - arm); ctx.stroke();

      // Center crosshair
      const cx = w / 2;
      const cy = h / 2;
      const ca = 8;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.beginPath();
      ctx.moveTo(cx - ca, cy); ctx.lineTo(cx + ca, cy);
      ctx.moveTo(cx, cy - ca); ctx.lineTo(cx, cy + ca);
      ctx.stroke();

      // Horizon line (lower third emphasis)
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(0, h * 0.62);
      ctx.lineTo(w, h * 0.62);
      ctx.stroke();
    };

    draw();
    const ro = new ResizeObserver(draw);
    ro.observe(parent);
    return () => ro.disconnect();
  }, []);

  return <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none" />;
}

// ── Feature row item ───────────────────────────────────────────────────────
interface FeatureRowProps {
  index: string;
  label: string;
  value: string;
}

function FeatureRow({ index, label, value }: FeatureRowProps) {
  return (
    <div className="flex items-center justify-between border-b border-zinc-900 py-4 group">
      <div className="flex items-center gap-6">
        <span className="text-[10px] font-mono tabular-nums text-zinc-700 w-6 select-none">{index}</span>
        <span className="text-sm text-zinc-400 group-hover:text-white transition-colors duration-150">{label}</span>
      </div>
      <span className="text-xs font-mono tabular-nums text-zinc-600">{value}</span>
    </div>
  );
}

// ── Stat block ─────────────────────────────────────────────────────────────
interface StatProps {
  number: string;
  unit: string;
  label: string;
}

function Stat({ number, unit, label }: StatProps) {
  return (
    <div className="border-r border-zinc-900 last:border-r-0 pr-8 last:pr-0">
      <div className="flex items-baseline gap-1 mb-1">
        <span className="text-3xl font-black tabular-nums tracking-tighter text-white">{number}</span>
        <span className="text-sm font-mono text-zinc-500">{unit}</span>
      </div>
      <p className="text-[10px] font-mono uppercase tracking-widest text-zinc-600">{label}</p>
    </div>
  );
}

// ── Main page export ───────────────────────────────────────────────────────
export default function LandingPage() {
  return (
    <div className="min-h-screen bg-black text-white overflow-x-hidden">

      {/* ── Navbar ──────────────────────────────────────────────────────── */}
      <header className="border-b border-zinc-900 sticky top-0 z-50 bg-black">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-white" strokeWidth={2.5} />
            <span className="text-sm font-semibold tracking-tight">PinPic</span>
          </div>

          <div className="hidden md:flex items-center gap-8">
            {['Features', 'Map', 'Camera', 'Scrapbook'].map((item) => (
              <span
                key={item}
                className="text-xs font-mono uppercase tracking-widest text-zinc-600 hover:text-white transition-colors duration-150 cursor-pointer"
              >
                {item}
              </span>
            ))}
          </div>

          <nav className="flex items-center gap-3">
            <Link
              href="/login"
              className="text-xs font-mono text-zinc-500 hover:text-white transition-colors duration-150 tracking-wide"
            >
              Sign in
            </Link>
            <Link href="/signup">
              <button className="bg-white text-black font-medium text-xs px-4 h-8 rounded-md hover:bg-zinc-200 transition-all duration-150 active:scale-[0.99] tracking-tight">
                Get started
              </button>
            </Link>
          </nav>
        </div>
      </header>

      {/* ── Hero ────────────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-6 pt-20 pb-24 lg:pt-32 lg:pb-40">
        <div className="flex flex-col lg:flex-row items-start gap-16 lg:gap-24">

          {/* Left: Type block */}
          <div className="flex-1 min-w-0 pt-2">

            {/* System tag */}
            <div className="flex items-center gap-3 mb-10">
              <div className="h-px w-8 bg-zinc-700" />
              <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-zinc-600">
                Composition Intelligence — v2.1
              </span>
            </div>

            {/* Headline */}
            <h1 className="text-6xl md:text-9xl font-black tracking-tighter text-white uppercase leading-[0.9] mb-10">
              Travel.<br />
              Compose.<br />
              Perfect.
            </h1>

            {/* Description */}
            <p className="text-base text-zinc-500 leading-relaxed max-w-sm mb-12">
              Step into a GPS hotspot anywhere on Earth. A live composition wireframe overlays your camera, aligning your shot to a professional reference frame in real-time.
            </p>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row gap-3 mb-16">
              <Link href="/signup" className="flex-1 sm:flex-none">
                <button className="w-full sm:w-auto bg-white text-black font-medium h-14 px-8 rounded-md hover:bg-zinc-200 transition-all duration-150 active:scale-[0.99] text-sm tracking-tight">
                  Start for free
                </button>
              </Link>
              <Link href="/explore" className="flex-1 sm:flex-none">
                <button className="w-full sm:w-auto bg-transparent border border-zinc-800 text-white font-medium h-14 px-8 rounded-md hover:border-zinc-600 hover:bg-zinc-950 transition-all duration-150 active:scale-[0.99] text-sm tracking-tight">
                  Explore map
                </button>
              </Link>
            </div>

            {/* Stats bar */}
            <div className="border-t border-zinc-900 pt-8 flex gap-8">
              <Stat number="140+" unit="spots" label="Mapped globally" />
              <Stat number="AI" unit="score" label="Composition grader" />
              <Stat number="PWA" unit="app" label="Offline ready" />
            </div>
          </div>

          {/* Right: Phone mockup */}
          <div className="w-full lg:w-auto flex flex-col items-center lg:items-end gap-6 shrink-0">

            {/* Phone frame */}
            <div className="border border-zinc-900 bg-black overflow-hidden relative max-w-[280px] w-full aspect-[9/19] rounded-[2rem] shadow-2xl">

              {/* Status bar */}
              <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-5 pt-4 z-20">
                <span className="text-[9px] font-mono tabular-nums text-zinc-600">9:41</span>
                <div className="w-16 h-4 bg-black rounded-full border border-zinc-900 mx-auto absolute left-1/2 -translate-x-1/2 top-2" />
                <div className="flex items-center gap-1">
                  <div className="w-3 h-1.5 rounded-sm border border-zinc-700 relative">
                    <div className="absolute inset-[1px] bg-white rounded-[1px]" />
                  </div>
                </div>
              </div>

              {/* HUD bar */}
              <div className="absolute top-8 left-0 right-0 z-20 px-4 pt-3">
                <div className="flex items-center justify-between">
                  <span className="text-[8px] font-mono uppercase tracking-widest text-zinc-600">● REC</span>
                  <span className="text-[8px] font-mono tabular-nums text-zinc-600">GPS LOCKED</span>
                  <span className="text-[8px] font-mono text-zinc-600">AI</span>
                </div>
              </div>

              {/* Canvas composition overlay */}
              <CompositionCanvas />

              {/* Bottom HUD bar */}
              <div className="absolute bottom-0 left-0 right-0 z-20 border-t border-zinc-900 bg-black/90 px-4 py-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[8px] font-mono uppercase tracking-widest text-zinc-600">Score</span>
                  <span className="text-[8px] font-mono tabular-nums text-white">94%</span>
                </div>
                <div className="h-px bg-zinc-900 w-full relative overflow-hidden">
                  <div className="absolute inset-y-0 left-0 bg-white" style={{ width: '94%' }} />
                </div>
                <p className="text-[7px] font-mono text-zinc-700 mt-2 uppercase tracking-widest">Align left shoulder +2°</p>
              </div>
            </div>

            {/* Side annotation */}
            <div className="flex items-start gap-3 max-w-[280px] w-full">
              <div className="h-px w-4 bg-zinc-700 mt-2 shrink-0" />
              <p className="text-[10px] font-mono text-zinc-600 leading-relaxed">
                Live AI composition scoring and pose alignment — processed entirely on-device via TensorFlow.js.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Feature Index ───────────────────────────────────────────────── */}
      <section className="border-t border-zinc-900">
        <div className="mx-auto max-w-6xl px-6 py-20">

          <div className="flex items-center gap-6 mb-12">
            <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-zinc-600">System capabilities</span>
            <div className="h-px flex-1 bg-zinc-900" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-16">
            <div>
              <FeatureRow index="01" label="GPS Geofencing"        value="±5m precision" />
              <FeatureRow index="02" label="AI Composition Scoring" value="Groq Llama 4" />
              <FeatureRow index="03" label="Live Pose Guide"        value="PoseNet v2.2" />
              <FeatureRow index="04" label="Worldwide Geocoding"    value="OpenStreetMap" />
            </div>
            <div>
              <FeatureRow index="05" label="Community Photo Feed"   value="Instagram Scraper" />
              <FeatureRow index="06" label="Shot Scrapbook"         value="Supabase Cloud" />
              <FeatureRow index="07" label="Global Hotspot Map"     value="Leaflet + CartoDB" />
              <FeatureRow index="08" label="Offline PWA"            value="Service Worker" />
            </div>
          </div>
        </div>
      </section>

      {/* ── Three-column Proposition ─────────────────────────────────────── */}
      <section className="border-t border-zinc-900">
        <div className="mx-auto max-w-6xl">
          <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-zinc-900">

            {([
              {
                tag: 'Step 01',
                title: 'Arrive.',
                body: 'PinPic detects your GPS coordinates and instantly matches you to the nearest community-mapped hotspot within 15 metres.',
              },
              {
                tag: 'Step 02',
                title: 'Frame.',
                body: 'A precise composition wireframe overlays your live camera stream. The AI Pose Guide tracks your joints and scores alignment in real-time.',
              },
              {
                tag: 'Step 03',
                title: 'Capture.',
                body: 'Shoot. Groq Vision scores your composition, generates a caption, and saves the result to your personal scrapbook.',
              },
            ] as { tag: string; title: string; body: string }[]).map((step) => (
              <div key={step.tag} className="px-8 py-12">
                <span className="text-[10px] font-mono uppercase tracking-widest text-zinc-700 block mb-6">{step.tag}</span>
                <h3 className="text-3xl font-black tracking-tighter text-white uppercase mb-4">{step.title}</h3>
                <p className="text-sm text-zinc-500 leading-relaxed">{step.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Full-width CTA ───────────────────────────────────────────────── */}
      <section className="border-t border-zinc-900">
        <div className="mx-auto max-w-6xl px-6 py-24 flex flex-col md:flex-row items-start md:items-end justify-between gap-10">

          <div>
            <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-zinc-700 mb-6">Ready to shoot?</p>
            <h2 className="text-5xl md:text-7xl font-black tracking-tighter text-white uppercase leading-[0.9]">
              Open the<br />camera.
            </h2>
          </div>

          <div className="flex flex-col gap-3 w-full md:w-auto min-w-[220px]">
            <Link href="/signup">
              <button className="w-full bg-white text-black font-medium h-14 rounded-md hover:bg-zinc-200 transition-all duration-150 active:scale-[0.99] text-sm tracking-tight">
                Create free account
              </button>
            </Link>
            <Link href="/login">
              <button className="w-full bg-transparent border border-zinc-800 text-zinc-400 font-medium h-14 rounded-md hover:border-zinc-600 hover:text-white transition-all duration-150 active:scale-[0.99] text-sm tracking-tight">
                Sign in
              </button>
            </Link>
          </div>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────────────────── */}
      <footer className="border-t border-zinc-900">
        <div className="mx-auto max-w-6xl px-6 py-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <MapPin className="h-3 w-3 text-zinc-700" strokeWidth={2.5} />
            <span className="text-[10px] font-mono text-zinc-700 tracking-wider">PINPIC</span>
          </div>
          <div className="flex items-center gap-6">
            {['Privacy', 'Terms', 'GitHub'].map((item) => (
              <span key={item} className="text-[10px] font-mono text-zinc-700 hover:text-zinc-400 transition-colors cursor-pointer tracking-wider">
                {item}
              </span>
            ))}
          </div>
          <span className="text-[10px] font-mono tabular-nums text-zinc-800">© 2026 PinPic</span>
        </div>
      </footer>

    </div>
  );
}
