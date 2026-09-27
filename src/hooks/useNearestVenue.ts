import { useEffect, useRef, useState } from 'react';

/** Kilometres between two WGS84 points (haversine). */
export function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** 500 METRES threshold to consider a venue "nearby". */
export const NEARBY_RADIUS_KM = 0.5;

export type SeasonType = 'outdoor' | 'indoor';

export type NearestVenueStatus =
  | 'idle'
  | 'locating'
  | 'found'
  | 'too-far'
  | 'no-venue-coords'
  | 'denied'
  | 'unavailable';

export interface VenueLike {
  name: string;
  gps?: string | null;
  surfaceType?: string | null;
}

export interface NearbyVenue {
  name: string;
  km: number;
  isHall: boolean;
}

/** Check if a venue is an indoor hall. */
export function isHallVenue(venue: VenueLike | string | null | undefined): boolean {
  if (!venue) return false;
  if (typeof venue !== 'string') {
    if (venue.surfaceType === 'indoor') return true;
    if (venue.surfaceType && ['water_based', 'sand_based', 'dry_synthetic', 'outdoor'].includes(venue.surfaceType)) {
      return false;
    }
  }
  const name = typeof venue === 'string' ? venue : venue.name;
  if (!name) return false;
  return /\b(hala|sh|tělocvična|telocvicna|arena|aréna)\b/i.test(name);
}

/**
 * Determine the active hockey season.
 * Field hockey in Czechia operates in two main seasons:
 * - Outdoor (venku): April to October (months 3..9)
 * - Indoor (hala): November to March (months 10..11, 0..2)
 *
 * If active matches on the date/view are provided, their venues are also evaluated.
 */
export function resolveSeason(options?: {
  date?: Date | number | null;
  matches?: readonly { venue?: string; location?: string }[] | null;
  season?: SeasonType;
}): SeasonType {
  if (options?.season) return options.season;

  if (options?.matches && options.matches.length > 0) {
    let outdoorCount = 0;
    let indoorCount = 0;
    for (const m of options.matches) {
      const v = m.venue ?? m.location;
      if (!v) continue;
      if (isHallVenue(v)) indoorCount++;
      else outdoorCount++;
    }
    if (outdoorCount > 0 && indoorCount === 0) return 'outdoor';
    if (indoorCount > 0 && outdoorCount === 0) return 'indoor';
    if (outdoorCount > indoorCount) return 'outdoor';
    if (indoorCount > outdoorCount) return 'indoor';
  }

  const d = options?.date ? new Date(options.date) : new Date();
  const m = d.getMonth();
  // Months 3 (April) through 9 (October) are outdoor season.
  return m >= 3 && m <= 9 ? 'outdoor' : 'indoor';
}

/** `"50.1084, 14.4869"` → `[lat, lon]`, or null when unusable. */
export function parseGps(gps: string | null | undefined): [number, number] | null {
  if (!gps) return null;
  const parts = gps.split(',').map((p) => parseFloat(p.trim()));
  if (parts.length !== 2) return null;
  const [lat, lon] = parts;
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return null;
  return [lat, lon];
}

/**
 * Return all venues within radiusKm, sorted by season priority and distance.
 * In outdoor season: outdoor pitches come before indoor halls.
 * In indoor season: indoor halls come before outdoor pitches.
 */
export function findNearbyVenues(
  venues: readonly VenueLike[],
  lat: number,
  lon: number,
  radiusKm = NEARBY_RADIUS_KM,
  season: SeasonType = 'outdoor',
): NearbyVenue[] {
  const nearby: NearbyVenue[] = [];
  for (const v of venues) {
    const coords = parseGps(v.gps);
    if (!coords) continue;
    const km = distanceKm(lat, lon, coords[0], coords[1]);
    if (km <= radiusKm) {
      nearby.push({ name: v.name, km, isHall: isHallVenue(v) });
    }
  }

  nearby.sort((a, b) => {
    if (season === 'outdoor') {
      if (!a.isHall && b.isHall) return -1;
      if (a.isHall && !b.isHall) return 1;
    } else {
      if (a.isHall && !b.isHall) return -1;
      if (!a.isHall && b.isHall) return 1;
    }
    return a.km - b.km;
  });

  return nearby;
}

export function pickNearest(
  venues: readonly VenueLike[],
  lat: number,
  lon: number,
  season: SeasonType = 'outdoor',
): { name: string; km: number; isHall?: boolean } | null {
  const nearby = findNearbyVenues(venues, lat, lon, NEARBY_RADIUS_KM, season);
  if (nearby.length > 0) {
    return nearby[0];
  }

  let best: { name: string; km: number; isHall?: boolean } | null = null;
  for (const v of venues) {
    const coords = parseGps(v.gps);
    if (!coords) continue;
    const km = distanceKm(lat, lon, coords[0], coords[1]);
    if (!best || km < best.km) best = { name: v.name, km, isHall: isHallVenue(v) };
  }
  return best;
}

export function useNearestVenue(
  venues: readonly VenueLike[],
  options?: {
    date?: Date | number | null;
    matches?: readonly { venue?: string; location?: string }[] | null;
    season?: SeasonType;
  },
): {
  nearestVenueName: string | null;
  nearbyVenues: readonly NearbyVenue[];
  status: NearestVenueStatus;
  season: SeasonType;
} {
  const [nearestVenueName, setNearestVenueName] = useState<string | null>(null);
  const [nearbyVenues, setNearbyVenues] = useState<readonly NearbyVenue[]>([]);
  const [status, setStatus] = useState<NearestVenueStatus>('idle');
  const settled = useRef(false);

  const activeSeason = resolveSeason(options);
  const withCoords = venues.filter((v) => parseGps(v.gps) !== null).length;

  useEffect(() => {
    if (venues.length === 0 || settled.current) return;

    if (withCoords === 0) {
      settled.current = true;
      setStatus('no-venue-coords');
      return;
    }

    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      settled.current = true;
      setStatus('unavailable');
      return;
    }

    setStatus('locating');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (settled.current) return;
        settled.current = true;
        const nearby = findNearbyVenues(
          venues,
          pos.coords.latitude,
          pos.coords.longitude,
          NEARBY_RADIUS_KM,
          activeSeason,
        );
        if (nearby.length > 0) {
          setNearestVenueName(nearby[0].name);
          setNearbyVenues(nearby);
          setStatus('found');
        } else {
          setNearestVenueName(null);
          setNearbyVenues([]);
          setStatus('too-far');
        }
      },
      (err) => {
        if (settled.current) return;
        settled.current = true;
        setStatus(err && err.code === 1 ? 'denied' : 'unavailable');
      },
      { enableHighAccuracy: false, timeout: 10000 },
    );
  }, [venues, withCoords, activeSeason]);

  return { nearestVenueName, nearbyVenues, status, season: activeSeason };
}
