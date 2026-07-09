# PinPic — Build Walkthrough

A complete record of every major feature built and shipped across the PinPic PWA.

---

## Phase 11 — On-Demand Geosearch Cache & Grounded AI Vision Scoring

We implemented global coverage geosearch write-through caching and strict composition evaluation controls.

### Features Shipped:
1. **Multi-Source Geosearch Cache (`app/api/location/search/route.ts`)**:
   - Replaced fragile Apify scraper pipeline.
   - Primary: **Wikimedia Commons Geosearch** (5km radius). *Fixed bug where querying article pages instead of the File namespace (using `list=geosearch` instead of `generator=geosearch` with `ggsnamespace=6`) returned no image URLs (undefined `imageinfo`), resulting in empty results for all locations other than pre-seeded DB hotspots.*
   - Secondary Fallback: **Flickr API search** using `FLICKR_API_KEY`.
   - **Write-Through Caching**: Checked database hotspots within 25m. If not found, queried Wikimedia/Flickr and cached the best image into `public.hotspots` (bypassing RLS with `createAdminClient`, writing coordinates and `source` fields).
   - **Race Condition Prevention**: Added a secondary validation query to `nearby_hotspots` immediately before inserting to prevent concurrent duplicate rows.
   - **Zero-Photo Fallback**: Gracefully returned an empty list status `200` with a friendly "No public photos found here yet" message instead of throwing an exception or returning `undefined` to the camera UI.

2. **Grounded AI Vision Scoring (`app/api/process-shot/route.ts`)**:
   - **Guard Check**: Immediately blocks the execution and returns `400` status with `"No reference photo available yet for this location"` if `hotspotImageUrl` is empty, null, or a placeholder.
   - **Strict Prompting**: Forced the Groq Vision model to compare subject framing, position, horizon line tilt, and lighting matching.
   - **JSON Schema Mode**: Integrated strict API level `response_format: { type: "json_object" }` returning `{ score: number, strengths: string[], improvements: string[] }`.
   - **Retry-Once parsing**: Configured error try/catch wrappers around JSON parsing with a retry attempt to ensure malformed responses fail gracefully to safe baseline metrics.
   - **Low Temperature**: Restructured temperature setting to `0.1` for objective, deterministic comparisons.
   - **URL Auditing**: Stored the exact `reference_image_url` utilized for composition scoring in the database under `saved_shots` to simplify accuracy debugging.

3. **Graceful UI Alerts (`app/camera/page.tsx`)**:
   - Redesigned frontend capture catch handler to parse 400 JSON payloads from the processing endpoint, ensuring the camera hud successfully displays specific fallback instructions to the traveler.

---

## Build Status

```
✓ Compiled successfully
✓ Generating static pages (16/16)
✓ Zero type errors
```

| Route | Size | First Load JS |
|---|---|---|
| `/` | 4.25 kB | 100 kB |
| `/camera` | 7.54 kB | 114 kB |
| `/explore` | 2.78 kB | 184 kB |
| `/dashboard` | 116 kB | 297 kB |
| `/scrapbook` | 21.6 kB | 203 kB |

---

*PinPic © 2026*
