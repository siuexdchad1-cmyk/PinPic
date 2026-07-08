/**
 * PinPic — Shared TypeScript Type Definitions
 * Mirrors the Supabase database schema exactly.
 * All server and client components import types from this file.
 */

// ---------------------------------------------------------------------------
// Database entity types (mirror supabase/migrations/001_init.sql)
// ---------------------------------------------------------------------------

export interface Profile {
  id: string;
  username: string;
  avatar_url: string | null;
  created_at: string;
}

export interface Hotspot {
  id: string;
  title: string;
  description: string | null;
  /** PostGIS geography point — stored as WKB in DB, returned as GeoJSON or string */
  location: string;
  inspo_image_url: string;
  license_source: string;
  created_at: string;
}

/** Extended hotspot with distance, returned by nearby_hotspots RPC */
export interface NearbyHotspot extends Hotspot {
  distance_m: number;
}

export interface SavedShot {
  id: string;
  user_id: string;
  hotspot_id: string | null;
  captured_image_url: string;
  match_accuracy: number | null;
  ai_caption: string | null;
  tags: string[] | null;
  created_at: string;
  /** Joined hotspot data — available when fetched with select('*, hotspots(*)') */
  hotspots?: Pick<Hotspot, 'id' | 'title' | 'description' | 'inspo_image_url'> | null;
}

// ---------------------------------------------------------------------------
// API request / response shapes
// ---------------------------------------------------------------------------

/** POST /api/process-shot */
export interface ProcessShotRequest {
  imageBase64: string;       // captured frame as data:image/jpeg;base64,...
  hotspotImageUrl: string;   // reference inspiration image from hotspot
  hotspotId: string;
}

/** POST /api/process-shot — response */
export interface ProcessShotResponse {
  matchAccuracy: number;
  adjustments: string[];
  caption: string;
  tags: string[];
  savedShotId: string;
}

/** GET /api/hotspots/nearby?lat=&lng=&radius= */
export interface NearbyHotspotsResponse {
  hotspots: NearbyHotspot[];
}

/** POST /api/email/welcome */
export interface WelcomeEmailRequest {
  email: string;
  username: string;
}

/** POST /api/email/milestone */
export interface MilestoneEmailRequest {
  email: string;
  username: string;
  matchAccuracy: number;
  hotspotTitle: string;
}

// ---------------------------------------------------------------------------
// Groq AI response schemas
// ---------------------------------------------------------------------------

/** Structured JSON returned by the Groq Vision model */
export interface GroqVisionResult {
  match_accuracy_percentage: number;
  adjustments: string[];
  composition_notes: string;
}

/** Structured JSON returned by the Groq Text model */
export interface GroqCaptionResult {
  caption: string;
  tags: string[];
  story_hook: string;
}

// ---------------------------------------------------------------------------
// GPS / Geolocation
// ---------------------------------------------------------------------------

export interface GpsCoordinates {
  latitude: number;
  longitude: number;
  accuracy: number;
}

// ---------------------------------------------------------------------------
// Camera / HUD states
// ---------------------------------------------------------------------------

export type CameraState =
  | 'idle'
  | 'requesting-permissions'
  | 'streaming'
  | 'hotspot-found'
  | 'capturing'
  | 'processing'
  | 'result'
  | 'error';

// ---------------------------------------------------------------------------
// Dashboard analytics
// ---------------------------------------------------------------------------

export interface AccuracyDataPoint {
  date: string;         // formatted date label for X-axis
  accuracy: number;     // match_accuracy value
}

export interface HotspotEngagementPoint {
  title: string;        // hotspot title for Y-axis
  count: number;        // number of captures at this hotspot
}

// ---------------------------------------------------------------------------
// Supabase Database generic type helper
// ---------------------------------------------------------------------------

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: Omit<Profile, 'created_at'>;
        Update: Partial<Omit<Profile, 'id'>>;
      };
      hotspots: {
        Row: Hotspot;
        Insert: Omit<Hotspot, 'id' | 'created_at'>;
        Update: Partial<Omit<Hotspot, 'id'>>;
      };
      saved_shots: {
        Row: SavedShot;
        Insert: Omit<SavedShot, 'id' | 'created_at' | 'hotspots'>;
        Update: Partial<Omit<SavedShot, 'id' | 'user_id' | 'hotspots'>>;
      };
    };
    Functions: {
      nearby_hotspots: {
        Args: { lat: number; lng: number; radius_m?: number };
        Returns: NearbyHotspot[];
      };
    };
  };
}
