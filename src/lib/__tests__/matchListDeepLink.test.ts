/**
 * PRD-072 / spec-fan-match-list-venue-league-and-maps — the deep-link contract of the fan match list and the
 * Google Maps destination of a venue.
 */
import { describe, it, expect } from 'vitest';
import {
  buildMatchListHref,
  readMatchListDeepLink,
  resolveMatchListDeepLink,
  googleMapsDirectionsHref,
} from '../matchListDeepLink';

describe('buildMatchListHref', () => {
  it('links a venue by its stable id', () => {
    expect(buildMatchListHref('e2e-test', { venueId: 'v-1', venueName: 'Hřiště Eden' })).toBe(
      '/e2e-test/matches?venue=v-1',
    );
  });

  it('links a competition by its stable id', () => {
    expect(buildMatchListHref('e2e-test', { leagueId: 'l-9', leagueName: 'Extraliga' })).toBe(
      '/e2e-test/matches?league=l-9',
    );
  });

  it('falls back to the URL-encoded display name when there is no id', () => {
    expect(buildMatchListHref('e2e-test', { venueName: 'Hřiště & Eden / B' })).toBe(
      '/e2e-test/matches?venueName=H%C5%99i%C5%A1t%C4%9B+%26+Eden+%2F+B',
    );
    expect(buildMatchListHref('e2e-test', { leagueName: '  Starší žáci ' })).toBe(
      '/e2e-test/matches?leagueName=Star%C5%A1%C3%AD+%C5%BE%C3%A1ci',
    );
  });

  it('encodes the tenant slug and returns null when nothing identifies a filter', () => {
    expect(buildMatchListHref('a b', { venueId: 'x' })).toBe('/a%20b/matches?venue=x');
    expect(buildMatchListHref('e2e-test', { venueName: '   ' })).toBeNull();
    expect(buildMatchListHref('e2e-test', {})).toBeNull();
    expect(buildMatchListHref(null, { venueId: 'x' })).toBeNull();
  });
});

describe('readMatchListDeepLink', () => {
  it('reads the four parameters and ignores everything else', () => {
    expect(readMatchListDeepLink(new URLSearchParams('venue=v-1&foo=bar'))).toEqual({ venueId: 'v-1' });
    expect(readMatchListDeepLink(new URLSearchParams('leagueName=Extraliga'))).toEqual({ leagueName: 'Extraliga' });
    expect(readMatchListDeepLink(new URLSearchParams('foo=bar'))).toBeNull();
    expect(readMatchListDeepLink(new URLSearchParams('venue='))).toBeNull();
  });
});

const ROWS = [
  { venueId: 'v-1', location: ' Hřiště Eden ', leagueId: 'l-9', leagueName: 'Extraliga' },
  { venueId: 'v-2', location: 'Kbely', leagueId: 'l-3', leagueName: 'Dorostenci' },
  { venueId: null, location: 'Bez id', leagueId: null, leagueName: null },
];

describe('resolveMatchListDeepLink', () => {
  it('maps a venue id to the option name the list filters by, and resets the other filters', () => {
    expect(resolveMatchListDeepLink({ venueId: 'v-1' }, ROWS)).toEqual({ venue: 'Hřiště Eden', league: 'all', team: 'all' });
  });

  it('maps a league id to its name', () => {
    expect(resolveMatchListDeepLink({ leagueId: 'l-3' }, ROWS)).toEqual({ venue: 'all', league: 'Dorostenci', team: 'all' });
  });

  it('accepts a name only when it is one of the options', () => {
    expect(resolveMatchListDeepLink({ venueName: 'Bez id' }, ROWS)).toEqual({ venue: 'Bez id', league: 'all', team: 'all' });
    expect(resolveMatchListDeepLink({ venueName: 'Neexistuje' }, ROWS)).toEqual({ venue: 'all', league: 'all', team: 'all' });
  });

  it('falls back to all for an unknown id (another tenant, or no match in the loaded window)', () => {
    expect(resolveMatchListDeepLink({ venueId: 'v-404', leagueId: 'l-404' }, ROWS)).toEqual({
      venue: 'all',
      league: 'all',
      team: 'all',
    });
  });

  it('prefers the venue display field when a row carries one', () => {
    expect(resolveMatchListDeepLink({ venueId: 'v-7' }, [{ venueId: 'v-7', venue: 'Stadion', location: 'Jiné' }])).toEqual({
      venue: 'Stadion',
      league: 'all',
      team: 'all',
    });
  });
});

describe('googleMapsDirectionsHref', () => {
  it('prefers coordinates', () => {
    expect(googleMapsDirectionsHref({ gps: '50.1084, 14.4869', address: 'Praha 1' })).toBe(
      'https://www.google.com/maps/dir/?api=1&destination=50.1084%2C14.4869',
    );
  });

  it('uses the address when the coordinates are missing or unusable', () => {
    expect(googleMapsDirectionsHref({ gps: 'n/a', address: 'Za Lány 1, Praha' })).toBe(
      'https://www.google.com/maps/dir/?api=1&destination=Za+L%C3%A1ny+1%2C+Praha',
    );
    expect(googleMapsDirectionsHref({ gps: null, address: 'Kbely' })).toBe(
      'https://www.google.com/maps/dir/?api=1&destination=Kbely',
    );
  });

  it('returns null when neither is usable', () => {
    expect(googleMapsDirectionsHref({ gps: '', address: '  ' })).toBeNull();
    expect(googleMapsDirectionsHref(null)).toBeNull();
    expect(googleMapsDirectionsHref({ gps: '91, 14' })).toBeNull();
  });
});
