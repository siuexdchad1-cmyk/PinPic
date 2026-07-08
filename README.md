# PinPic 📸

**Curriculum and Lab Standards Curated by Prathamesh Sir**

> A production-grade Progressive Web App for camera-shy travelers — replicate professional photo compositions anywhere on Earth using AI-guided geofenced overlays.

---

## What is PinPic?

PinPic uses **Composition Matching via Proximity Geofencing**. When you step within 15 meters of a designated GPS hotspot anywhere on the planet, your phone's rear camera activates with a translucent AI-generated wireframe overlay. Align yourself to the stencil, capture your shot, and receive an instant AI composition score plus a travel caption ready for Instagram, YouTube Shorts, and Facebook Reels.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14 (App Router, TypeScript) |
| Styling | Tailwind CSS (Flat-Premium dark theme) |
| UI Primitives | Radix UI + shadcn/ui, Lucide React |
| Database | Supabase (PostgreSQL + PostGIS) |
| Auth | Supabase Auth (cookie-based SSR sessions) |
| AI — Vision | Groq `meta-llama/llama-3.2-11b-vision-preview` |
| AI — Text | Groq `llama-3.3-70b-versatile` |
| Email | Resend SDK |
| Charts | Recharts |
| PWA | next-pwa + Web App Manifest |

---

## Prerequisites

- Node.js 18.17+
- npm 9+
- A [Supabase](https://supabase.com) project (free tier)
- A [Groq](https://console.groq.com) API key (free developer tier)
- A [Resend](https://resend.com) account (free tier: 3,000 emails/month)

---

## Setup

### 1. Clone & Install

```bash
git clone <your-repo-url>
cd PInPic
npm install
```

### 2. Configure Environment Variables

```bash
cp .env.example .env.local
```

Open `.env.local` and fill in all values. See `.env.example` for documentation on each variable.

### 3. Enable PostGIS on Supabase

1. Open your Supabase project dashboard
2. Go to **Database → Extensions**
3. Search for `postgis` and click **Enable**

### 4. Run the Database Migration

1. Open your Supabase project dashboard
2. Go to **SQL Editor → New query**
3. Paste the entire contents of `supabase/migrations/001_init.sql`
4. Click **Run**

This creates all tables, indexes, RLS policies, the auto-profile trigger, and the `nearby_hotspots` spatial RPC function.

### 5. Add Hotspots (Admin)

The migration seeds 10 global hotspots. To add any location on Earth:

```sql
INSERT INTO public.hotspots (title, description, location, inspo_image_url)
VALUES (
  'Your Location Name',
  'Composition tip for this spot',
  ST_SetSRID(ST_MakePoint(<longitude>, <latitude>), 4326)::geography,
  'https://images.unsplash.com/photo-<id>?w=400&q=70&auto=format'
);
```

> ⚠️ **Note**: `ST_MakePoint` takes **longitude first**, then latitude.

### 6. Start the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## Testing the Camera (GPS Spoofing)

To test proximity detection without physically travelling:

1. Open Chrome DevTools → **Sensors** tab
2. Set **Geolocation** to a custom location
3. Use one of the seeded hotspot coordinates, e.g.:
   - Eiffel Tower: `48.8614, 2.2885`
   - Taj Mahal: `27.1751, 78.0421`
   - Tokyo Shibuya: `35.6595, 139.7003`

---

## Project Structure

```
PInPic/
├── app/
│   ├── layout.tsx              # Root layout (fonts, PWA meta, Toaster)
│   ├── page.tsx                # Landing page
│   ├── login/page.tsx          # Login
│   ├── signup/page.tsx         # Registration
│   ├── camera/page.tsx         # GPS + Camera + Canvas HUD (protected)
│   ├── scrapbook/page.tsx      # Saved shots CRUD (protected)
│   ├── dashboard/page.tsx      # Analytics & KPIs (protected)
│   └── api/
│       ├── process-shot/route.ts    # Groq Vision + Text inference
│       ├── hotspots/nearby/route.ts # PostGIS proximity query
│       ├── email/welcome/route.ts   # Resend welcome email
│       └── email/milestone/route.ts # Resend achievement email
├── components/
│   ├── camera/                 # VideoFeed, CanvasOverlay, CaptureButton
│   ├── scrapbook/              # ShotCard, EditDrawer
│   ├── dashboard/              # KpiCard, AccuracyChart, HotspotChart
│   ├── shared/                 # NavBar, LoadingSpinner
│   └── ui/                     # shadcn/ui primitives (Button, Input, etc.)
├── lib/
│   ├── supabase/
│   │   ├── client.ts           # Browser Supabase client
│   │   ├── server.ts           # Server + Admin Supabase clients
│   │   └── middleware.ts       # Session refresh + route protection
│   ├── types.ts                # All TypeScript interfaces
│   └── utils.ts                # cn(), formatDate, haversine, etc.
├── supabase/
│   └── migrations/
│       └── 001_init.sql        # Complete database schema
├── public/
│   ├── manifest.json           # PWA manifest
│   └── icons/                  # PWA icon set (all sizes)
├── middleware.ts                # Next.js root middleware
├── .env.example                # Environment variable template
└── README.md                   # This file
```

---

## Build for Production

```bash
npm run build
npm start
```

---

## Deploy to Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new)

Add all `.env.local` variables to your Vercel project's Environment Variables settings.

---

## Performance Design Principles

- **No backdrop-blur or heavy box-shadows** — flat borders (`border-zinc-800`) only
- **Canvas-based HUD** — hardware-accelerated 2D API, not SVG meshes
- **All images through Next.js `<Image>`** — automatic WebP/AVIF, lazy loading
- **Unsplash URLs compressed** — `?w=400&q=70&auto=format` on all CDN URLs
- **`contain: content`** on scrapbook grid — prevents full layout recalculation on scroll
- **GPS throttled** — watchPosition updates processed at max 1 per 3 seconds

---

*PinPic © 2026 — Curriculum and Lab Standards Curated by Prathamesh Sir*
