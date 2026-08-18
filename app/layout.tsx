import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import { Toaster } from 'sonner';
import TargetCursor from '@/components/ui/TargetCursor';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'PinPic — AI & GPS Guided Photography',
    template: '%s | PinPic',
  },
  description:
    'PinPic is a major diploma project by Arya Hemant Tare — an AI & GPS-guided travel photography Progressive Web App. Step into a GPS hotspot, align with the AI wireframe overlay, and capture a perfectly composed travel photo every time.',
  keywords: [
    'travel photography',
    'AI composition guide',
    'GPS photo app',
    'golden hour calculator',
    'rule of thirds',
    'PinPic',
    'Arya Hemant Tare',
    'diploma project',
    'PWA',
  ],
  authors: [{ name: 'Arya Hemant Tare' }],
  creator: 'Arya Hemant Tare',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'PinPic',
  },
  formatDetection: { telephone: false },
  openGraph: {
    type: 'website',
    siteName: 'PinPic',
    title: 'PinPic — AI & GPS Guided Photography | Diploma Project',
    description:
      'AI-guided composition matching for travelers. Step in, align, shoot. Built by Arya Hemant Tare.',
  },
};

export const viewport: Viewport = {
  themeColor: '#000000',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="dark">
      <head>
        {/* Harmond ExtraBold Expanded display font import */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@1,900&family=Cinzel+Decorative:wght@700;900&display=swap" rel="stylesheet" />
        {/* PWA iOS icons */}
        <link rel="apple-touch-icon" sizes="180x180" href="/icons/icon-192x192.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator && location.hostname !== 'localhost') {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw.js').catch(function() {});
                });
              }
            `,
          }}
        />
      </head>
      <body className={`${inter.variable} font-sans bg-black text-white antialiased`}>
        <TargetCursor
          targetSelector="button, a, .cursor-target"
          spinDuration={3}
          hideDefaultCursor={false}
          parallaxOn={true}
          cursorColor="#10b981"
          cursorColorOnTarget="#34d399"
        />
        {children}
        <Toaster
          theme="dark"
          toastOptions={{
            style: {
              background: '#0a0a0a',
              border: '1px solid #27272a',
              color: '#ffffff',
            },
          }}
          position="top-center"
        />
      </body>
    </html>
  );
}
