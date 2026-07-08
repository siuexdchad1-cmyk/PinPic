# PinPic 📍

> A brutalist-aesthetic, production-grade Progressive Web App that turns any travel destination into a professional photography studio — guided by GPS, AI, and real-time pose detection.

---

## What is PinPic?

PinPic is a **Composition Intelligence PWA** for travelers. When you arrive at any location on Earth, PinPic locks your GPS coordinates, fetches real community photos taken at that exact spot via **Wikimedia Commons geosearch**, and overlays a live composition wireframe on your camera feed. A client-side **TensorFlow.js PoseNet** engine tracks your body joints in real-time and aligns them to a glassmorphic silhouette guide — similar to Huawei's AI Camera. Capture the shot, and **Groq Llama Vision AI** instantly scores your composition, generates photography tips, and saves everything to your personal scrapbook.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14 (App Router, TypeScript) |
| Styling | Tailwind CSS (Brutalist editorial dark theme) |
| UI Primitives | Radix UI, Lucide React |
| Database | Supabase (PostgreSQL + PostGIS) |
| Auth | Supabase Auth (cookie-based SSR sessions) |
| AI Vision | Groq `meta-llama/llama-4-scout-17b-16e-instruct` |
| AI Text | Groq `llama-3.3-70b-versatile` |
| Pose Detection | TensorFlow.js + PoseNet v2.2 (client-side CDN) |
| Geocoding | Nominatim (OpenStreetMap) — no API key needed |
| Photos | Wikimedia Commons Geosearch + Unsplash CDN |
| Map | Leaflet.js + CartoDB Dark Matter tiles |
| Email | Resend SDK |
| Charts | Recharts |
| PWA | next-pwa + Web App Manifest |

---

## Core Features

- **GPS Geofencing** — detects hotspots within ±5m using PostGIS `ST_DWithin`
- **Live Pose Guide** — TensorFlow.js PoseNet tracks joints; glassmorphic silhouette overlay shows target position
- **Worldwide Location Search** — type any city or landmark; Nominatim geocodes it and Wikimedia fetches real photos taken there
- **Community Inspiration Feed** — Instagram/Snapchat styled social cards showing geolocated shots from that location
- **AI Composition Scoring** — Groq Vision compares your capture against the reference and returns a 0–100% score
- **Interactive Global Map** — Leaflet map at `/explore` shows all pinned hotspots worldwide with popup previews
- **Scrapbook** — Full CRUD on saved shots with AI captions, tags, and edit/delete
- **Dashboard Analytics** — KPI cards, accuracy trend charts, hotspot engagement bars
- **Milestone Emails** — Resend fires a congratulatory email when you hit ≥ 95% composition accuracy

---

## Prerequisites

- Node.js 18.17+
- npm 9+
- [Supabase](https://supabase.com) project (free tier)
- [Groq](https://console.groq.com) API key (free tier)
- [Resend](https://resend.com) account (3,000 emails/month free)

---

## Setup

### 1. Clone & Install

```bash
git clone https://github.com/siuexdchad1-cmyk/PinPic.git
cd PInPic
npm install
```

### 2. Configure Environment Variables

```bash
cp .env.example .env.local
```

Fill in all values in `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
GROQ_API_KEY=gsk_...
RESEND_API_KEY=re_...
RESEND_SENDER=onboarding@resend.dev
```

### 3. Enable PostGIS on Supabase

1. Supabase Dashboard → **Database → Extensions**
2. Search `postgis` → **Enable**

### 4. Run the Database Migration

1. Supabase Dashboard → **SQL Editor → New query**
2. Paste the full contents of `supabase/migrations/001_init.sql`
3. Click **Run**

This creates all tables, RLS policies, spatial indexes, and the `nearby_hotspots` PostGIS RPC.

### 5. Add Custom Hotspots

The migration seeds global landmark hotspots. To pin any location:

```sql
INSERT INTO public.hotspots (title, description, location, inspo_image_url)
VALUES (
  'Your Location',
  'Photography composition tip',
  ST_SetSRID(ST_MakePoint(<longitude>, <latitude>), 4326)::geography,
  'https://images.unsplash.com/photo-<id>?w=400&q=70&auto=format'
);
```

> ⚠️ `ST_MakePoint` takes **longitude first**, then latitude.

### 6. Start Dev Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## Testing the Camera Without Travelling

To test GPS-based features locally:

1. Chrome DevTools → **Sensors** tab
2. Set **Geolocation** to a custom location:

| Location | Latitude | Longitude |
|---|---|---|
| Eiffel Tower, Paris | 48.8614 | 2.2885 |
| Taj Mahal, Agra | 27.1751 | 78.0421 |
| Tokyo Shibuya | 35.6595 | 139.7003 |
| Sydney Opera House | -33.8568 | 151.2153 |
| Colosseum, Rome | 41.8902 | 12.4922 |

Or use the **worldwide search bar** inside the camera to virtually teleport to any address.

---

## Project Structure

```
PInPic/
├── app/
│   ├── layout.tsx                  # Root layout (fonts, PWA meta, Toaster)
│   ├── page.tsx                    # Landing page (brutalist editorial)
│   ├── login/page.tsx              # Login
│   ├── signup/page.tsx             # Registration
│   ├── camera/page.tsx             # GPS + Camera + Pose Guide + HUD
│   ├── explore/page.tsx            # Global hotspot map (Leaflet)
│   ├── scrapbook/page.tsx          # Saved shots CRUD
│   ├── dashboard/page.tsx          # Analytics & KPIs
│   └── api/
│       ├── hotspots/route.ts           # List all hotspots (map endpoint)
│       ├── hotspots/nearby/route.ts    # PostGIS proximity query
│       ├── hotspots/create/route.ts    # Admin hotspot creation
│       ├── location/search/route.ts    # Worldwide geocoding + Wikimedia photos
│       ├── location/suggest/route.ts   # Overpass POI suggestions
│       ├── process-shot/route.ts       # Groq Vision + Text inference
│       ├── email/welcome/route.ts      # Resend welcome email
│       └── user/delete/route.ts        # Account deletion
├── components/
│   ├── map/ExploreMap.tsx          # Leaflet map client component
│   ├── shared/NavBar.tsx           # Navigation bar
│   └── ui/                         # Button, Input, Card, Dialog, etc.
├── lib/
│   ├── supabase/
│   │   ├── client.ts               # Browser Supabase client
│   │   ├── server.ts               # Server + Admin Supabase clients
│   │   └── middleware.ts           # Session refresh + route protection
│   ├── types.ts                    # All TypeScript interfaces
│   └── utils.ts                    # cn(), formatDate, haversine, throttle
├── supabase/
│   └── migrations/001_init.sql     # Complete database schema + seed data
├── public/
│   ├── manifest.json               # PWA manifest
│   └── icons/                      # PWA icon set
├── middleware.ts                   # Next.js route protection middleware
├── .env.example                    # Environment variable template
└── README.md
```

---

## Build & Deploy

```bash
# Production build
npm run build
npm start

# Deploy to Vercel
# Add all .env.local keys to Vercel → Settings → Environment Variables
```

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new)

---

## Performance Notes

- **No backdrop-blur or heavy shadows** — flat `border-zinc-900` rules only
- **Canvas-based HUD** — hardware-accelerated 2D API, not SVG
- **TF.js loaded on demand** — PoseNet CDN scripts only inject when Pose Guide is activated
- **GPS throttled** — proximity checks fire at max 1 per 3 seconds
- **Wikimedia geosearch cached** — `revalidate: 3600` on all open API calls
- **First Load JS: 100 kB** on the landing page (post editorial refactor)

---

*PinPic © 2026*
