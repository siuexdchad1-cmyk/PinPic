'use client';

import { useEffect, useState, useCallback } from 'react';
import { Camera, Trash2, BookImage, Filter, SortAsc, Star, MapPin } from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';
import NavBar from '@/components/shared/NavBar';
import Footer from '@/components/shared/Footer';

// ── Types ──────────────────────────────────────────────────────────────────────
interface LocalEntry {
  id:        string;
  imageData: string;
  hotspot:   string;
  category:  string;
  score:     string;
  tip:       string;
  savedAt:   string;
}

// ── Category Config ────────────────────────────────────────────────────────────
const CATEGORY_LABELS: Record<string, { label: string; color: string }> = {
  'Golden Hour Viewpoint': { label: '🌅 Golden Hour',  color: '#f59e0b' },
  'Portrait Spot':         { label: '🧍 Portrait',     color: '#10b981' },
  'Architecture Angle':   { label: '🏛️ Architecture', color: '#6366f1' },
  'Nature Shot':           { label: '🌿 Nature',       color: '#22c55e' },
};

function getCategoryStyle(cat: string) {
  return CATEGORY_LABELS[cat] ?? { label: cat || 'General', color: '#71717a' };
}

// ── LocalStorage helpers ───────────────────────────────────────────────────────
function loadLocal(): LocalEntry[] {
  try { return JSON.parse(localStorage.getItem('pinpic_scrapbook') ?? '[]'); }
  catch { return []; }
}

function deleteLocal(id: string): LocalEntry[] {
  const next = loadLocal().filter(e => e.id !== id);
  localStorage.setItem('pinpic_scrapbook', JSON.stringify(next));
  return next;
}

// ══════════════════════════════════════════════════════════════════════════════
export default function ScrapbookPage() {
  const [entries,    setEntries]    = useState<LocalEntry[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [filter,     setFilter]     = useState<string>('all');
  const [sortBy,     setSortBy]     = useState<'date' | 'score'>('date');

  // Load entries — LocalStorage first, then Supabase as bonus
  useEffect(() => {
    const local = loadLocal();
    setEntries(local);
    setLoading(false);

    // Also try to merge in Supabase entries (non-blocking)
    // We keep LocalStorage as the single source of truth for this diploma project
  }, []);

  // ── Delete handler ──────────────────────────────────────────────────────────
  const handleDelete = useCallback((id: string) => {
    const updated = deleteLocal(id);
    setEntries(updated);
    toast.success('Entry removed from scrapbook.');
  }, []);

  // ── Filtered & sorted entries ───────────────────────────────────────────────
  const allCategories = Array.from(new Set(entries.map(e => e.category))).filter(Boolean);

  const displayed = entries
    .filter(e => filter === 'all' || e.category === filter)
    .sort((a, b) => {
      if (sortBy === 'date') return new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime();
      const sa = parseFloat(a.score.split('/')[0]) || 0;
      const sb = parseFloat(b.score.split('/')[0]) || 0;
      return sb - sa;
    });

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      <NavBar />

      <main className="flex-1 mx-auto w-full max-w-5xl px-4 py-8">

        {/* Header */}
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold tracking-tight">My Scrapbook</h1>
            <p className="text-sm text-zinc-500 font-mono mt-0.5">
              {entries.length} shot{entries.length !== 1 ? 's' : ''} saved · PinPic by Arya Hemant Tare
            </p>
          </div>
          <Link href="/explore">
            <button className="flex items-center gap-1.5 bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-mono font-bold uppercase tracking-widest px-4 py-2.5 rounded-lg border-2 border-black shadow-[2px_2px_0px_rgba(0,0,0,0.6)] transition-all active:scale-95">
              <Camera className="h-3.5 w-3.5" /> Capture New Shot
            </button>
          </Link>
        </div>

        {/* Filter + Sort Bar */}
        {entries.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-6">
            {/* Filter by category */}
            <div className="flex items-center gap-1.5 bg-zinc-900 border border-zinc-800 rounded-lg px-2 py-1.5">
              <Filter className="h-3 w-3 text-zinc-500" />
              <select
                value={filter}
                onChange={e => setFilter(e.target.value)}
                className="bg-transparent text-[10px] font-mono text-zinc-300 uppercase tracking-widest outline-none cursor-pointer"
              >
                <option value="all">All Categories</option>
                {allCategories.map(cat => (
                  <option key={cat} value={cat}>{getCategoryStyle(cat).label}</option>
                ))}
              </select>
            </div>

            {/* Sort */}
            <div className="flex items-center gap-1.5 bg-zinc-900 border border-zinc-800 rounded-lg px-2 py-1.5">
              <SortAsc className="h-3 w-3 text-zinc-500" />
              <select
                value={sortBy}
                onChange={e => setSortBy(e.target.value as 'date' | 'score')}
                className="bg-transparent text-[10px] font-mono text-zinc-300 uppercase tracking-widest outline-none cursor-pointer"
              >
                <option value="date">Latest First</option>
                <option value="score">Highest Score</option>
              </select>
            </div>

            {/* Count badge */}
            <div className="ml-auto flex items-center">
              <span className="text-[9px] font-mono text-zinc-600 uppercase">
                {displayed.length} of {entries.length} shown
              </span>
            </div>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="aspect-square rounded-lg bg-zinc-900 animate-pulse" />
            ))}
          </div>
        )}

        {/* Empty state */}
        {!loading && entries.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 gap-5 text-center">
            <div className="h-16 w-16 rounded-full bg-zinc-900 flex items-center justify-center">
              <BookImage className="h-8 w-8 text-zinc-700" />
            </div>
            <div>
              <p className="text-sm font-bold text-zinc-400">No shots yet</p>
              <p className="text-xs text-zinc-600 font-mono mt-1">
                Head to the Explore Map, capture a photo, and save it here.
              </p>
            </div>
            <Link href="/explore">
              <button className="bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-mono font-bold uppercase tracking-widest px-5 py-2.5 rounded-lg border-2 border-black transition-all active:scale-95">
                Open Explore Map
              </button>
            </Link>
          </div>
        )}

        {/* No filter results */}
        {!loading && entries.length > 0 && displayed.length === 0 && (
          <div className="py-16 text-center">
            <p className="text-sm text-zinc-500 font-mono">No shots match this filter.</p>
            <button onClick={() => setFilter('all')} className="text-xs text-emerald-500 font-mono mt-2 hover:underline">
              Clear filter
            </button>
          </div>
        )}

        {/* Grid */}
        {!loading && displayed.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {displayed.map(entry => (
              <EntryCard key={entry.id} entry={entry} onDelete={handleDelete} />
            ))}
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}

// ── Entry Card Component ───────────────────────────────────────────────────────
function EntryCard({
  entry,
  onDelete,
}: {
  entry:    LocalEntry;
  onDelete: (id: string) => void;
}) {
  const { label, color } = getCategoryStyle(entry.category);
  const scoreNum = parseFloat(entry.score.split('/')[0]) || 0;
  const scorePercent = Math.round((scoreNum / 10) * 100);

  const dateStr = new Date(entry.savedAt).toLocaleDateString('en-IN', {
    day:   'numeric',
    month: 'short',
    year:  'numeric',
  });

  return (
    <div className="group relative bg-zinc-950 border border-zinc-800 rounded-lg overflow-hidden hover:border-zinc-600 transition-colors">
      {/* Image */}
      <div className="aspect-square overflow-hidden bg-zinc-900">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={entry.imageData}
          alt={entry.hotspot}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          loading="lazy"
        />
      </div>

      {/* Category badge */}
      <div
        className="absolute top-2 left-2 text-[7px] font-mono font-bold uppercase tracking-widest px-1.5 py-0.5 rounded"
        style={{ background: `${color}33`, color, border: `1px solid ${color}66` }}
      >
        {label}
      </div>

      {/* Score badge */}
      <div className="absolute top-2 right-2 bg-black/80 border border-zinc-700 px-1.5 py-0.5 rounded flex items-center gap-1">
        <Star className="h-2.5 w-2.5 text-amber-400" />
        <span className="text-[8px] font-mono font-bold text-white">{scorePercent}%</span>
      </div>

      {/* Info overlay */}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/95 via-black/60 to-transparent p-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <div className="flex items-start gap-1 mb-1">
          <MapPin className="h-2.5 w-2.5 text-emerald-500 mt-0.5 shrink-0" />
          <p className="text-[9px] font-mono text-zinc-200 leading-tight truncate">{entry.hotspot}</p>
        </div>
        <p className="text-[7px] font-mono text-zinc-500 mb-2">{dateStr}</p>

        {/* Tip snippet */}
        {entry.tip && (
          <p className="text-[7px] font-mono text-amber-400/80 italic leading-tight mb-2 line-clamp-2">
            💡 {entry.tip}
          </p>
        )}

        <button
          onClick={() => onDelete(entry.id)}
          className="w-full flex items-center justify-center gap-1 border border-red-900/60 text-red-400 hover:bg-red-950/40 hover:text-red-300 text-[8px] font-mono uppercase tracking-widest py-1.5 rounded transition-colors"
          aria-label="Delete this entry"
        >
          <Trash2 className="h-2.5 w-2.5" /> Delete
        </button>
      </div>
    </div>
  );
}
