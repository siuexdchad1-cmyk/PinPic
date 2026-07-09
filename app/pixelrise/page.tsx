'use client';

import Link from 'next/link';
import { 
  TrendingUp, ArrowUpRight, Sparkles, MoveRight, Layers, ArrowLeft
} from 'lucide-react';

export default function PixelRisePage() {

  return (
    <div className="w-screen h-screen bg-[#ececec] p-4 md:p-6 select-none overflow-hidden relative font-sans">
      
      {/* ── Outer Inset Border Frame ────────────────────────────────────────── */}
      <div className="w-full h-full border-2 border-black rounded-[2rem] bg-[#ececec] relative overflow-hidden flex flex-col justify-between p-8 md:p-12 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
        
        {/* Floating Background Brand Typography (Bleeding Wordmark) */}
        <div className="absolute right-0 bottom-8 md:bottom-16 text-[15vw] font-black tracking-tighter text-[#dfdfdf] uppercase pointer-events-none select-none z-0 leading-none font-mono">
          PIXEL RISE
        </div>

        {/* ── Top Bar Header Row ──────────────────────────────────────────────── */}
        <div className="w-full flex justify-between items-start z-10">
          {/* Left indicator and brand logo */}
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-mono text-zinc-500 tracking-widest uppercase">
              [1/8] PRESENTATION
            </span>
            <div className="flex items-center gap-2 mt-1">
              <Link href="/dashboard" className="flex items-center gap-1.5 border border-black bg-white px-2.5 py-1 text-[10px] font-mono font-bold uppercase hover:bg-zinc-50 transition active:scale-95">
                <ArrowLeft className="h-3 w-3" /> PinPic App
              </Link>
              <div className="h-5 w-px bg-zinc-400" />
              <span className="text-sm font-black tracking-tight uppercase text-black">
                Pixel Rise Studio
              </span>
            </div>
          </div>

          {/* Right Stat Callout Widget */}
          <div className="hidden sm:flex flex-col items-end text-right border-2 border-black bg-white p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] max-w-[220px]">
            <div className="flex items-center gap-1.5 text-orange-500 mb-1">
              <TrendingUp className="h-4.5 w-4.5 stroke-[2.5]" />
              <span className="text-sm font-mono font-black tracking-tight">132% GROWTH</span>
            </div>
            <p className="text-[9px] font-mono text-zinc-500 uppercase leading-normal tracking-wide">
              Average brand engagement increase after client collaboration.
            </p>
          </div>
        </div>

        {/* ── Center Hero Section Content ────────────────────────────────────── */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 items-center gap-8 z-10 py-6">
          
          {/* Left Block: Bold Staggered Headlines & CTAs */}
          <div className="lg:col-span-7 flex flex-col justify-center min-w-0">
            
            {/* Staggered Indented Typography */}
            <div className="flex flex-col gap-2">
              <h1 className="text-5xl md:text-7xl lg:text-[5.5rem] font-black tracking-tighter text-black uppercase leading-[0.8] select-all">
                BUILDING
              </h1>
              <h1 className="text-5xl md:text-7xl lg:text-[5.5rem] font-black tracking-tighter text-black uppercase leading-[0.8] pl-10 md:pl-20 select-all">
                DIGITAL
              </h1>
              <h1 className="text-5xl md:text-7xl lg:text-[5.5rem] font-black tracking-tighter text-orange-500 uppercase leading-[0.8] flex items-center gap-4 select-all">
                <span className="text-black text-3xl md:text-5xl select-none">•</span> EXPERIENCES
              </h1>
              <h1 className="text-5xl md:text-7xl lg:text-[5.5rem] font-black tracking-tighter text-black uppercase leading-[0.8] pl-6 md:pl-12 select-all">
                THAT STICK
              </h1>
            </div>

            {/* Supporting paragraph description */}
            <p className="text-zinc-600 text-sm md:text-base max-w-sm mt-8 leading-relaxed">
              We design playful brand systems, high-growth campaign assets, and premium digital products that command attention.
            </p>

            {/* Two Side-by-Side Rounded Pill CTA Buttons */}
            <div className="flex gap-3.5 mt-10">
              <button 
                className="px-7 py-3.5 bg-gradient-to-r from-orange-500 to-amber-500 text-white font-mono text-[10px] uppercase font-bold tracking-widest rounded-full border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 transition-all flex items-center gap-2 active:scale-95"
              >
                Get Started
                <ArrowUpRight className="h-3.5 w-3.5" />
              </button>
              
              <button className="px-7 py-3.5 bg-white text-black font-mono text-[10px] uppercase font-bold tracking-widest rounded-full border-2 border-black hover:bg-zinc-100 transition-colors flex items-center gap-2 active:scale-95">
                Contact Us
                <MoveRight className="h-3.5 w-3.5 text-zinc-500" />
              </button>
            </div>

          </div>

          {/* Right Block: Stylized Pre-rendered 3D Computer & Floating Props */}
          <div className="lg:col-span-5 relative w-full h-full flex items-center justify-center lg:justify-end z-10 min-h-[300px] lg:min-h-0">
            
            {/* Spline/Blender 3D Asset Swap Container */}
            <div className="relative w-72 md:w-96 lg:w-[480px] aspect-square flex items-center justify-center animate-float">
              
              {/* Preloaded Display/Heading image */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img 
                src="/pixelrise_hero_3d.png" 
                alt="Orange retro chunky computer 3D render with floating shapes" 
                className="w-full h-full object-contain drop-shadow-[0_20px_50px_rgba(0,0,0,0.15)]"
                loading="eager"
              />

              {/* 3D Asset Placement Annotation (For developer swap) */}
              <div className="absolute top-2 left-2 border border-dashed border-black/40 bg-white/70 px-2 py-1 text-[8px] font-mono text-zinc-600 uppercase">
                ★ 3D ASSET SWAP PLACEHOLDER (Spline / pre-rendered WebP)
              </div>

              {/* Floating micro indicators (Brutalist style widgets) */}
              <div className="absolute top-1/4 right-0 border-2 border-black bg-white p-2 text-[8px] font-mono uppercase font-bold shadow-[2px_2px_0px_rgba(0,0,0,1)] rotate-6">
                ⚡ RETRO 3D
              </div>

              <div className="absolute bottom-1/4 left-0 border-2 border-black bg-orange-400 p-2 text-[8px] font-mono uppercase font-bold text-black shadow-[2px_2px_0px_rgba(0,0,0,1)] -rotate-6">
                ★ Mid-fall props
              </div>
            </div>

          </div>
        </div>

        {/* ── Bottom Navigation and Details ────────────────────────────────────── */}
        <div className="w-full flex justify-between items-end border-t border-black/10 pt-6 z-10">
          
          {/* Secondary supporting copy */}
          <div className="flex items-center gap-3">
            <Layers className="h-4.5 w-4.5 text-zinc-700 stroke-[2.5]" />
            <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500">
              BRUTALIST PREMIUM DESIGN SYSTEM v1.0
            </span>
          </div>

          {/* Social circular icon buttons vertical stack representation */}
          <div className="flex items-center gap-2">
            <button className="h-9 w-9 border-2 border-black bg-white rounded-full flex items-center justify-center hover:bg-zinc-50 transition active:scale-90" title="Instagram profile">
              <svg className="h-4 w-4 text-black" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect width="20" height="20" x="2" y="2" rx="5" ry="5"/>
                <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/>
                <line x1="17.5" x2="17.51" y1="6.5" y2="6.5"/>
              </svg>
            </button>
            <button className="h-9 w-9 border-2 border-black bg-white rounded-full flex items-center justify-center hover:bg-zinc-50 transition active:scale-90" title="Facebook community">
              <svg className="h-4 w-4 text-black" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/>
              </svg>
            </button>
            <button className="h-9 w-9 border-2 border-black bg-white rounded-full flex items-center justify-center hover:bg-zinc-50 transition active:scale-90" title="X profile">
              <svg className="h-4 w-4 text-black" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 4s-.7 2.1-2 3.4c1.6 10-9.4 17.3-18 11.6 2.2.1 4.4-.6 6-2C3 15.5.5 9.6 3 5c2.2 2.6 5.6 4.1 9 4-.9-4.2 4-6.6 7-3.8 1.1 0 3-1.2 3-1.2z"/>
              </svg>
            </button>
          </div>
        </div>

        {/* Bottom Center Scroll to Explore indicator pill */}
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 border-2 border-b-0 border-black bg-white px-4 py-1.5 rounded-t-xl text-[9px] font-mono uppercase font-bold tracking-widest flex items-center gap-1.5 shadow-[2px_-2px_0px_0px_rgba(0,0,0,1)] select-none">
          <Sparkles className="h-3 w-3 text-orange-500 animate-spin-slow" />
          <span>Scroll to explore</span>
        </div>

      </div>

      {/* Floating dynamic custom animations stylesheet */}
      <style jsx global>{`
        @keyframes float {
          0% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-8px) rotate(0.5deg); }
          100% { transform: translateY(0px) rotate(0deg); }
        }
        .animate-float {
          animation: float 5s ease-in-out infinite;
        }
        .animate-spin-slow {
          animation: spin 8s linear infinite;
        }
      `}</style>

    </div>
  );
}
