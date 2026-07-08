import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import { Toaster } from 'sonner';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'PinPic — Compose Like a Pro, Anywhere on Earth',
    template: '%s | PinPic',
  },
  description:
    'Step into a GPS hotspot anywhere on Earth, align with the AI wireframe overlay, and capture a perfectly composed travel photo — every single time.',
  keywords: [
    'travel photography',
    'composition guide',
    'GPS photo app',
    'AI camera',
    'travel app',
    'photo composition',
  ],
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
    title: 'PinPic — Compose Like a Pro, Anywhere on Earth',
    description:
      'AI-guided composition matching for travelers. Step in, align, shoot.',
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
        {/* PWA iOS icons */}
        <link rel="apple-touch-icon" sizes="180x180" href="/icons/icon-192x192.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        {/* Service Worker registration — only in production (PWA disabled in dev) */}
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
