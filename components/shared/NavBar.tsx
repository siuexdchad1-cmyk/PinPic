'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Camera, BookImage, LayoutDashboard, MapPin, User, LogOut } from 'lucide-react';
import { cn } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import SplitText from '@/components/ui/SplitText';

const navLinks = [
  { href: '/dashboard', label: 'Dashboard',   icon: LayoutDashboard },
  { href: '/explore',   label: 'Explore Map', icon: MapPin },
  { href: '/camera',    label: 'Camera',      icon: Camera },
  { href: '/scrapbook', label: 'Scrapbook',   icon: BookImage },
  { href: '/account',   label: 'Account',     icon: User },
];

export default function NavBar() {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    toast.success('Signed out successfully.');
    router.push('/login');
    router.refresh();
  };

  return (
    <header className="sticky top-0 z-40 border-b border-zinc-800 bg-black">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
        
        {/* Brand Logo with SplitText animation */}
        <Link href="/" className="flex items-center gap-2 font-semibold text-white">
          <MapPin className="h-5 w-5 text-emerald-500" />
          <SplitText
            text="PinPic"
            className="text-base tracking-tight font-mono font-bold text-white"
            delay={60}
            duration={0.6}
            splitType="chars"
            from={{ opacity: 0, y: -12 }}
            to={{ opacity: 1, y: 0 }}
          />
        </Link>

        {/* Nav Links */}
        <nav className="flex items-center gap-1" aria-label="Main navigation">
          {navLinks.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-mono font-medium transition-colors',
                pathname.startsWith(href)
                  ? 'bg-zinc-900 text-emerald-400 font-bold'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-900'
              )}
              aria-current={pathname.startsWith(href) ? 'page' : undefined}
            >
              <Icon className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{label}</span>
            </Link>
          ))}
        </nav>

        {/* Right Action: Direct "Take a Picture" CTA + Account Avatar + Sign Out */}
        <div className="flex items-center gap-2">
          
          {/* Prominent "Take a Picture" CTA Button */}
          <Link href="/camera">
            <button className="flex items-center gap-1.5 bg-emerald-500 hover:bg-emerald-400 text-black font-mono font-bold text-[10px] uppercase tracking-wider px-3.5 py-1.5 rounded-md transition-all active:scale-95 border border-black shadow-sm">
              <Camera className="h-3.5 w-3.5" />
              <span>Take a Picture</span>
            </button>
          </Link>

          {/* Account Profile Shortcut */}
          <Link
            href="/account"
            className={cn(
              'h-8 w-8 flex items-center justify-center rounded-md border text-zinc-400 hover:text-white transition-colors',
              pathname.startsWith('/account')
                ? 'border-emerald-500 bg-zinc-900 text-emerald-400'
                : 'border-zinc-800 bg-zinc-950 hover:bg-zinc-900'
            )}
            title="Account Settings"
          >
            <User className="h-4 w-4" />
          </Link>

          {/* Sign Out Button */}
          <button
            onClick={handleSignOut}
            className="h-8 px-2.5 flex items-center gap-1.5 rounded-md border border-zinc-800 bg-zinc-950 hover:bg-red-950/40 hover:border-red-900/60 text-zinc-400 hover:text-red-400 text-[10px] font-mono font-bold uppercase transition-colors"
            title="Sign Out of Account"
          >
            <LogOut className="h-3.5 w-3.5 text-red-500" />
            <span className="hidden md:inline">Sign Out</span>
          </button>
        </div>
      </div>
    </header>
  );
}
