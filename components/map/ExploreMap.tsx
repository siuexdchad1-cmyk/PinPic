'use client';

import { useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';

interface HotspotPin {
  id:              string;
  title:           string;
  description:     string | null;
  inspo_image_url: string;
  lat:             number;
  lng:             number;
}

export default function ExploreMap() {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [hotspots, setHotspots] = useState<HotspotPin[]>([]);

  // ── Load Leaflet CDN Assets ────────────────────────────────────────────────
  useEffect(() => {
    let active = true;

    async function initMap() {
      try {
        // Fetch hotspots list
        const res = await fetch('/api/hotspots');
        if (!res.ok) throw new Error('Failed to load hotspots list');
        const data = await res.json();
        if (active) setHotspots(data.hotspots ?? []);

        // Load Leaflet CSS
        if (!document.querySelector('link[href*="leaflet.css"]')) {
          const link = document.createElement('link');
          link.rel = 'stylesheet';
          link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
          document.head.appendChild(link);
        }

        // Load Leaflet JS
        if (!window.hasOwnProperty('L')) {
          await new Promise<void>((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
            script.async = true;
            script.onload = () => resolve();
            script.onerror = () => reject(new Error('Failed to load Leaflet JS'));
            document.body.appendChild(script);
          });
        }

        if (!active || !mapContainerRef.current) return;

        const L = (window as Window & { L?: Record<string, unknown> }).L;
        if (!L) return;

        const leaf = L as unknown as {
          map: (el: HTMLDivElement, cfg: { zoomControl: boolean }) => { setView: (coords: [number, number], zoom: number) => unknown };
          control: { zoom: (cfg: { position: string }) => { addTo: (map: unknown) => unknown } };
          tileLayer: (url: string, cfg: { maxZoom: number; attribution: string }) => { addTo: (map: unknown) => unknown };
          circleMarker: (coords: [number, number], cfg: { color: string; fillColor: string; fillOpacity: number; radius: number; weight: number }) => {
            addTo: (map: unknown) => { bindPopup: (html: string, cfg: { maxWidth: number; className: string }) => unknown };
          };
        };

        // Initialize map centered at standard coordinates
        const map = leaf.map(mapContainerRef.current, {
          zoomControl: false // custom zoom controls look cleaner
        });
        (map as { setView: (coords: [number, number], zoom: number) => unknown }).setView([20, 0], 2);

        // Zoom control bottom-right
        leaf.control.zoom({ position: 'bottomright' }).addTo(map);

        // Use CartoDB Dark Matter tile layers to match our dark premium aesthetic
        leaf.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
          maxZoom: 20,
          attribution: '&copy; <a href="https://osm.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>'
        }).addTo(map);

        // Plot each hotspot location as an interactive neon marker
        (data.hotspots ?? []).forEach((spot: HotspotPin) => {
          if (spot.lat === 0 && spot.lng === 0) return;

          const marker = leaf.circleMarker([spot.lat, spot.lng], {
            color: '#10b981',        // Emerald border
            fillColor: '#047857',    // Teal fill
            fillOpacity: 0.8,
            radius: 8,
            weight: 2
          }).addTo(map);

          // Rich styled html popup box
          const popupHtml = `
            <div style="font-family: monospace; color: #09090b; width: 220px; padding: 4px;">
              <h4 style="font-size: 12px; font-weight: 700; margin: 0 0 4px 0; border-bottom: 1px solid #e4e4e7; padding-bottom: 4px; color: #09090b;">
                📍 ${spot.title}
              </h4>
              <p style="font-size: 10px; color: #71717a; margin: 0 0 8px 0; line-height: 1.3;">
                ${spot.description || 'Travel composition hotspot.'}
              </p>
              <div style="width: 100%; height: 110px; border-radius: 6px; overflow: hidden; margin-bottom: 8px;">
                <img src="${spot.inspo_image_url}" style="width: 100%; height: 100%; object-fit: cover;" />
              </div>
              <a href="/camera?ref=${spot.id}" style="display: block; width: 100%; text-align: center; background: #10b981; color: white; text-decoration: none; font-size: 10px; font-weight: 600; padding: 6px 0; border-radius: 4px; transition: background 0.15s;">
                GO TO CAMERA
              </a>
            </div>
          `;

          marker.bindPopup(popupHtml, {
            maxWidth: 240,
            className: 'leaflet-dark-popup'
          });
        });

        setLoading(false);
      } catch (err) {
        console.error('[Map init error]', err);
      }
    };

    initMap();

    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="relative w-full h-[calc(100vh-3.5rem)] bg-zinc-950">
      {loading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 z-50 bg-zinc-950">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
          <p className="text-sm font-mono text-zinc-400">Loading global locations...</p>
        </div>
      )}

      {/* Map Target Container */}
      <div ref={mapContainerRef} className="w-full h-full z-10" />

      {/* Floating Info HUD Overlay */}
      <div className="absolute top-4 left-4 z-20 bg-zinc-950/90 border border-zinc-800/80 rounded-md p-3 max-w-xs pointer-events-auto shadow-2xl backdrop-blur-md">
        <h2 className="text-xs font-mono font-bold text-white uppercase tracking-wider mb-1 flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          Locations Map
        </h2>
        <p className="text-[10px] font-mono text-zinc-400 leading-normal mb-2">
          Explore global travel landmarks and custom hotspots pinned by the community. Click a marker to load its reference stencil.
        </p>
        <div className="text-[9px] font-mono text-zinc-500 border-t border-zinc-850 pt-2 flex justify-between">
          <span>Active Spotpins:</span>
          <span className="text-zinc-300 font-bold">{hotspots.length}</span>
        </div>
      </div>
    </div>
  );
}
