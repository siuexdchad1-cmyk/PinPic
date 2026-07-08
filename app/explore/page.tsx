'use client';

import dynamic from 'next/dynamic';
import NavBar from '@/components/shared/NavBar';

// Import Leaflet Map rendering component dynamically with SSR disabled.
// Leaflet depends on window/document, which are only present in client browser context.
const ExploreMap = dynamic(() => import('@/components/map/ExploreMap'), {
  ssr: false,
});

export default function ExplorePage() {
  return (
    <div className="min-h-screen bg-black flex flex-col text-white">
      <NavBar />
      <main className="flex-1 flex flex-col">
        <ExploreMap />
      </main>
    </div>
  );
}
