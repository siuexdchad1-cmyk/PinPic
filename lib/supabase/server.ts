import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

/**
 * Server-side Supabase client for use in:
 *   - React Server Components (RSC)
 *   - Route Handlers (app/api/*)
 *   - Server Actions
 *
 * Uses the anon key with cookie-based session from the incoming request.
 * All operations respect RLS policies for the authenticated user.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // setAll called from a Server Component — cookies can only be set
            // from middleware or Route Handlers. This is expected behavior.
          }
        },
      },
    }
  );
}

/**
 * Server-side Supabase admin client using the SERVICE ROLE key.
 * BYPASSES Row Level Security — use only in trusted server-side contexts.
 * Never expose this to the browser.
 */
export async function createAdminClient() {
  const { createClient: createSupabaseClient } = await import('@supabase/supabase-js');

  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}
