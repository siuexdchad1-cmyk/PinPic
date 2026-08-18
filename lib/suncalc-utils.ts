import * as SunCalc from 'suncalc';

export interface GoldenHourTimes {
  sunrise:       string;
  goldenHour:    string;
  solarNoon:     string;
  goldenHourEnd: string;
  sunset:        string;
  blueHour:      string;
  night:         string;
}

function fmt(date: Date | null | undefined): string {
  if (!date || isNaN(date.getTime())) return 'N/A';
  return date.toLocaleTimeString('en-IN', {
    hour:   '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

export function getGoldenHourTimes(lat: number, lng: number): GoldenHourTimes {
  const now   = new Date();
  const times = SunCalc.getTimes(now, lat, lng);

  return {
    sunrise:       fmt(times.sunrise),
    goldenHour:    fmt(times.goldenHourEnd),   // morning golden ends
    solarNoon:     fmt(times.solarNoon),
    goldenHourEnd: fmt(times.goldenHour),     // evening golden starts
    sunset:        fmt(times.sunset),
    blueHour:      fmt(times.nauticalDusk),
    night:         fmt(times.night),
  };
}

export function isCurrentlyGoldenHour(lat: number, lng: number): boolean {
  const now   = new Date();
  const times = SunCalc.getTimes(now, lat, lng);
  const t     = now.getTime();
  const morningGolden = times.sunrise && times.goldenHourEnd && t >= times.sunrise.getTime() && t <= times.goldenHourEnd.getTime();
  const eveningGolden = times.goldenHour && times.sunset && t >= times.goldenHour.getTime() && t <= times.sunset.getTime();
  return Boolean(morningGolden || eveningGolden);
}
