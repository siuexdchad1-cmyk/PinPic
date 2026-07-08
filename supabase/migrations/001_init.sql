-- =============================================================================
-- PInPic — Database Migration 001: Full Schema Initialization
-- Curriculum and Lab Standards Curated by Prathamesh Sir
-- =============================================================================
-- Run this entire script inside:
--   Supabase Dashboard → SQL Editor → New query → Paste → Run
-- Prerequisites:
--   PostGIS extension must be enabled BEFORE running this script.
--   Enable it at: Database → Extensions → postgis → Enable
-- =============================================================================

-- ---------------------------------------------------------------------------
-- STEP 1: Enable PostGIS spatial extension
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS postgis;

-- ---------------------------------------------------------------------------
-- STEP 2: Table — profiles
-- One row per authenticated user. Created automatically on signup via trigger.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id         uuid        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username   text        UNIQUE NOT NULL,
  avatar_url text,
  created_at timestamptz DEFAULT now() NOT NULL
);

COMMENT ON TABLE public.profiles IS
  'Extended user profile data linked to Supabase Auth. Auto-populated on signup.';

-- ---------------------------------------------------------------------------
-- STEP 3: Table — hotspots
-- Geographic photo composition spots seeded by admins. Any GPS location on Earth.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.hotspots (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  title          text        NOT NULL,
  description    text,
  location       geography(Point, 4326) NOT NULL,
  inspo_image_url text       NOT NULL,
  license_source text        DEFAULT 'Unsplash-Open-Asset',
  created_at     timestamptz DEFAULT now() NOT NULL
);

COMMENT ON TABLE public.hotspots IS
  'Global GPS-tagged composition hotspots. Any trackable coordinate on Earth is valid.';
COMMENT ON COLUMN public.hotspots.location IS
  'PostGIS geography point: SRID 4326 (WGS 84 — standard GPS coordinate system).';
COMMENT ON COLUMN public.hotspots.inspo_image_url IS
  'Reference inspiration image URL (Unsplash CDN). Append ?w=400&q=70&auto=format for mobile optimization.';

-- ---------------------------------------------------------------------------
-- STEP 4: Table — saved_shots
-- Individual captures by users at hotspot locations, with AI analysis results.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.saved_shots (
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  hotspot_id         uuid        REFERENCES public.hotspots(id) ON DELETE SET NULL,
  captured_image_url text        NOT NULL,
  match_accuracy     integer     CHECK (match_accuracy >= 0 AND match_accuracy <= 100),
  ai_caption         text,
  tags               text[],
  created_at         timestamptz DEFAULT now() NOT NULL
);

COMMENT ON TABLE public.saved_shots IS
  'User-captured photos with Groq AI composition analysis results.';
COMMENT ON COLUMN public.saved_shots.match_accuracy IS
  'Composition match percentage (0-100) returned by Groq Vision model.';
COMMENT ON COLUMN public.saved_shots.tags IS
  'AI-generated hashtag array for Instagram / YouTube Shorts / Facebook Reels.';

-- ---------------------------------------------------------------------------
-- STEP 5: Spatial GiST Index on hotspots.location
-- Enables fast ST_DWithin proximity queries across all global hotspots.
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS hotspots_geo_gist_idx
  ON public.hotspots
  USING gist(location);

-- Standard B-tree index for created_at queries on saved_shots
CREATE INDEX IF NOT EXISTS saved_shots_user_created_idx
  ON public.saved_shots(user_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- STEP 6: Row Level Security (RLS) — Enable on ALL tables
-- ---------------------------------------------------------------------------
ALTER TABLE public.profiles   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hotspots   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_shots ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- STEP 7: RLS Policies — profiles
-- ---------------------------------------------------------------------------

-- Users can read their own profile
CREATE POLICY "profiles_select_own"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

-- Users can insert their own profile row (signup flow)
CREATE POLICY "profiles_insert_own"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "profiles_update_own"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Service role can do everything (bypasses RLS automatically, but explicit for clarity)
-- No additional policy needed — service role bypasses RLS by design in Supabase.

-- ---------------------------------------------------------------------------
-- STEP 8: RLS Policies — hotspots
-- Public read access (anyone, even unauthenticated, can query hotspots for the map)
-- Write access restricted to service role only (admin seeding via dashboard/API)
-- ---------------------------------------------------------------------------

-- Any visitor (authenticated or not) can read hotspots — required for map and proximity check
CREATE POLICY "hotspots_select_public"
  ON public.hotspots FOR SELECT
  USING (true);

-- INSERT: blocked for all regular users; only service_role (RLS bypass) may insert
CREATE POLICY "hotspots_insert_service_role_only"
  ON public.hotspots FOR INSERT
  WITH CHECK (false);

-- UPDATE: blocked for all regular users
CREATE POLICY "hotspots_update_service_role_only"
  ON public.hotspots FOR UPDATE
  USING (false);

-- DELETE: blocked for all regular users
CREATE POLICY "hotspots_delete_service_role_only"
  ON public.hotspots FOR DELETE
  USING (false);

-- ---------------------------------------------------------------------------
-- STEP 9: RLS Policies — saved_shots
-- ---------------------------------------------------------------------------

-- Users can read only their own saved shots
CREATE POLICY "saved_shots_select_own"
  ON public.saved_shots FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own shots
CREATE POLICY "saved_shots_insert_own"
  ON public.saved_shots FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own shots (caption, tags edits)
CREATE POLICY "saved_shots_update_own"
  ON public.saved_shots FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own shots
CREATE POLICY "saved_shots_delete_own"
  ON public.saved_shots FOR DELETE
  USING (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- STEP 10: Auto-create profile row on new user signup (trigger)
-- Fires after a new row is inserted into auth.users
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, username, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$;

-- Drop existing trigger if re-running this migration
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ---------------------------------------------------------------------------
-- STEP 11: Helper RPC function — nearby_hotspots
-- Called by /api/hotspots/nearby to find hotspots within a radius (meters)
-- from a given GPS coordinate. Supports any point on Earth.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.nearby_hotspots(
  lat      double precision,
  lng      double precision,
  radius_m double precision DEFAULT 15.0
)
RETURNS TABLE (
  id              uuid,
  title           text,
  description     text,
  inspo_image_url text,
  license_source  text,
  distance_m      double precision
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    h.id,
    h.title,
    h.description,
    h.inspo_image_url,
    h.license_source,
    ST_Distance(
      h.location::geography,
      ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography
    ) AS distance_m
  FROM public.hotspots h
  WHERE ST_DWithin(
    h.location::geography,
    ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography,
    radius_m
  )
  ORDER BY distance_m ASC;
$$;

COMMENT ON FUNCTION public.nearby_hotspots IS
  'Returns all hotspots within radius_m meters of the given GPS coordinate.
   Uses PostGIS ST_DWithin with the spatial GiST index for O(log n) performance.
   Works for any coordinate on Earth — no geographic restrictions.';

-- ---------------------------------------------------------------------------
-- STEP 12: Sample hotspot seed data (global examples — admins add more via dashboard)
-- Any GPS location on Earth is valid. Add unlimited rows here or via dashboard.
-- ---------------------------------------------------------------------------
INSERT INTO public.hotspots (title, description, location, inspo_image_url, license_source)
VALUES
  (
    'Eiffel Tower — Trocadéro Viewpoint',
    'Classic symmetrical framing of the Eiffel Tower from the Trocadéro esplanade. Stand at the center axis for perfect alignment.',
    ST_SetSRID(ST_MakePoint(2.2885, 48.8614), 4326)::geography,
    'https://images.unsplash.com/photo-1543349689-9a4d426bee8e?w=400&q=70&auto=format',
    'Unsplash-Open-Asset'
  ),
  (
    'Taj Mahal — Central Gateway',
    'Iconic symmetrical shot through the main gateway arch with the Taj Mahal perfectly centered in the frame.',
    ST_SetSRID(ST_MakePoint(78.0421, 27.1751), 4326)::geography,
    'https://images.unsplash.com/photo-1564507592333-c60657eea523?w=400&q=70&auto=format',
    'Unsplash-Open-Asset'
  ),
  (
    'Santorini — Oia Blue Domes',
    'Golden-hour composition with the iconic white-washed buildings and blue-domed churches of Oia.',
    ST_SetSRID(ST_MakePoint(25.3753, 36.4618), 4326)::geography,
    'https://images.unsplash.com/photo-1570077188670-e3a8d69ac5ff?w=400&q=70&auto=format',
    'Unsplash-Open-Asset'
  ),
  (
    'Grand Canyon — South Rim Mather Point',
    'Panoramic composition from Mather Point with layered canyon walls filling the lower two-thirds of the frame.',
    ST_SetSRID(ST_MakePoint(-112.1129, 36.0544), 4326)::geography,
    'https://images.unsplash.com/photo-1474044159687-1ee9f3a51722?w=400&q=70&auto=format',
    'Unsplash-Open-Asset'
  ),
  (
    'Colosseum — Via Sacra Approach',
    'Low-angle shot from the Via Sacra approach capturing the Colosseum''s full elliptical grandeur.',
    ST_SetSRID(ST_MakePoint(12.4922, 41.8902), 4326)::geography,
    'https://images.unsplash.com/photo-1552832230-c0197dd311b5?w=400&q=70&auto=format',
    'Unsplash-Open-Asset'
  ),
  (
    'Machu Picchu — Sun Gate',
    'Classic terraced ruins composition from the Sun Gate (Inti Punku) with Huayna Picchu peak behind.',
    ST_SetSRID(ST_MakePoint(-72.5450, -13.1631), 4326)::geography,
    'https://images.unsplash.com/photo-1526392060635-9d6019884377?w=400&q=70&auto=format',
    'Unsplash-Open-Asset'
  ),
  (
    'Tokyo — Shibuya Crossing Aerial',
    'Overhead composition capturing the organized chaos of Shibuya Crossing at peak pedestrian flow.',
    ST_SetSRID(ST_MakePoint(139.7003, 35.6595), 4326)::geography,
    'https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=400&q=70&auto=format',
    'Unsplash-Open-Asset'
  ),
  (
    'New York — Brooklyn Bridge Walkway',
    'Central-perspective shot walking the Brooklyn Bridge with the Manhattan skyline framed in the background.',
    ST_SetSRID(ST_MakePoint(-73.9969, 40.7061), 4326)::geography,
    'https://images.unsplash.com/photo-1534430480872-3498386e7856?w=400&q=70&auto=format',
    'Unsplash-Open-Asset'
  ),
  (
    'Petra — Treasury Al-Khazneh',
    'Walk through the Siq canyon and capture the Treasury facade as it reveals itself in the narrow canyon opening.',
    ST_SetSRID(ST_MakePoint(35.4444, 30.3285), 4326)::geography,
    'https://images.unsplash.com/photo-1579606032821-4e6161c81bd3?w=400&q=70&auto=format',
    'Unsplash-Open-Asset'
  ),
  (
    'Sydney Opera House — Circular Quay',
    'Three-quarter composition of the Opera House shells from Circular Quay with the Harbour Bridge as backdrop.',
    ST_SetSRID(ST_MakePoint(151.2153, -33.8568), 4326)::geography,
    'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400&q=70&auto=format',
    'Unsplash-Open-Asset'
  )
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- MIGRATION COMPLETE
-- ---------------------------------------------------------------------------
-- To add more hotspots for any GPS location on Earth, run:
--   INSERT INTO public.hotspots (title, description, location, inspo_image_url)
--   VALUES (
--     'Your Spot Name',
--     'Composition description',
--     ST_SetSRID(ST_MakePoint(<longitude>, <latitude>), 4326)::geography,
--     'https://images.unsplash.com/photo-<id>?w=400&q=70&auto=format'
--   );
-- Note: ST_MakePoint takes LONGITUDE first, then LATITUDE.
-- =============================================================================
