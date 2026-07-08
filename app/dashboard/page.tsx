'use client';

import { useEffect, useState } from 'react';
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { TrendingUp, Target, MapPin, Camera, Sparkles, BookImage } from 'lucide-react';
import Link from 'next/link';
import { formatDate } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import NavBar from '@/components/shared/NavBar';
import type { SavedShot, AccuracyDataPoint, HotspotEngagementPoint } from '@/lib/types';

interface KPIs {
  totalShots:       number;
  avgAccuracy:      number;
  hotspotsVisited:  number;
}

export default function DashboardPage() {
  const supabase = createClient();

  const [kpis,       setKpis]       = useState<KPIs | null>(null);
  const [areaData,   setAreaData]   = useState<AccuracyDataPoint[]>([]);
  const [barData,    setBarData]    = useState<HotspotEngagementPoint[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [username,   setUsername]   = useState('');

  useEffect(() => {
    async function loadDashboard() {
      // Get authenticated user metadata
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUsername(user.user_metadata?.username ?? user.email?.split('@')[0] ?? 'Traveler');
      }

      // Fetch saved shots with hotspot titles join
      const { data: shots, error } = await supabase
        .from('saved_shots')
        .select('*, hotspots(title)')
        .order('created_at', { ascending: true });

      if (error || !shots) {
        setLoading(false);
        return;
      }

      const typedShots = shots as (SavedShot & { hotspots: { title: string } | null })[];

      // ── Mapped metrics computations ───────────────────────────────────────
      const totalShots = typedShots.length;
      const withAccuracy = typedShots.filter((s) => s.match_accuracy !== null);
      const avgAccuracy = withAccuracy.length > 0
        ? Math.round(withAccuracy.reduce((sum, s) => sum + (s.match_accuracy ?? 0), 0) / withAccuracy.length)
        : 0;
      const hotspotsVisited = new Set(typedShots.map((s) => s.hotspot_id).filter(Boolean)).size;

      setKpis({ totalShots, avgAccuracy, hotspotsVisited });

      // ── Evolution chart format mappings ────────────────────────────────────
      const area: AccuracyDataPoint[] = typedShots
        .filter((s) => s.match_accuracy !== null)
        .map((s) => ({
          date:     formatDate(s.created_at),
          accuracy: s.match_accuracy ?? 0,
        }));
      setAreaData(area);

      // ── Hotspot engagement comparisons ────────────────────────────────────
      const countMap: Record<string, number> = {};
      typedShots.forEach((s) => {
        const title = s.hotspots?.title ?? 'Unknown Spot';
        countMap[title] = (countMap[title] ?? 0) + 1;
      });
      const bar: HotspotEngagementPoint[] = Object.entries(countMap)
        .map(([title, count]) => ({ title, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5); // top 5 for mobile scanning bounds
      setBarData(bar);

      setLoading(false);
    }

    loadDashboard();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const chartTooltipStyle = {
    contentStyle: {
      background: '#09090b',
      border: '1px solid #27272a',
      borderRadius: '6px',
      fontSize: '11px',
      color: '#fff',
      fontFamily: 'monospace',
    },
    labelStyle: { color: '#71717a' },
  };

  return (
    <div className="min-h-screen bg-[#000000] text-white page-enter relative overflow-x-hidden">
      <NavBar />

      <main className="mx-auto max-w-5xl px-4 py-8 relative z-10" style={{ contain: 'layout paint' }}>

        {/* ── Telemetry Banner Headline ────────────────────────────────────── */}
        <div className="mb-8 border border-zinc-900 bg-zinc-950/60 rounded-2xl p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex flex-col gap-1">
            <span className="text-[10px] text-emerald-500 font-mono tracking-widest uppercase">{"// TRAVELER TERMINAL"}</span>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight text-white">
                {loading ? 'loading_identity' : username}
              </h1>
              <span className="inline-flex items-center gap-1 text-[10px] font-mono border border-emerald-500/20 bg-emerald-950/30 text-emerald-400 px-2 py-0.5 rounded">
                <Sparkles className="h-3 w-3" /> PRO_MEMBER
              </span>
            </div>
            <p className="text-xs text-zinc-500 font-mono mt-1">UUID // {loading ? '••••' : 'ACTIVE_SESSION_OK'}</p>
          </div>
          <Link href="/camera" className="w-full sm:w-auto">
            <Button className="w-full sm:w-auto bg-emerald-500 text-black hover:bg-emerald-400 hover:shadow-[0_0_15px_rgba(16,185,129,0.3)] transition-all flex items-center gap-2">
              <Camera className="h-4 w-4" /> Initialize Camera
            </Button>
          </Link>
        </div>

        {/* ── KPI Grid with Countups and SVG Gauges ──────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          {loading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="bg-zinc-950 border border-zinc-900 rounded-xl p-6 h-32">
                <Skeleton className="h-4 w-24 mb-3" />
                <Skeleton className="h-8 w-16" />
              </div>
            ))
          ) : (
            <>
              {/* Card 1: Total Captured Shots (Countup) */}
              <div className="bg-zinc-950 border border-zinc-900 rounded-xl p-6 transition-all duration-300 hover:border-zinc-800 flex flex-col justify-between h-36">
                <div className="flex items-center gap-2 text-zinc-500">
                  <Camera className="h-4 w-4" />
                  <span className="text-[10px] font-mono uppercase tracking-wider">Total Captured Shots</span>
                </div>
                <div className="flex items-baseline gap-1 mt-4">
                  <span className="text-4xl font-bold font-mono tracking-tight text-white">
                    <CountUpNumber target={kpis?.totalShots ?? 0} />
                  </span>
                  <span className="text-xs text-zinc-600 font-mono">shots</span>
                </div>
              </div>

              {/* Card 2: Average Composition Score (SVG Progress Gauge) */}
              <div className="bg-zinc-950 border border-zinc-900 rounded-xl p-6 transition-all duration-300 hover:border-zinc-800 flex items-center justify-between h-36">
                <div className="flex flex-col justify-between h-full">
                  <div className="flex items-center gap-2 text-zinc-500">
                    <Target className="h-4 w-4 animate-pulse" />
                    <span className="text-[10px] font-mono uppercase tracking-wider">Avg Composition Score</span>
                  </div>
                  <div className="flex items-baseline gap-1 mt-4">
                    <span className="text-4xl font-bold font-mono tracking-tight text-emerald-400">
                      {kpis?.avgAccuracy ?? 0}
                    </span>
                    <span className="text-xs text-zinc-600 font-mono">%</span>
                  </div>
                </div>
                <div className="relative w-16 h-16 shrink-0">
                  <RadialProgress score={kpis?.avgAccuracy ?? 0} />
                </div>
              </div>

              {/* Card 3: Hotspots Mapped */}
              <div className="bg-zinc-950 border border-zinc-900 rounded-xl p-6 transition-all duration-300 hover:border-zinc-800 flex flex-col justify-between h-36">
                <div className="flex items-center gap-2 text-zinc-500">
                  <MapPin className="h-4 w-4" />
                  <span className="text-[10px] font-mono uppercase tracking-wider">Locations Mapped</span>
                </div>
                <div className="flex items-baseline gap-1 mt-4">
                  <span className="text-4xl font-bold font-mono tracking-tight text-white">
                    <CountUpNumber target={kpis?.hotspotsVisited ?? 0} />
                  </span>
                  <span className="text-xs text-zinc-600 font-mono">hotspots</span>
                </div>
              </div>
            </>
          )}
        </div>

        {/* ── Data Telemetry Charts (glowing trace lines + borders) ──────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

          {/* AreaChart - Performance Evolution */}
          <div className="bg-zinc-950 border border-zinc-900 rounded-xl p-6">
            <div className="mb-6 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-emerald-500 animate-pulse" />
                <h2 className="text-sm font-semibold tracking-tight uppercase font-mono">Evolution History</h2>
              </div>
              <span className="text-[10px] text-zinc-500 font-mono">{"// ACCURATE_TRACE_CONNECTED"}</span>
            </div>
            {loading ? (
              <Skeleton className="h-48 w-full" />
            ) : areaData.length === 0 ? (
              <EmptyTelemetry message="No performance history recorded. Capture shots to plot scores." />
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={areaData} margin={{ top: 5, right: 5, bottom: 5, left: -25 }}>
                  <defs>
                    <linearGradient id="accuracyGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#10b981" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#000000" stopOpacity={0.0}  />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#18181b" />
                  <XAxis dataKey="date" tick={{ fill: '#52525b', fontSize: 9, fontFamily: 'monospace' }} tickLine={false} />
                  <YAxis domain={[0, 100]} tick={{ fill: '#52525b', fontSize: 9, fontFamily: 'monospace' }} tickLine={false} />
                  <Tooltip {...chartTooltipStyle} formatter={(v) => [`${v}%`, 'Accuracy']} />
                  <Area
                    type="monotone"
                    dataKey="accuracy"
                    stroke="#10b981"
                    strokeWidth={1.5}
                    fill="url(#accuracyGradient)"
                    dot={{ fill: '#10b981', r: 2 }}
                    activeDot={{ r: 4, stroke: '#000000', strokeWidth: 1.5 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* BarChart - Proximity engagement */}
          <div className="bg-zinc-950 border border-zinc-900 rounded-xl p-6">
            <div className="mb-6 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-emerald-500" />
                <h2 className="text-sm font-semibold tracking-tight uppercase font-mono">Location Metrics</h2>
              </div>
              <span className="text-[10px] text-zinc-500 font-mono">{"// ENGAGEMENT_BREAKDOWN"}</span>
            </div>
            {loading ? (
              <Skeleton className="h-48 w-full" />
            ) : barData.length === 0 ? (
              <EmptyTelemetry message="No engagement metrics found. Lock onto travel hotspots to generate telemetry." />
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={barData} margin={{ top: 5, right: 5, bottom: 5, left: -25 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#18181b" vertical={false} />
                  <XAxis dataKey="title" tick={{ fill: '#52525b', fontSize: 8, fontFamily: 'monospace' }} tickLine={false} />
                  <YAxis tick={{ fill: '#52525b', fontSize: 9, fontFamily: 'monospace' }} tickLine={false} />
                  <Tooltip {...chartTooltipStyle} formatter={(v) => [v, 'Captures']} />
                  <Bar 
                    dataKey="count" 
                    fill="#10b981" 
                    radius={[4, 4, 0, 0]} 
                    maxBarSize={40}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

        </div>

        {/* ── Navigation entries ─────────────────────────────────────────── */}
        <div className="mt-8 flex flex-col sm:flex-row gap-4">
          <Link href="/camera" className="flex-1">
            <Button className="w-full h-12 bg-emerald-500 text-black hover:bg-emerald-400 hover:shadow-[0_0_20px_rgba(16,185,129,0.3)] transition-all font-semibold" size="lg">
              <Camera className="h-4 w-4 mr-2" /> Open HUD Camera
            </Button>
          </Link>
          <Link href="/scrapbook" className="flex-1">
            <Button variant="outline" className="w-full h-12 border-zinc-900 hover:border-zinc-800 hover:bg-zinc-950 font-semibold" size="lg">
              <BookImage className="h-4 w-4 mr-2" /> Open Travel Scrapbook
            </Button>
          </Link>
        </div>

      </main>
    </div>
  );
}

// ── Lightweight Pure React CountUp Animation ──────────────────────────────────
function CountUpNumber({ target }: { target: number }) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (target === 0) return;
    let start = 0;
    const duration = 1000; // ms
    const increment = Math.ceil(target / (duration / 16)); // ~60fps ticks
    
    const timer = setInterval(() => {
      start += increment;
      if (start >= target) {
        setCount(target);
        clearInterval(timer);
      } else {
        setCount(start);
      }
    }, 16);

    return () => clearInterval(timer);
  }, [target]);

  return <>{count}</>;
}

// ── Lightweight Radial Micro-Gauge Component ───────────────────────────────
function RadialProgress({ score }: { score: number }) {
  const radius = 24;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (score / 100) * circumference;

  return (
    <svg className="w-full h-full transform -rotate-90">
      {/* Background circle */}
      <circle
        cx="32"
        cy="32"
        r={radius}
        className="stroke-zinc-900"
        strokeWidth="4"
        fill="transparent"
      />
      {/* Active progress path */}
      <circle
        cx="32"
        cy="32"
        r={radius}
        className="stroke-emerald-500 transition-all duration-1000 ease-out"
        strokeWidth="4"
        fill="transparent"
        strokeDasharray={circumference}
        strokeDashoffset={strokeDashoffset}
        strokeLinecap="round"
      />
    </svg>
  );
}

// ── Empty Telemetry State Placeholder ───────────────────────────────────────
function EmptyTelemetry({ message }: { message: string }) {
  return (
    <div className="flex h-48 items-center justify-center border border-dashed border-zinc-900 rounded-xl">
      <p className="text-xs text-zinc-600 text-center px-6 leading-relaxed max-w-xs">{message}</p>
    </div>
  );
}
