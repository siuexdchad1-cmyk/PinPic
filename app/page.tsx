'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { MapPin, Camera, Brain, Globe, Shield, Sparkles, BookImage, ChevronRight, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-black text-white">

      {/* ── Header ─────────────────────────────────────────── */}
      <header className="border-b border-zinc-900">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-6">
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-white" />
            <span className="text-sm font-semibold tracking-tight">PinPic</span>
          </div>
          <nav className="flex items-center gap-6">
            <Link href="/login" className="text-sm text-zinc-400 hover:text-white transition-colors duration-150">
              Sign in
            </Link>
            <Link href="/signup">
              <Button size="sm" className="bg-white text-black hover:bg-zinc-200 transition-colors duration-150 font-medium rounded-lg">
                Get Started
              </Button>
            </Link>
          </nav>
        </div>
      </header>

      {/* ── Hero Section ─────────────────────────────────────── */}
      <section className="mx-auto max-w-5xl px-6 pt-24 pb-32">
        <div className="flex flex-col lg:flex-row items-start gap-20">

          {/* Left: Editorial Typography Block */}
          <div className="flex-1 min-w-0">
            <p className="text-xs text-zinc-500 font-mono uppercase tracking-widest mb-8">
              Composition Geofencing App
            </p>

            <h1 className="text-6xl md:text-8xl font-black tracking-tighter text-white uppercase leading-none mb-10">
              Travel.<br />
              Compose.<br />
              Perfect.
            </h1>

            <p className="text-base text-zinc-400 leading-relaxed max-w-sm mb-12">
              Step into a GPS hotspot anywhere on Earth. A crisp composition wireframe overlays your live camera feed, helping you frame exactly like a professional reference shot.
            </p>

            <div className="flex flex-col sm:flex-row gap-3">
              <Link href="/signup">
                <Button
                  size="lg"
                  className="w-full sm:w-auto bg-white text-black hover:bg-zinc-200 transition-colors duration-150 font-semibold rounded-lg"
                >
                  Start for Free <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
              </Link>
              <Link href="/login">
                <Button
                  variant="outline"
                  size="lg"
                  className="w-full sm:w-auto border-zinc-800 text-white hover:bg-zinc-900 transition-colors duration-150 rounded-lg"
                >
                  Sign In
                </Button>
              </Link>
            </div>

            {/* Divider Stats Row */}
            <div className="mt-16 pt-8 border-t border-zinc-900 flex gap-10">
              {[
                { value: 'Global', label: 'GPS Coverage' },
                { value: 'Llama 3.2', label: 'Vision Model' },
                { value: 'Free', label: 'All Tiers' },
              ].map(({ value, label }) => (
                <div key={label}>
                  <div className="text-sm font-bold text-white font-mono">{value}</div>
                  <div className="text-xs text-zinc-600 mt-0.5">{label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Right: Minimal Phone Mockup */}
          <div className="flex-shrink-0 w-full max-w-[260px] mx-auto lg:mx-0 lg:mt-8">
            <div className="border border-zinc-800 rounded-[2.5rem] bg-black overflow-hidden relative aspect-[9/19]">
              <ViewfinderCanvas />

              {/* Score Badge — flat, no glow */}
              <div className="absolute bottom-6 left-1/2 -translate-x-1/2 whitespace-nowrap px-3 py-1 rounded border border-zinc-800 bg-zinc-950 text-white font-mono text-[10px] tracking-widest">
                MATCH 87%
              </div>
            </div>

            <p className="mt-3 text-[10px] text-zinc-600 text-center font-mono uppercase tracking-widest">
              Live Composition Overlay
            </p>
          </div>

        </div>
      </section>

      {/* ── Full-bleed Section Divider ─────────────────────── */}
      <div className="border-t border-zinc-900" />

      {/* ── How It Works ─────────────────────────────────────── */}
      <section className="mx-auto max-w-5xl px-6 py-24">
        <div className="mb-16">
          <p className="text-xs text-zinc-500 font-mono uppercase tracking-widest mb-4">How It Works</p>
          <h2 className="text-4xl md:text-5xl font-black tracking-tighter uppercase text-white">
            Three Steps.<br />One Perfect Shot.
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-zinc-900 border border-zinc-900">
          {[
            {
              icon: MapPin,
              num: '01',
              title: 'Walk In',
              desc: 'Your GPS coordinates are continuously checked against a global PostGIS database of cinematic landmarks.',
            },
            {
              icon: Camera,
              num: '02',
              title: 'Align',
              desc: 'A minimal white composition guide overlays your live camera feed. Match the frame to unlock the shot.',
            },
            {
              icon: Brain,
              num: '03',
              title: 'Capture',
              desc: 'Groq AI evaluates your framing in real-time, scores composition accuracy, and saves the result.',
            },
          ].map(({ icon: Icon, num, title, desc }) => (
            <div key={num} className="p-8 flex flex-col gap-6">
              <div className="flex items-center justify-between">
                <span className="text-xs text-zinc-600 font-mono">{num}</span>
                <Icon className="h-4 w-4 text-zinc-500" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white tracking-tight mb-2">{title}</h3>
                <p className="text-sm text-zinc-500 leading-relaxed">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="border-t border-zinc-900" />

      {/* ── Specs Grid ───────────────────────────────────────── */}
      <section className="mx-auto max-w-5xl px-6 py-24">
        <div className="mb-16">
          <p className="text-xs text-zinc-500 font-mono uppercase tracking-widest mb-4">Technical Stack</p>
          <h2 className="text-4xl md:text-5xl font-black tracking-tighter uppercase text-white">
            Built on Free Tiers.<br />No Compromises.
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-px bg-zinc-900">
          {SPECS.map(({ icon: Icon, title, desc }) => (
            <div key={title} className="bg-black p-8 flex flex-col gap-4">
              <Icon className="h-4 w-4 text-zinc-500" />
              <div>
                <h3 className="text-sm font-semibold text-white mb-1">{title}</h3>
                <p className="text-xs text-zinc-500 leading-relaxed">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="border-t border-zinc-900" />

      {/* ── CTA ───────────────────────────────────────────────── */}
      <section className="mx-auto max-w-5xl px-6 py-32">
        <div className="flex flex-col lg:flex-row items-start lg:items-end justify-between gap-10">
          <h2 className="text-5xl md:text-7xl font-black tracking-tighter uppercase text-white leading-none">
            Frame It<br />Right.
          </h2>
          <div className="flex flex-col gap-3 lg:items-end">
            <p className="text-sm text-zinc-400 max-w-xs lg:text-right">
              Free to start. No app store. Install as a PWA directly from your browser.
            </p>
            <Link href="/signup">
              <Button
                size="lg"
                className="w-full lg:w-auto bg-white text-black hover:bg-zinc-200 transition-colors duration-150 font-semibold rounded-lg"
              >
                Create Account <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────── */}
      <footer className="border-t border-zinc-900">
        <div className="mx-auto flex flex-col sm:flex-row max-w-5xl items-center justify-between gap-4 px-6 py-8">
          <div className="flex items-center gap-2 text-sm text-zinc-600">
            <MapPin className="h-4 w-4" />
            <span>PinPic</span>
          </div>
          <p className="text-xs text-zinc-700 text-center">
            Curriculum and Lab Standards Curated by Prathamesh Sir
          </p>
          <div className="flex items-center gap-6 text-xs text-zinc-600">
            <Link href="/login" className="hover:text-white transition-colors duration-150">Login</Link>
            <Link href="/signup" className="hover:text-white transition-colors duration-150">Register</Link>
          </div>
        </div>
      </footer>

    </div>
  );
}

/* ── Minimal Viewfinder Canvas (Rule-of-Thirds only) ─────────────── */
function ViewfinderCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = 260;
    canvas.height = 494;

    const w = canvas.width;
    const h = canvas.height;

    // Flat black background
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, w, h);

    // Rule-of-thirds grid — 1px solid white, low opacity
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.lineWidth = 1;

    [w / 3, (2 * w) / 3].forEach((x) => {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    });

    [h / 3, (2 * h) / 3].forEach((y) => {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    });

    // Center crosshair — minimal, 20px each arm
    const cx = w / 2;
    const cy = h / 2;
    const arm = 10;

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.lineWidth = 1;

    ctx.beginPath();
    ctx.moveTo(cx - arm, cy);
    ctx.lineTo(cx + arm, cy);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(cx, cy - arm);
    ctx.lineTo(cx, cy + arm);
    ctx.stroke();

    // Corner brackets (top-left, top-right, bottom-left, bottom-right)
    const bSize = 16;
    const margin = 20;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';

    // Top-left
    ctx.beginPath(); ctx.moveTo(margin, margin + bSize); ctx.lineTo(margin, margin); ctx.lineTo(margin + bSize, margin); ctx.stroke();
    // Top-right
    ctx.beginPath(); ctx.moveTo(w - margin - bSize, margin); ctx.lineTo(w - margin, margin); ctx.lineTo(w - margin, margin + bSize); ctx.stroke();
    // Bottom-left
    ctx.beginPath(); ctx.moveTo(margin, h - margin - bSize); ctx.lineTo(margin, h - margin); ctx.lineTo(margin + bSize, h - margin); ctx.stroke();
    // Bottom-right
    ctx.beginPath(); ctx.moveTo(w - margin - bSize, h - margin); ctx.lineTo(w - margin, h - margin); ctx.lineTo(w - margin, h - margin - bSize); ctx.stroke();

    // Top status pill
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    ctx.beginPath();
    ctx.roundRect(w / 2 - 52, 16, 104, 20, 10);
    ctx.fill();

    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.font = '8px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('TROCADÉRO · PARIS', w / 2, 30);
    ctx.textAlign = 'left';

  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-full object-cover"
      style={{ transform: 'translate3d(0,0,0)' }}
    />
  );
}

/* ── Spec List ───────────────────────────────────────────────────── */
const SPECS = [
  { icon: Globe, title: 'PostGIS Geofencing', desc: 'ST_DWithin proximity queries on every GPS coordinate update, anywhere on Earth.' },
  { icon: Shield, title: 'Row-Level Security', desc: 'All database access is auth-gated via Supabase RLS policies.' },
  { icon: Brain, title: 'Groq Dual Inference', desc: 'Llama-3.2 Vision for composition scoring and Llama-3.3 for copywriting.' },
  { icon: Camera, title: '2D Canvas HUD', desc: 'Hardware-accelerated overlays drawn directly on Canvas. Zero CSS filter overhead.' },
  { icon: BookImage, title: 'Scrapbook CRUD', desc: 'Save, edit, and delete captured shots. Persistent Supabase storage backend.' },
  { icon: Sparkles, title: 'PWA Ready', desc: 'Installs as a standalone app with Service Worker caching and offline support.' },
];
