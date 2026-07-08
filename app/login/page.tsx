'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { MapPin, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

function LoginForm() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const supabase     = createClient();

  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState<string | null>(null);

  // Show unauthorized toast if redirected from a protected route
  useEffect(() => {
    if (searchParams.get('reason') === 'unauthorized') {
      toast.error('Please sign in to access that page.');
    }
  }, [searchParams]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (signInError) {
      setError(signInError.message);
      setLoading(false);
      return;
    }

    toast.success('Welcome back!');
    router.push('/dashboard');
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center px-4 page-enter">

      {/* Brand */}
      <div className="mb-8 flex items-center gap-2">
        <MapPin className="h-6 w-6 text-emerald-500" />
        <span className="text-xl font-semibold tracking-tight">PinPic</span>
      </div>

      {/* Card */}
      <div className="w-full max-w-sm border border-zinc-800 rounded-lg bg-zinc-950 p-6">
        <h1 className="mb-1 text-lg font-semibold">Sign in</h1>
        <p className="mb-6 text-sm text-zinc-500">
          Enter your credentials to continue.
        </p>

        <form onSubmit={handleLogin} className="flex flex-col gap-4" noValidate>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={loading}
              minLength={6}
            />
          </div>

          {error && (
            <p role="alert" className="text-xs text-red-400 border border-red-900 rounded px-3 py-2 bg-red-950/30">
              {error}
            </p>
          )}

          <Button type="submit" disabled={loading} className="mt-1 w-full">
            {loading ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Signing in…</>
            ) : (
              'Sign in'
            )}
          </Button>
        </form>

        <p className="mt-5 text-center text-sm text-zinc-500">
          No account?{' '}
          <Link href="/signup" className="text-emerald-400 hover:underline">
            Create one free
          </Link>
        </p>
      </div>

      <p className="mt-8 text-xs text-zinc-700 text-center">
        Curriculum and Lab Standards Curated by Prathamesh Sir
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="h-8 w-8 rounded-full border-2 border-zinc-800 border-t-emerald-500 animate-spin" />
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}
