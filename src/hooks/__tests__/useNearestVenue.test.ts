import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { distanceKm, parseGps, pickNearest, useNearestVenue, NEARBY_RADIUS_KM } from '../useNearestVenue';

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
  });
});
