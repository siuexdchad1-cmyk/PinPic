'use client';

import Link from 'next/link';
import { Camera, Compass, Sparkles, ArrowRight, BookImage } from 'lucide-react';
import SplitText from '@/components/ui/SplitText';
import TextPressure from '@/components/ui/TextPressure';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-black text-white overflow-x-hidden font-sans selection:bg-emerald-500 selection:text-black">

      {/* ── Floating Luxury Header ────────────────────────────────────────────── */}
      <header className="fixed top-0 left-0 right-0 z-50 border-b border-white/10 bg-black/50 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          
          {/* Brand Logo */}
          <Link href="/" className="flex items-center gap-2.5">
            <span className="text-emerald-400 font-bold text-lg font-mono">✳</span>
            <SplitText
              text="PinPic"
              className="text-base font-bold tracking-tight font-mono text-white"
              delay={60}
              duration={0.6}
              splitType="chars"
              from={{ opacity: 0, y: -10 }}
              to={{ opacity: 1, y: 0 }}
            />
          </Link>

          {/* Navigation Links */}
          <div className="hidden md:flex items-center gap-8 font-mono text-xs uppercase tracking-widest">
            <a href="#features" className="text-zinc-300 hover:text-white transition-colors">
              Features
            </a>
            <Link href="/explore" className="text-zinc-300 hover:text-white transition-colors">
              Map
            </Link>
            <Link href="/camera" className="text-zinc-300 hover:text-white transition-colors">
              Camera
            </Link>
            <Link href="/scrapbook" className="text-zinc-300 hover:text-white transition-colors">
              Scrapbook
            </Link>
          </div>

          {/* Right Action Button */}
          <div className="flex items-center gap-4">
            <Link
              href="/login"
              className="hidden sm:inline text-xs font-mono text-zinc-300 hover:text-white transition-colors tracking-wide"
            >
              Sign in
            </Link>
            <Link href="/camera">
              <button className="bg-white/10 hover:bg-white/20 border border-white/20 text-white font-mono font-bold text-xs px-4 py-2 rounded-full backdrop-blur-md transition-all active:scale-95">
                Explore
              </button>
            </Link>
          </div>
        </div>
      </header>

      {/* ── Cinematic Panoramic Hero ────────────────────────────────────────── */}
      <section className="relative w-full h-screen min-h-[650px] flex flex-col justify-between items-center text-center overflow-hidden">
        
        {/* Background Panoramic Image */}
        <div className="absolute inset-0 z-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="https://images.unsplash.com/photo-1506744038136-46273834b3fb?q=80&w=2070&auto=format&fit=crop"
            alt="Panoramic Mountain Landscape"
            className="w-full h-full object-cover object-center scale-105 animate-pulse-slow"
          />
          {/* Dark Overlay Gradient */}
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-black/30" />
        </div>

        {/* Hero Central Typography (Vita Travels Style + TextPressure) */}
        <div className="relative z-10 mx-auto max-w-4xl px-6 pt-32 sm:pt-40 flex flex-col items-center w-full">
          
          <div className="w-full h-36 sm:h-48 md:h-56 relative flex items-center justify-center">
            <TextPressure
              text="TRAVEL"
              flex={true}
              alpha={false}
              stroke={false}
              width={true}
              weight={true}
              italic={true}
              textColor="#ffffff"
              minFontSize={64}
            />
          </div>

          <p className="mt-2 sm:mt-4 text-sm sm:text-xl font-mono text-zinc-200 font-medium max-w-xl leading-relaxed drop-shadow-md">
            With purpose. AI &amp; GPS guided photography. Discover hotspots, align framing, and save memories in one place.
          </p>

          {/* Central Pill Action Button */}
          <div className="mt-8 sm:mt-10">
            <Link href="/explore">
              <button className="bg-white text-black font-mono font-bold text-xs uppercase tracking-widest px-8 py-3.5 rounded-full shadow-2xl hover:bg-zinc-200 transition-all duration-200 active:scale-95 flex items-center gap-2.5 border border-white">
                Explore Hotspots
                <span className="text-emerald-600">✳</span>
              </button>
            </Link>
          </div>
        </div>

        {/* Bottom Banner Bar */}
        <div className="relative z-10 w-full border-t border-white/10 bg-black/40 backdrop-blur-md py-4 px-6">
          <div className="mx-auto max-w-6xl flex flex-col sm:flex-row items-center justify-between gap-3 text-[10px] font-mono text-zinc-400 uppercase tracking-widest">
            <div className="flex items-center gap-2">
              <Sparkles className="h-3.5 w-3.5 text-emerald-400" />
              <span>PINPIC — AI &amp; GPS GUIDED PHOTOGRAPHY PWA</span>
            </div>
            <div className="flex items-center gap-6">
              <span>MAJOR DIPLOMA PROJECT BY ARYA HEMANT TARE</span>
              <span className="hidden md:inline text-emerald-400">● GPS LOCKED</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── Feature Cards Section ───────────────────────────────────────────── */}
      <section id="features" className="py-24 bg-zinc-950 border-t border-zinc-900 scroll-mt-16">
        <div className="mx-auto max-w-6xl px-6">
          
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-16">
            <div>
              <span className="text-[10px] font-mono text-emerald-400 font-bold uppercase tracking-widest block mb-2">
                ● SYSTEM CAPABILITIES
              </span>
              <h2 className="text-3xl sm:text-5xl font-black font-mono uppercase text-white tracking-tight">
                Designed for Travelers
              </h2>
            </div>
            <p className="text-xs font-mono text-zinc-400 max-w-xs leading-relaxed">
              Step into any photography hotspot, align composition stencils, and capture stunning travel photos.
            </p>
          </div>

          {/* 3-Column Feature Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            <div className="border border-zinc-800 bg-zinc-900/60 p-8 rounded-2xl flex flex-col justify-between hover:border-emerald-500/50 transition-colors group">
              <div>
                <div className="h-10 w-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mb-6">
                  <Compass className="h-5 w-5" />
                </div>
                <h3 className="text-lg font-bold font-mono text-white uppercase mb-2">GPS Proximity Hotspots</h3>
                <p className="text-xs text-zinc-400 leading-relaxed font-mono">
                  Detects real-world monuments, viewpoints, and scenic spots within 1–2 km automatically using OpenStreetMap.
                </p>
              </div>
              <div className="mt-8 pt-4 border-t border-zinc-800 flex items-center justify-between text-[9px] font-mono text-zinc-500 uppercase">
                <span>±5m Precision</span>
                <ArrowRight className="h-3.5 w-3.5 group-hover:text-emerald-400 transition-colors" />
              </div>
            </div>

            <div className="border border-zinc-800 bg-zinc-900/60 p-8 rounded-2xl flex flex-col justify-between hover:border-emerald-500/50 transition-colors group">
              <div>
                <div className="h-10 w-10 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400 mb-6">
                  <Camera className="h-5 w-5" />
                </div>
                <h3 className="text-lg font-bold font-mono text-white uppercase mb-2">Groq AI Vision Scan</h3>
                <p className="text-xs text-zinc-400 leading-relaxed font-mono">
                  Captures photos and analyzes composition quality, subject lighting, social media captions, and trending hashtags.
                </p>
              </div>
              <div className="mt-8 pt-4 border-t border-zinc-800 flex items-center justify-between text-[9px] font-mono text-zinc-500 uppercase">
                <span>Llama 4 Vision</span>
                <ArrowRight className="h-3.5 w-3.5 group-hover:text-indigo-400 transition-colors" />
              </div>
            </div>

            <div className="border border-zinc-800 bg-zinc-900/60 p-8 rounded-2xl flex flex-col justify-between hover:border-emerald-500/50 transition-colors group">
              <div>
                <div className="h-10 w-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 mb-6">
                  <BookImage className="h-5 w-5" />
                </div>
                <h3 className="text-lg font-bold font-mono text-white uppercase mb-2">Digital Scrapbook</h3>
                <p className="text-xs text-zinc-400 leading-relaxed font-mono">
                  Save all your travel shots with AI scorecards, location tags, and categories stored safely in local memory.
                </p>
              </div>
              <div className="mt-8 pt-4 border-t border-zinc-800 flex items-center justify-between text-[9px] font-mono text-zinc-500 uppercase">
                <span>LocalStorage CRUD</span>
                <ArrowRight className="h-3.5 w-3.5 group-hover:text-amber-400 transition-colors" />
              </div>
            </div>

          </div>

        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────────────────────── */}
      <footer className="border-t border-zinc-900 bg-black py-10">
        <div className="mx-auto max-w-6xl px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="text-emerald-400 font-mono font-bold">✳</span>
            <span className="text-xs font-mono font-bold tracking-wider text-white">PINPIC</span>
          </div>
          <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">
            PinPic &copy; {new Date().getFullYear()} · Major Diploma Project by Arya Hemant Tare
          </p>
          <div className="flex items-center gap-4 text-[10px] font-mono text-zinc-400">
            <Link href="/explore" className="hover:text-white transition-colors">Map</Link>
            <Link href="/camera" className="hover:text-white transition-colors">Camera</Link>
            <Link href="/scrapbook" className="hover:text-white transition-colors">Scrapbook</Link>
            <Link href="/account" className="hover:text-white transition-colors">Account</Link>
          </div>
        </div>
      </footer>

    </div>
  );
}
