-- Migration 002: Add source to hotspots and reference_image_url to saved_shots

-- 1. Add source origin column to hotspots table
ALTER TABLE public.hotspots 
ADD COLUMN IF NOT EXISTS source text CHECK (source IN ('wikimedia', 'flickr', 'seed')) DEFAULT 'seed';
COMMENT ON COLUMN public.hotspots.source IS 'Source origin of this hotspot: wikimedia, flickr, or seed.';

-- 2. Add reference_image_url log to saved_shots table
ALTER TABLE public.saved_shots 
ADD COLUMN IF NOT EXISTS reference_image_url text;
COMMENT ON COLUMN public.saved_shots.reference_image_url IS 'The reference image URL used for AI composition scoring.';
