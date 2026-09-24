import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import {
  distanceKm,
  parseGps,
  pickNearest,
  findNearbyVenues,
  isHallVenue,
  resolveSeason,
  useNearestVenue,
  NEARBY_RADIUS_KM,
} from '../useNearestVenue';

describe('useNearestVenue helpers', () => {
  it('calculates distanceKm with Haversine formula correctly', () => {
    // Prague to Brno is ~185-190 km
    const d = distanceKm(50.0755, 14.4378, 49.1951, 16.6068);
    expect(d).toBeGreaterThan(180);
    expect(d).toBeLessThan(200);
  });

  it('parses valid GPS string', () => {
    expect(parseGps('50.1084, 14.4869')).toEqual([50.1084, 14.4869]);
    expect(parseGps('invalid')).toBeNull();
    expect(parseGps('')).toBeNull();
    expect(parseGps(undefined)).toBeNull();
    expect(parseGps('100.0, 14.0')).toBeNull(); // out of range lat
  });

  it('pickNearest finds closest venue', () => {
    const venues = [
      { name: 'Slavia', gps: '50.0689, 14.4756' },
      { name: 'Hostivar', gps: '50.0521, 14.5367' },
    ];
    // Standing near Slavia
    const nearSlavia = pickNearest(venues, 50.0690, 14.4757);
    expect(nearSlavia?.name).toBe('Slavia');
    expect(nearSlavia?.km).toBeLessThan(0.1);
  });
});

describe('TEST-002: isHallVenue helper in mobile', () => {
  it('identifies hall by surfaceType === "indoor"', () => {
    expect(isHallVenue({ name: 'Club Complex', surfaceType: 'indoor' })).toBe(true);
    expect(isHallVenue({ name: 'Turf Pitch', surfaceType: 'water_based' })).toBe(false);
  });

  it('identifies hall by name patterns', () => {
    expect(isHallVenue('Hala TJ Sokol Kbely')).toBe(true);
    expect(isHallVenue('Sportovní hala Eden')).toBe(true);
    expect(isHallVenue('SH Slavia')).toBe(true);
    expect(isHallVenue('UNYP Arena')).toBe(true);
    expect(isHallVenue('Hřiště Eden')).toBe(false);
    expect(isHallVenue('TJ Sokol Kbely')).toBe(false);
  });
});

describe('TEST-004: resolveSeason helper in mobile', () => {
  it('identifies outdoor months (April-October)', () => {
    expect(resolveSeason({ date: new Date(2026, 3, 1) })).toBe('outdoor');
    expect(resolveSeason({ date: new Date(2026, 8, 24) })).toBe('outdoor');
    expect(resolveSeason({ date: new Date(2026, 9, 31) })).toBe('outdoor');
  });

  it('identifies indoor months (November-March)', () => {
    expect(resolveSeason({ date: new Date(2026, 10, 1) })).toBe('indoor');
    expect(resolveSeason({ date: new Date(2027, 0, 15) })).toBe('indoor');
    expect(resolveSeason({ date: new Date(2027, 2, 28) })).toBe('indoor');
  });

  it('detects season from active matches', () => {
    expect(resolveSeason({ matches: [{ venue: 'Hřiště Eden' }] })).toBe('outdoor');
    expect(resolveSeason({ matches: [{ venue: 'Hala Eden' }] })).toBe('indoor');
  });
});

describe('TEST-006: outdoor season disambiguation in mobile', () => {
  it('prioritizes outdoor pitch over hall and includes both in nearbyVenues in outdoor season', () => {
    const venues = [
      { name: 'Hala Slavia', gps: '50.068520, 14.478910' },
      { name: 'Hřiště Slavia', gps: '50.068773, 14.472341' },
    ];
    // Standing at pitch coordinates
    const nearby = findNearbyVenues(venues, 50.068773, 14.472341, 0.5, 'outdoor');
    expect(nearby.length).toBe(2);
    expect(nearby[0].name).toBe('Hřiště Slavia');
    expect(nearby[0].isHall).toBe(false);
    expect(nearby[1].name).toBe('Hala Slavia');
    expect(nearby[1].isHall).toBe(true);

    const best = pickNearest(venues, 50.068773, 14.472341, 'outdoor');
    expect(best?.name).toBe('Hřiště Slavia');
  });

  it('prioritizes hall over outdoor pitch in indoor season', () => {
    const venues = [
      { name: 'Hřiště Slavia', gps: '50.068773, 14.472341' },
      { name: 'Hala Slavia', gps: '50.068520, 14.478910' },
    ];
    // Standing at hall coordinates
    const nearby = findNearbyVenues(venues, 50.068520, 14.478910, 0.5, 'indoor');
    expect(nearby.length).toBe(2);
    expect(nearby[0].name).toBe('Hala Slavia');
    expect(nearby[0].isHall).toBe(true);
    expect(nearby[1].name).toBe('Hřiště Slavia');

    const best = pickNearest(venues, 50.068520, 14.478910, 'indoor');
    expect(best?.name).toBe('Hala Slavia');
  });
});

describe('useNearestVenue hook', () => {
  const origNavigator = global.navigator;

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns no-venue-coords when venues list has no usable GPS', () => {
    const venues = [{ name: 'Field without GPS', gps: null }];
    const { result } = renderHook(() => useNearestVenue(venues));
    expect(result.current.status).toBe('no-venue-coords');
    expect(result.current.nearestVenueName).toBeNull();
  });

  it('detects nearest venue within 500m threshold', () => {
    const venues = [{ name: 'Areál Eden', gps: '50.0689, 14.4756' }];
    const mockGeolocation = {
      getCurrentPosition: vi.fn().mockImplementation((success) => {
        success({
          coords: {
            latitude: 50.0690,
            longitude: 14.4757,
          },
        });
      }),
    };

    vi.stubGlobal('navigator', {
      ...origNavigator,
      geolocation: mockGeolocation,
    });

    const { result } = renderHook(() => useNearestVenue(venues));
    expect(result.current.status).toBe('found');
    expect(result.current.nearestVenueName).toBe('Areál Eden');
    expect(result.current.nearbyVenues.length).toBe(1);
  });

  it('returns too-far when user is outside 500m', () => {
    const venues = [{ name: 'Areál Eden', gps: '50.0689, 14.4756' }];
    const mockGeolocation = {
      getCurrentPosition: vi.fn().mockImplementation((success) => {
        success({
          coords: {
            latitude: 49.0000,
            longitude: 16.0000,
          },
        });
      }),
    };

    vi.stubGlobal('navigator', {
      ...origNavigator,
      geolocation: mockGeolocation,
    });

    const { result } = renderHook(() => useNearestVenue(venues));
    expect(result.current.status).toBe('too-far');
    expect(result.current.nearestVenueName).toBeNull();
    expect(result.current.nearbyVenues.length).toBe(0);
  });
});
