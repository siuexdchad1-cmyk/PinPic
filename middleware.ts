import { type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

// Run this middleware in the Node.js runtime (not Edge) because
// @supabase/ssr uses Node.js APIs (process.version) not available in Edge Runtime.
export const runtime = 'nodejs';

/**
 * Next.js root middleware.
 * Runs on every matched request BEFORE the page/route handler.
 *
 * Responsibilities:
 *   1. Refresh the Supabase auth session cookie on every request
 *   2. Redirect unauthenticated users away from protected routes
 *   3. Redirect authenticated users away from auth pages (/login, /signup)
 */
export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths EXCEPT:
     *   - _next/static  (static files)
     *   - _next/image   (image optimization)
     *   - favicon.ico, manifest.json, icons/, sw.js, workbox-*  (PWA assets)
     *   - Any file with an extension (images, fonts, etc.)
     */
    '/((?!_next/static|_next/image|favicon.ico|manifest.json|icons|sw.js|workbox-.*|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff|woff2|ttf|mp4)$).*)',
  ],
};
