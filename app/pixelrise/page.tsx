'use client';

import Link from 'next/link';
import Image from 'next/image';
import { 
  TrendingUp, ArrowUpRight, Sparkles, MoveRight, Layers, ArrowLeft
} from 'lucide-react';
import { Syne, Inter } from 'next/font/google';

// ── Performance-Optimized Self-Hosted Fonts (WOFF2, Auto-Preloaded, display: swap) ──
const syne = Syne({
  subsets: ['latin'],
  display: 'swap',
  weight: ['800'],
  variable: '--font-syne',
});

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  weight: ['400', '700'],
  variable: '--font-inter',
});

export default function PixelRisePage() {
  return (
    <div className={`w-screen h-screen bg-[#ececec] p-4 md:p-6 select-none overflow-hidden relative ${inter.className} ${syne.variable}`}>
      
      {/* ── Outer Inset Border Frame (Layout Stability) ────────────────────────── */}
      <div className="w-full h-full border-2 border-black rounded-[2rem] bg-[#ececec] relative overflow-hidden flex flex-col justify-between p-8 md:p-12 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
        
        {/* 
          Floating Background Brand Typography (Zero Font Request Optimization)
          We render 'PIXEL RISE' as an inline SVG wordmark to avoid loading an extra 
          blocky font file, achieving 0ms layout shift and eliminating FOUT.
        */}
        <div className="absolute right-0 bottom-4 md:bottom-12 w-[85vw] max-w-[1200px] aspect-[8/2] pointer-events-none select-none z-0 opacity-[0.08]">
          <svg viewBox="0 0 800 200" className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
            <text 
              x="50%" 
              y="70%" 
              textAnchor="middle" 
              fontSize="120" 
              fontWeight="900" 
              fontFamily="monospace"
              fill="none" 
              stroke="black" 
              strokeWidth="4"
              letterSpacing="-2"
            >
              PIXEL RISE
            </text>
          </svg>
        </div>

        {/* ── Top Bar Header Row ──────────────────────────────────────────────── */}
        <div className="w-full flex justify-between items-start z-10">
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-mono text-zinc-500 tracking-widest uppercase">
              [1/8] PRESENTATION
            </span>
            <div className="flex items-center gap-2 mt-1">
              <Link 
                href="/dashboard" 
                className="flex items-center gap-1.5 border border-black bg-white px-2.5 py-1 text-[10px] font-mono font-bold uppercase hover:bg-zinc-50 transition-transform active:scale-95 duration-100"
              >
                <ArrowLeft className="h-3 w-3" /> PinPic App
              </Link>
              <div className="h-5 w-px bg-zinc-400" />
              <span className="text-sm font-black tracking-tight uppercase text-black font-mono">
                Pixel Rise
              </span>
            </div>
          </div>

          {/* Right Stat Callout Widget (CLS Protected Space) */}
          <div className="hidden sm:flex flex-col items-end text-right border-2 border-black bg-white p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] w-[220px] h-[82px] shrink-0">
            <div className="flex items-center gap-1.5 text-orange-500 mb-0.5">
              <TrendingUp className="h-4 w-4 stroke-[2.5]" />
              <span className="text-xs font-mono font-black tracking-tight">132% GROWTH</span>
            </div>
            <p className="text-[8px] font-mono text-zinc-500 uppercase leading-normal tracking-wide">
              Average brand engagement increase after collaboration.
            </p>
          </div>
        </div>

        {/* ── Center Hero Section Content ────────────────────────────────────── */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 items-center gap-8 z-10 py-4">
          
          {/* Left Block: Bold Staggered Headlines & CTAs */}
          <div className="lg:col-span-7 flex flex-col justify-center min-w-0">
            
            {/* Staggered Indented Typography using local Syne font variable */}
            <div className="flex flex-col gap-1.5 font-sans font-extrabold" style={{ fontFamily: 'var(--font-syne), sans-serif' }}>
              <h1 className="text-5xl md:text-6xl lg:text-[5.5rem] font-black tracking-tighter text-black uppercase leading-[0.8] select-all">
                BUILDING
              </h1>
              <h1 className="text-5xl md:text-6xl lg:text-[5.5rem] font-black tracking-tighter text-black uppercase leading-[0.8] pl-8 md:pl-20 select-all">
                DIGITAL
              </h1>
              <h1 className="text-5xl md:text-6xl lg:text-[5.5rem] font-black tracking-tighter text-orange-500 uppercase leading-[0.8] flex items-center gap-3 select-all">
                <span className="text-black text-2xl md:text-4xl select-none">•</span> EXPERIENCES
              </h1>
              <h1 className="text-5xl md:text-6xl lg:text-[5.5rem] font-black tracking-tighter text-black uppercase leading-[0.8] pl-4 md:pl-12 select-all">
                THAT STICK
              </h1>
            </div>

            {/* Supporting paragraph description */}
            <p className="text-zinc-600 text-sm md:text-base max-w-sm mt-6 leading-relaxed">
              We design playful brand systems, high-growth campaign assets, and premium digital products that command attention.
            </p>

            {/* Two Side-by-Side Rounded Pill CTA Buttons (GPU-Accelerated Transitions) */}
            <div className="flex gap-3.5 mt-8">
              <button 
                className="px-6 py-3 bg-gradient-to-r from-orange-500 to-amber-500 text-white font-mono text-[9px] uppercase font-bold tracking-widest rounded-full border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 transition-all duration-100 flex items-center gap-2 active:scale-95"
              >
                Get Started
                <ArrowUpRight className="h-3.5 w-3.5" />
              </button>
              
              <button className="px-6 py-3 bg-white text-black font-mono text-[9px] uppercase font-bold tracking-widest rounded-full border-2 border-black hover:bg-zinc-100 transition-colors duration-100 flex items-center gap-2 active:scale-95">
                Contact Us
                <MoveRight className="h-3.5 w-3.5 text-zinc-500" />
              </button>
            </div>

          </div>

          {/* Right Block: Aspect-Ratio Protected 3D Hero image container */}
          <div className="lg:col-span-5 relative w-full h-full flex items-center justify-center lg:justify-end z-10 min-h-[280px] lg:min-h-0">
            
            {/* 
              CLS Shield: A fixed container reserving exact layout space.
              Prevents surrounding text reflows when the image asset completes loading.
            */}
            <div className="relative w-64 md:w-80 lg:w-[460px] aspect-square flex items-center justify-center animate-float">
              
              {/* 
                Next.js Image Component Optimization:
                - served statically at 550x550 exact width/height.
                - 'priority' attribute ensures this is loaded in the critical render path.
                - browser decodes WebP format instantly with zero layout shifts.
              */}
              <Image 
                src="/pixelrise_hero_3d.png" 
                alt="Orange retro chunky computer 3D render with floating shapes" 
                width={550}
                height={550}
                className="w-full h-full object-contain drop-shadow-[0_15px_35px_rgba(0,0,0,0.1)]"
                priority
              />

              {/* 3D Asset Swap Annotation */}
              <div className="absolute top-2 left-2 border border-dashed border-black/35 bg-white/80 px-2 py-1 text-[8px] font-mono text-zinc-500 uppercase select-none">
                ★ 3D PRE-RENDERED WEB DIRECTIVE (Priority Loaded)
              </div>

              {/* Floating micro indicators (Transform transitions only to prevent layout redraw) */}
              <div className="absolute top-[20%] right-0 border-2 border-black bg-white px-2 py-1 text-[8px] font-mono uppercase font-bold shadow-[2px_2px_0px_rgba(0,0,0,1)] rotate-6">
                ⚡ RETRO 3D
              </div>

              <div className="absolute bottom-[20%] left-0 border-2 border-black bg-orange-400 px-2 py-1 text-[8px] font-mono uppercase font-bold text-black shadow-[2px_2px_0px_rgba(0,0,0,1)] -rotate-6">
                ★ Mid-fall props
              </div>
            </div>

          </div>
        </div>

        {/* ── Bottom Navigation and Details ────────────────────────────────────── */}
        <div className="w-full flex justify-between items-end border-t border-black/10 pt-6 z-10">
          
          <div className="flex items-center gap-3">
            <Layers className="h-4 w-4 text-zinc-700 stroke-[2.5]" />
            <span className="text-[9px] font-mono uppercase tracking-wider text-zinc-500">
              BRUTALIST PERFORMANCE SYSTEM v1.2
            </span>
          </div>

          {/* Social circular icon buttons (Direct Inline SVGs, zero HTTP font queries) */}
          <div className="flex items-center gap-2">
            <button className="h-9 w-9 border-2 border-black bg-white rounded-full flex items-center justify-center hover:bg-zinc-50 transition-transform active:scale-90 duration-100" title="Instagram profile">
              <svg className="h-4 w-4 text-black" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect width="20" height="20" x="2" y="2" rx="5" ry="5"/>
                <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/>
                <line x1="17.5" x2="17.51" y1="6.5" y2="6.5"/>
              </svg>
            </button>
            <button className="h-9 w-9 border-2 border-black bg-white rounded-full flex items-center justify-center hover:bg-zinc-50 transition-transform active:scale-90 duration-100" title="Facebook community">
              <svg className="h-4 w-4 text-black" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/>
              </svg>
            </button>
            <button className="h-9 w-9 border-2 border-black bg-white rounded-full flex items-center justify-center hover:bg-zinc-50 transition-transform active:scale-90 duration-100" title="X profile">
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

      {/* Floating dynamic custom animations (GPU Accelerated transform animations) */}
      <style jsx global>{`
        @keyframes float {
          0% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-6px) rotate(0.3deg); }
          100% { transform: translateY(0px) rotate(0deg); }
        }
        .animate-float {
          animation: float 4.5s ease-in-out infinite;
          will-change: transform;
        }
        @keyframes spin-slow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .animate-spin-slow {
          animation: spin-slow 10s linear infinite;
          will-change: transform;
        }
      `}</style>

    </div>
  );
}
