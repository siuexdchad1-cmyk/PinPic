'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  User, Camera, LogOut, ShieldCheck, Mail, Sparkles, 
  Trash2, BookImage, Check, ArrowRight 
} from 'lucide-react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import NavBar from '@/components/shared/NavBar';
import Footer from '@/components/shared/Footer';

export default function AccountPage() {
  const router = useRouter();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState<string>('Guest User');
  const [displayName, setDisplayName] = useState<string>('Traveler');
  const [editingName, setEditingName] = useState(false);
  const [tempName, setTempName] = useState('');
  const [shotCount, setShotCount] = useState<number>(0);

  useEffect(() => {
    async function loadUserData() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setEmail(user.email ?? 'Registered User');
        setDisplayName(user.user_metadata?.display_name || user.email?.split('@')[0] || 'Traveler');
      }

      // Count LocalStorage scrapbook entries
      try {
        const local = JSON.parse(localStorage.getItem('pinpic_scrapbook') ?? '[]');
        setShotCount(local.length);
      } catch {
        setShotCount(0);
      }

      setLoading(false);
    }

    loadUserData();
  }, [supabase]);

  const handleSaveName = async () => {
    if (!tempName.trim()) return;
    setDisplayName(tempName.trim());
    setEditingName(false);
    try {
      await supabase.auth.updateUser({
        data: { display_name: tempName.trim() }
      });
      toast.success('Display name updated!');
    } catch {
      toast.success('Name updated locally.');
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    toast.success('Signed out successfully.');
    router.push('/');
    router.refresh();
  };

  const handleClearCache = () => {
    if (confirm('Are you sure you want to clear your local scrapbook cache?')) {
      localStorage.removeItem('pinpic_scrapbook');
      setShotCount(0);
      toast.success('Local scrapbook cleared.');
    }
  };

  return (
    <div className="min-h-screen bg-black text-white flex flex-col font-sans">
      <NavBar />

      <main className="flex-1 mx-auto w-full max-w-3xl px-4 py-8 flex flex-col gap-6">
        
        {/* Page Title & Direct "Take a Picture" CTA */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800 pb-6">
          <div>
            <span className="text-[9px] font-mono text-emerald-400 font-bold uppercase tracking-widest block mb-1">
              ● USER ACCOUNT &amp; PREFERENCES
            </span>
            <h1 className="text-2xl font-bold tracking-tight text-white font-mono uppercase">
              Manage Account
            </h1>
          </div>

          {/* Prominent "Take a Picture" Button */}
          <Link href="/camera">
            <button className="flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-black font-mono font-bold text-xs uppercase tracking-widest px-6 py-3.5 rounded-lg border-2 border-black shadow-[3px_3px_0px_rgba(0,0,0,0.8)] transition-all active:scale-95">
              <Camera className="h-4 w-4" />
              Take a Picture
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </Link>
        </div>

        {/* Profile Card */}
        <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-6 flex flex-col gap-6">
          
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-full bg-emerald-500/10 border-2 border-emerald-500 flex items-center justify-center text-emerald-400">
              <User className="h-8 w-8" />
            </div>

            <div className="flex-1">
              {editingName ? (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={tempName}
                    onChange={(e) => setTempName(e.target.value)}
                    className="bg-zinc-900 border border-zinc-700 px-3 py-1.5 text-sm font-mono text-white rounded outline-none"
                    placeholder="Enter display name…"
                  />
                  <button
                    onClick={handleSaveName}
                    className="bg-emerald-500 text-black px-3 py-1.5 text-xs font-mono font-bold rounded"
                  >
                    <Check className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setEditingName(false)}
                    className="text-zinc-500 hover:text-white text-xs font-mono"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-white font-mono">{displayName}</h2>
                  <button
                    onClick={() => { setTempName(displayName); setEditingName(true); }}
                    className="text-[10px] font-mono text-zinc-500 hover:text-emerald-400 uppercase border border-zinc-800 px-2 py-0.5 rounded"
                  >
                    Edit
                  </button>
                </div>
              )}
              <p className="text-xs text-zinc-400 font-mono mt-0.5 flex items-center gap-1.5">
                <Mail className="h-3 w-3 text-zinc-500" /> {email}
              </p>
            </div>
          </div>

          {/* Account Details Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            <div className="border border-zinc-850 bg-zinc-900/50 p-4 rounded-lg flex items-center justify-between">
              <div>
                <p className="text-[9px] font-mono text-zinc-500 uppercase tracking-widest">Saved Travel Shots</p>
                <p className="text-2xl font-bold text-white font-mono mt-0.5">{loading ? '…' : shotCount}</p>
              </div>
              <BookImage className="h-6 w-6 text-emerald-500" />
            </div>

            <div className="border border-zinc-850 bg-zinc-900/50 p-4 rounded-lg flex items-center justify-between">
              <div>
                <p className="text-[9px] font-mono text-zinc-500 uppercase tracking-widest">Project Author</p>
                <p className="text-xs font-bold text-zinc-200 font-mono mt-1">Arya Hemant Tare</p>
              </div>
              <ShieldCheck className="h-6 w-6 text-indigo-400" />
            </div>
          </div>
        </div>

        {/* Quick Actions Panel */}
        <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-6 flex flex-col gap-4">
          <h3 className="text-xs font-mono font-bold uppercase text-zinc-400 tracking-wider">
            Quick Actions
          </h3>

          <div className="flex flex-col gap-2">
            
            {/* Direct Camera Button */}
            <Link href="/camera" className="w-full">
              <div className="flex items-center justify-between p-3.5 bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 hover:border-emerald-500/50 rounded-lg transition-all group">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                    <Camera className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-xs font-mono font-bold text-white uppercase">Open Camera &amp; AI Analysis</p>
                    <p className="text-[10px] font-mono text-zinc-500">Capture photos and get instant Groq AI feedback</p>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-zinc-500 group-hover:text-emerald-400 transition-colors" />
              </div>
            </Link>

            {/* Scrapbook Button */}
            <Link href="/scrapbook" className="w-full">
              <div className="flex items-center justify-between p-3.5 bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 hover:border-zinc-700 rounded-lg transition-all group">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center">
                    <BookImage className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-xs font-mono font-bold text-white uppercase">View My Scrapbook</p>
                    <p className="text-[10px] font-mono text-zinc-500">Browse saved travel shots &amp; scores</p>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-zinc-500 group-hover:text-white transition-colors" />
              </div>
            </Link>

            {/* Clear Local Cache */}
            <button
              onClick={handleClearCache}
              className="flex items-center justify-between p-3.5 bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 hover:border-red-900/50 rounded-lg transition-all group text-left"
            >
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-lg bg-red-500/20 text-red-400 flex items-center justify-center">
                  <Trash2 className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-xs font-mono font-bold text-white uppercase">Clear Local Storage Cache</p>
                  <p className="text-[10px] font-mono text-zinc-500">Remove saved local scrapbook entries</p>
                </div>
              </div>
            </button>

          </div>
        </div>

        {/* Sign Out Button */}
        <div className="pt-2">
          <button
            onClick={handleSignOut}
            className="w-full flex items-center justify-center gap-2 border border-red-900/50 hover:bg-red-950/30 text-red-400 hover:text-red-300 py-3.5 font-mono text-xs font-bold uppercase tracking-widest rounded-xl transition-colors"
          >
            <LogOut className="h-4 w-4" />
            Sign Out of Account
          </button>
        </div>

        {/* Project Attribution */}
        <div className="text-center pt-4">
          <p className="text-[9px] font-mono text-zinc-600 uppercase tracking-widest flex items-center justify-center gap-1.5">
            <Sparkles className="h-3 w-3 text-emerald-500" /> PinPic &copy; {new Date().getFullYear()} · Major Diploma Project by Arya Hemant Tare
          </p>
        </div>

      </main>

      <Footer />
    </div>
  );
}
