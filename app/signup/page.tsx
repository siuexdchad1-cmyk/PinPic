'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { MapPin, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function SignupPage() {
  const router   = useRouter();
  const supabase = createClient();

  const [username, setUsername] = useState('');
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState<string | null>(null);

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      setLoading(false);
      return;
    }

    // Sign up — emailRedirectTo intentionally omitted for instant demo session.
    // The on_auth_user_created trigger auto-creates the profiles row.
    const { data, error: signUpError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: { username: username.trim() },
      },
    });

    if (signUpError) {
      setError(signUpError.message);
      setLoading(false);
      return;
    }

    // Fire welcome email via API route (non-blocking)
    if (data.user) {
      fetch('/api/email/welcome', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          username: username.trim() || email.split('@')[0],
        }),
      }).catch(() => {
        // Email failure is non-fatal — user still gets in
      });
    }

    toast.success('Account created! Welcome to PinPic 🌍');
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
        <h1 className="mb-1 text-lg font-semibold">Create your account</h1>
        <p className="mb-6 text-sm text-zinc-500">
          Free forever. No credit card required.
        </p>

        <form onSubmit={handleSignup} className="flex flex-col gap-4" noValidate>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="username">Username</Label>
            <Input
              id="username"
              type="text"
              placeholder="traveler_arya"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              disabled={loading}
              maxLength={32}
            />
          </div>

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
              placeholder="Min. 6 characters"
              autoComplete="new-password"
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
              <><Loader2 className="h-4 w-4 animate-spin" /> Creating account…</>
            ) : (
              'Create account'
            )}
          </Button>
        </form>

        <p className="mt-5 text-center text-sm text-zinc-500">
          Already have an account?{' '}
          <Link href="/login" className="text-emerald-400 hover:underline">
            Sign in
          </Link>
        </p>
      </div>

      <p className="mt-8 text-xs text-zinc-700 text-center">
        Curriculum and Lab Standards Curated by Prathamesh Sir
      </p>
    </div>
  );
}
