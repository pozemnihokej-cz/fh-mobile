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

export function pickNearest(
  venues: readonly VenueLike[],
  lat: number,
  lon: number,
): { name: string; km: number } | null {
  let best: { name: string; km: number } | null = null;
  for (const v of venues) {
    const coords = parseGps(v.gps);
    if (!coords) continue;
    const km = distanceKm(lat, lon, coords[0], coords[1]);
    if (!best || km < best.km) best = { name: v.name, km };
  }
  return best;
}

export function useNearestVenue(venues: readonly VenueLike[]): {
  nearestVenueName: string | null;
  status: NearestVenueStatus;
} {
  const [nearestVenueName, setNearestVenueName] = useState<string | null>(null);
  const [status, setStatus] = useState<NearestVenueStatus>('idle');
  const settled = useRef(false);

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
        const best = pickNearest(venues, pos.coords.latitude, pos.coords.longitude);
        if (best && best.km <= NEARBY_RADIUS_KM) {
          setNearestVenueName(best.name);
          setStatus('found');
        } else {
          setNearestVenueName(null);
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
  }, [venues, withCoords]);

  return { nearestVenueName, status };
}
