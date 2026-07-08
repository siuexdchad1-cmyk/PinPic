import { createBrowserClient } from '@supabase/ssr';

/**
 * Browser-side Supabase client.
 * Safe to call in Client Components ('use client').
 * Uses the public anon key — all operations are subject to RLS policies.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
