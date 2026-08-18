export interface LocationFix {
  latitude:  number;
  longitude: number;
  city?:     string;
  source:    'gps' | 'ip' | 'default';
}

const DEFAULT_MUMBAI: LocationFix = {
  latitude:  19.076,
  longitude: 72.877,
  city:      'Mumbai',
  source:    'default',
};

/**
 * 3-Tier Bulletproof Location Resolver:
 * 1. Try Browser Geolocation API (Device GPS/Wi-Fi)
 * 2. Fallback to IP-based Geolocation (ipapi.co / ip-api.com - zero permissions required)
 * 3. Fallback to default coordinates (Mumbai)
 */
export async function getSmartLocation(): Promise<LocationFix> {
  // 1. Try Browser GPS
  if ('geolocation' in navigator) {
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: false,
          timeout: 6000,
          maximumAge: 60000,
        });
      });

      return {
        latitude:  position.coords.latitude,
        longitude: position.coords.longitude,
        source:    'gps',
      };
    } catch (gpsErr) {
      console.warn('[SmartLocation] GPS permission denied or timed out. Falling back to IP Geolocation...', gpsErr);
    }
  }

  // 2. Try IP Geolocation (Zero permission prompt required!)
  try {
    const res = await fetch('https://ipapi.co/json/', { signal: AbortSignal.timeout(4000) });
    if (res.ok) {
      const data = await res.json();
      if (data.latitude && data.longitude) {
        return {
          latitude:  data.latitude,
          longitude: data.longitude,
          city:      data.city || data.region || 'Local Area',
          source:    'ip',
        };
      }
    }
  } catch (ipErr) {
    console.warn('[SmartLocation] IP Geolocation failed. Using default location.', ipErr);
  }

  // 3. Fallback to Default
  return DEFAULT_MUMBAI;
}
