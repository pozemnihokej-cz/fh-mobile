import { describe, it, expect, vi } from 'vitest';
import { toSearchResults, fetchSearch, sanitizeSearchQuery } from '../search';

describe('toSearchResults (rows → grouped results)', () => {
  it('maps clubs, teams and players and totals them', () => {
    const results = toSearchResults(
      [{ id: 'c1', official_name: 'Alpha z.s.', short_name: 'Alpha', marketing_name: null, logo_url: 'c.png' }],
      [{ id: 't1', name: 'Alpha A', short_name: null, logo_url: null, club_id: 'c1' }],
      [{ id: 'p1', first_name: 'Jan', last_name: 'Novák', position: 'forward', jersey_number: 7, photo_url: 'p.png' }],
    );
    expect(results.total).toBe(3);
    expect(results.clubs[0]).toMatchObject({ kind: 'club', title: 'Alpha', imageUrl: 'c.png' });
    expect(results.teams[0]).toMatchObject({ kind: 'team', title: 'Alpha A' });
    expect(results.players[0]).toMatchObject({ kind: 'player', title: 'Jan Novák', subtitle: 'forward · #7' });
  });
});

describe('fetchSearch (multi-source read)', () => {
  it('short-circuits queries under 2 chars without hitting the DB', async () => {
    const from = vi.fn();
    const out = await fetchSearch({ from } as never, 'T1', 'a');
    expect(out.total).toBe(0);
    expect(from).not.toHaveBeenCalled();
  });

  it('reads clubs/teams/persons_public and merges the results', async () => {
    const tables: Record<string, unknown> = {
      clubs: [{ id: 'c1', official_name: 'Alpha', short_name: 'Alpha', marketing_name: null, logo_url: null }],
      teams: [{ id: 't1', name: 'Alpha A', short_name: null, logo_url: null, club_id: 'c1' }],
      persons_public: [{ id: 'p1', first_name: 'Jan', last_name: 'Alpha', position: null, jersey_number: null, photo_url: null }],
    };
    const from = vi.fn((table: string) => {
      const builder: Record<string, unknown> = {};
      builder.select = () => builder;
      builder.eq = () => builder;
      builder.or = () => builder;
      builder.limit = () => Promise.resolve({ data: tables[table], error: null });
      return builder;
    });
    const out = await fetchSearch({ from } as never, 'T1', 'alpha');
    expect(out.total).toBe(3);
    expect(from).toHaveBeenCalledWith('persons_public');
  });
});

describe('sanitizeSearchQuery (W3 — PostgREST filter hardening)', () => {
  it('strips PostgREST/ilike metacharacters but keeps letters/digits/spaces/diacritics', () => {
    expect(sanitizeSearchQuery('Nov,ák(x).ilike.*7_%"\\')).toBe('Nov ák x ilike 7');
    expect(sanitizeSearchQuery('  Jan   Novák  ')).toBe('Jan Novák');
    expect(sanitizeSearchQuery('Ăčŕ12')).toBe('Ăčŕ12');
  });

  it('caps the query length', () => {
    expect(sanitizeSearchQuery('a'.repeat(200)).length).toBe(64);
  });
});

describe('fetchSearch (W3 — a crafted query cannot inject an extra .or() term)', () => {
  it('sanitizes metacharacters before interpolating into .or()/.ilike filters', async () => {
    const orCalls: string[] = [];
    const from = vi.fn(() => {
      const builder: Record<string, unknown> = {};
      builder.select = () => builder;
      builder.eq = () => builder;
      builder.or = (arg: string) => {
        orCalls.push(arg);
        return builder;
      };
      builder.ilike = () => builder;
      builder.limit = () => Promise.resolve({ data: [], error: null });
      return builder;
    });

    // Crafted query trying to inject an extra comma-separated filter term.
    const evil = 'x,first_name.ilike.*(secret)*';
    await fetchSearch({ from } as never, 'T1', evil);

    // The persons_public .or() is the last one built (clubs, teams, persons order).
    const personsOr = orCalls[orCalls.length - 1];
    // Exactly the two INTENDED terms (first_name, last_name) → one separating comma.
    // An injected comma from the raw query would have produced 3+ segments.
    expect(personsOr.split(',')).toHaveLength(2);
    // No filter-grammar metacharacters from the user input survived into any filter
    // value (`.` and `,` are legitimate grammar; `%` is the wildcard we add).
    for (const arg of orCalls) {
      expect(arg).not.toMatch(/[*():"\\]/);
    }
  });
});
