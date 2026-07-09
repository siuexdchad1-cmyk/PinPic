# PinPic — Build Walkthrough

A complete record of every major feature built and shipped across the PinPic PWA.

---

## Phase 12 — Progressive Geosearch Radius & Robust iOS Geolocation

We resolved location search text-matching issues by enforcing progressive GPS geosearch radius widening and outdoor-only content filters, and addressed mobile/deployed device geolocation initialization failures.

### Features Shipped:

1. **Progressive Geosearch Radius Widening (`app/api/location/search/route.ts`)**:
   - **Text fallback removal**: Never falls back to place-name text search (preventing irrelevant real estate listings or indoor photos from appearing).
   - **Dynamic Widening**: Tries `5km` first. If fewer than 10 outdoor results are found, it retries at `25km`, and finally `50km` if still thin.
   - **Flickr Radius Clamping**: Enforces `Math.min(radiusKm, 32)` constraints inside `fetchFlickrPhotos` to comply with Flickr API's maximum 32km limit.
   - **Flickr Outdoor Target**: Restricts search using `geo_context=2` to return only outdoor environments.
   - **Exclusion Keywords Filter**: Applies a strict exclusion list (`interior`, `inside`, `indoor`, `museum`, `room`, `ceiling`, `exhibit`, `hotel room`, `lobby`, etc.) at *every* radius tier, filtering titles and descriptions.
   - **Distance calculations**: Employs the Haversine formula to compute the exact distance (in meters) of each found photo from the user's current search coordinate.
   - **Empty state fallback**: Returns status `200` with an empty array `{ success: true, posts: [], message: "No outdoor inspo photos found near you yet" }` when no photos match at 50km.

2. **iOS & Deployed Geolocation Reliability (`components/camera/PermissionsWizard.tsx` & `app/camera/page.tsx`)**:
   - **Synchronous gesture handler**: Removed the `async` keyword wrapper on the button click handler (`requestGeolocation`), executing the native `navigator.geolocation.getCurrentPosition` in the same call stack to bypass iOS Safari's strict user-tap sandbox constraints.
   - **Device Signal Settings**: Standardized geolocation calls to use `{ enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }` to give devices a generous 15 seconds to lock onto GPS satellites.
   - **Explicit Error Parsing**: Catch and parse all three `GeolocationPositionError` codes (`PERMISSION_DENIED`, `POSITION_UNAVAILABLE`, `TIMEOUT`), displaying specific guidance in the camera diagnostics overlay and permission onboarding panels.
   - **PWA Stale Cache Busting (`next.config.js`)**: Configured next-pwa with `clientsClaim: true` and added a `NetworkFirst` routing rule for documents/navigation mode requests to prevent users from running cached old JS bundles and stale static pages.

3. **Dynamic Frontend Suggestion Tray (`app/camera/page.tsx`)**:
   - Displays exact distance badges (e.g., `~18.4km away` or `450m away`) on suggestion cards when the photo is located beyond the immediate vicinity (`distanceKm > 0.1`).
   - Renders a clean, friendly empty state showing the API's custom dynamic message when zero matching outdoor photos are returned.

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
| `/camera` | 8.25 kB | 114 kB |
| `/explore` | 2.78 kB | 184 kB |
| `/dashboard` | 116 kB | 297 kB |
| `/scrapbook` | 21.6 kB | 203 kB |

---

*PinPic © 2026*
