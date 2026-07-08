'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { Camera, Trash2, Pencil, BookImage } from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';
import { formatDate } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import NavBar from '@/components/shared/NavBar';
import type { SavedShot } from '@/lib/types';

export default function ScrapbookPage() {
  const supabase = createClient();
  const [shots,   setShots]   = useState<SavedShot[]>([]);
  const [loading, setLoading] = useState(true);

  // Edit state
  const [editShot,    setEditShot]    = useState<SavedShot | null>(null);
  const [editCaption, setEditCaption] = useState('');
  const [editTags,    setEditTags]    = useState('');
  const [saving,      setSaving]      = useState(false);

  // Delete state
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [deleting,     setDeleting]     = useState(false);

  // ── Fetch shots ───────────────────────────────────────────────────────────
  useEffect(() => {
    async function fetchShots() {
      const { data, error } = await supabase
        .from('saved_shots')
        .select('*, hotspots(id, title, description, inspo_image_url)')
        .order('created_at', { ascending: false });

      if (error) {
        toast.error('Could not load your scrapbook.');
      } else {
        setShots((data as SavedShot[]) ?? []);
      }
      setLoading(false);
    }
    fetchShots();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Open edit drawer ──────────────────────────────────────────────────────
  function openEdit(shot: SavedShot) {
    setEditShot(shot);
    setEditCaption(shot.ai_caption ?? '');
    setEditTags((shot.tags ?? []).join(', '));
  }

  // ── Save edit ─────────────────────────────────────────────────────────────
  async function saveEdit() {
    if (!editShot) return;
    setSaving(true);

    const tagsArray = editTags
      .split(',')
      .map((t) => t.trim().replace(/^#/, ''))
      .filter(Boolean);

    const { error } = await supabase
      .from('saved_shots')
      .update({ ai_caption: editCaption, tags: tagsArray })
      .eq('id', editShot.id);

    if (error) {
      toast.error('Failed to save changes.');
    } else {
      setShots((prev) =>
        prev.map((s) =>
          s.id === editShot.id ? { ...s, ai_caption: editCaption, tags: tagsArray } : s
        )
      );
      toast.success('Shot updated.');
      setEditShot(null);
    }
    setSaving(false);
  }

  // ── Delete shot ───────────────────────────────────────────────────────────
  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);

    const { error } = await supabase
      .from('saved_shots')
      .delete()
      .eq('id', deleteTarget);

    if (error) {
      toast.error('Failed to delete shot.');
    } else {
      setShots((prev) => prev.filter((s) => s.id !== deleteTarget));
      toast.success('Shot deleted.');
    }
    setDeleteTarget(null);
    setDeleting(false);
  }

  return (
    <div className="min-h-screen bg-black text-white page-enter">
      <NavBar />

      <main className="mx-auto max-w-5xl px-4 py-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">My Scrapbook</h1>
            <p className="text-sm text-zinc-500">
              {shots.length} shot{shots.length !== 1 ? 's' : ''} captured
            </p>
          </div>
          <Link href="/camera">
            <Button size="sm">
              <Camera className="h-3.5 w-3.5" /> Capture
            </Button>
          </Link>
        </div>

        {/* ── Loading skeleton ──────────────────────────────────────────── */}
        {loading && (
          <div className="scrapbook-grid">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="shot-card">
                <Skeleton className="h-full w-full" />
              </div>
            ))}
          </div>
        )}

        {/* ── Empty state ───────────────────────────────────────────────── */}
        {!loading && shots.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
            <BookImage className="h-10 w-10 text-zinc-700" />
            <p className="text-sm text-zinc-500">No shots yet.</p>
            <Link href="/camera">
              <Button variant="outline" size="sm">Open Camera</Button>
            </Link>
          </div>
        )}

        {/* ── Grid ─────────────────────────────────────────────────────── */}
        {!loading && shots.length > 0 && (
          <div className="scrapbook-grid">
            {shots.map((shot) => (
              <ShotCard
                key={shot.id}
                shot={shot}
                onEdit={() => openEdit(shot)}
                onDelete={() => setDeleteTarget(shot.id)}
              />
            ))}
          </div>
        )}
      </main>

      {/* ── Edit Dialog ─────────────────────────────────────────────────── */}
      <Dialog open={!!editShot} onOpenChange={(o) => !o && setEditShot(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Shot</DialogTitle>
            <DialogDescription>Update the caption and tags for this shot.</DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4 py-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-caption">Caption</Label>
              <textarea
                id="edit-caption"
                value={editCaption}
                onChange={(e) => setEditCaption(e.target.value)}
                rows={3}
                className="flex w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-emerald-500 resize-none"
                placeholder="Your travel story…"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-tags">Tags (comma-separated)</Label>
              <Input
                id="edit-tags"
                value={editTags}
                onChange={(e) => setEditTags(e.target.value)}
                placeholder="travel, photography, eiffeltower"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditShot(null)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={saveEdit} disabled={saving}>
              {saving ? 'Saving…' : 'Save changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirmation Dialog ────────────────────────────────── */}
      <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Shot</DialogTitle>
            <DialogDescription>
              This action cannot be undone. The shot will be permanently removed.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={deleting}>
              {deleting ? 'Deleting…' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Shot Card ─────────────────────────────────────────────────────────────────
function ShotCard({
  shot,
  onEdit,
  onDelete,
}: {
  shot: SavedShot;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const accuracy = shot.match_accuracy ?? 0;
  const badgeVariant =
    accuracy >= 95 ? 'perfect' : accuracy >= 70 ? 'good' : 'low';

  const isBase64 = shot.captured_image_url.startsWith('data:');

  return (
    <div className="shot-card group relative bg-zinc-950">
      {/* Image */}
      {isBase64 ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={shot.captured_image_url}
          alt={shot.hotspots?.title ?? 'Captured shot'}
          className="h-full w-full object-cover"
          loading="lazy"
        />
      ) : (
        <Image
          src={shot.captured_image_url}
          alt={shot.hotspots?.title ?? 'Captured shot'}
          fill
          sizes="(max-width: 640px) 50vw, 25vw"
          className="object-cover"
          loading="lazy"
        />
      )}

      {/* Overlay on hover */}
      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/70 transition-colors flex flex-col justify-between p-2 opacity-0 group-hover:opacity-100">
        {/* Top — accuracy badge */}
        <div className="flex justify-end">
          <Badge variant={badgeVariant}>{accuracy}%</Badge>
        </div>

        {/* Bottom — meta + actions */}
        <div className="flex flex-col gap-1">
          {shot.hotspots?.title && (
            <p className="text-xs text-zinc-300 truncate">{shot.hotspots.title}</p>
          )}
          <p className="text-xs text-zinc-600">{formatDate(shot.created_at)}</p>
          <div className="flex gap-1 pt-1">
            <button
              onClick={onEdit}
              aria-label="Edit shot"
              className="flex-1 flex items-center justify-center gap-1 rounded border border-zinc-700 py-1 text-xs text-zinc-300 hover:border-zinc-500 hover:text-white transition-colors"
            >
              <Pencil className="h-3 w-3" /> Edit
            </button>
            <button
              onClick={onDelete}
              aria-label="Delete shot"
              className="flex items-center justify-center rounded border border-zinc-700 px-2 py-1 text-xs text-red-400 hover:border-red-700 hover:text-red-300 transition-colors"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
