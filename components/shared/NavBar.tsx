'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Camera, BookImage, LayoutDashboard, LogOut, MapPin } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const navLinks = [
  { href: '/dashboard',  label: 'Dashboard', icon: LayoutDashboard },
  { href: '/camera',     label: 'Camera',    icon: Camera },
  { href: '/scrapbook',  label: 'Scrapbook', icon: BookImage },
];

export default function NavBar() {
  const pathname = usePathname();
  const router   = useRouter();
  const supabase = createClient();

  async function handleSignOut() {
    await supabase.auth.signOut();
    toast.success('Signed out');
    router.push('/');
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-40 border-b border-zinc-800 bg-black">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
        {/* Brand */}
        <Link href="/" className="flex items-center gap-2 font-semibold text-white">
          <MapPin className="h-5 w-5 text-emerald-500" />
          <span className="text-base tracking-tight">PinPic</span>
        </Link>

        {/* Nav links */}
        <nav className="flex items-center gap-1" aria-label="Main navigation">
          {navLinks.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                pathname.startsWith(href)
                  ? 'bg-zinc-900 text-white'
                  : 'text-zinc-500 hover:text-white hover:bg-zinc-900'
              )}
              aria-current={pathname.startsWith(href) ? 'page' : undefined}
            >
              <Icon className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{label}</span>
            </Link>
          ))}
        </nav>

        {/* Sign out */}
        <button
          onClick={handleSignOut}
          className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium text-zinc-500 hover:text-white hover:bg-zinc-900 transition-colors"
          aria-label="Sign out"
        >
          <LogOut className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Sign out</span>
        </button>
      </div>
    </header>
  );
}
