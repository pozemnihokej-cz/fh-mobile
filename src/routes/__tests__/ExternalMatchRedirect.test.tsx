/**
 * spec-fan-match-external-id-redirect TEST-002 / TEST-003 / TEST-004 /
 * TEST-005 / TEST-011 / TEST-012 / TEST-020 (Spec-AC-01, Spec-AC-02,
 * Spec-AC-03, Spec-AC-04, Spec-AC-07, Spec-AC-12).
 *
 * Mounts the REAL nested shape (`:slug` -> TenantLayout -> the new route)
 * so tenant resolution and the unknown-slug not-found are exercised for
 * real (MF-10), not assumed. `convex/react`'s `useQuery` is mocked with a
 * recorder (same convention as routing.test.tsx's `mockMatch`), discriminated
 * by the ARGS SHAPE rather than by query-reference identity: Convex's
 * `anyApi` proxy returns a NEW object on every property access (measured:
 * `anyApi.functions.matches.x === anyApi.functions.matches.x` is `false`),
 * so `getFunctionName` (from `convex/server`) is used to recover the
 * stable `"functions/matches:<name>"` string for TEST-020's call-name
 * assertion, and args-shape discrimination (`'externalId' in args` vs
 * `'supabaseId' in args`) drives which fixture value a call returns — the
 * same technique routing.test.tsx already uses for this exact reason.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation, useNavigate, useParams } from 'react-router-dom';
import { getFunctionName } from 'convex/server';

vi.mock('../../lib/tenantBySlug', () => ({
  resolveTenantBySlug: vi.fn(async (_supabase: unknown, slug: string) => {
    if (slug === 'does-not-exist') return null;
    return { id: 'TID-E2E', slug, name: 'E2E Test' };
  }),
  __resetTenantBySlugCache: () => undefined,
}));

vi.mock('../../lib/supabase', () => ({
  supabase: { from: () => ({ select: () => ({ eq: () => ({ maybeSingle: () => ({}) }) }) }) },
}));

vi.mock('@fh/auth', () => ({
  useAuth: () => ({ user: null, switchTenant: vi.fn() }),
}));

const mockResolved = vi.hoisted(() => ({ current: undefined as { supabaseId: string } | null | undefined }));
const recordedCalls = vi.hoisted(() => ({ calls: [] as Array<{ name: string; args: unknown; query: unknown }> }));
// NB-1 remediation: lets a test simulate the resolver's Convex query THROWING
// (e.g. a transient failure during a convex/ redeploy, MF-07) to prove the
// route-scoped QueryErrorBoundary added to main.tsx actually catches it.
const mockShouldThrow = vi.hoisted(() => ({ current: false }));

vi.mock('convex/react', () => ({
  useQuery: vi.fn((query: unknown, args: unknown) => {
    // Store the raw query reference; `recordedNames()` below resolves it to
    // a stable "functions/matches:<name>" string via `getFunctionName`
    // on read. Convex's `anyApi` proxy returns a NEW object on every
    // property access (measured: `a === a` is false for two independent
    // `anyApi.functions.matches.x` accesses), so reference identity
    // cannot be compared directly — only `getFunctionName`'s own path
    // recovery is stable.
    recordedCalls.calls.push({ name: '', args, query });
    if (args === 'skip') return undefined;
    if (args && typeof args === 'object' && 'externalId' in args) {
      if (mockShouldThrow.current) throw new Error('Convex query failed');
      return mockResolved.current;
    }
    return undefined;
  }),
}));

import TenantLayout from '../TenantLayout';
import { QueryErrorBoundary } from '../../components/QueryErrorBoundary';
import ExternalMatchRedirect from '../ExternalMatchRedirect';
import NotFoundPage from '../NotFoundPage';
import { useQuery as mockedUseQuery } from 'convex/react';
import { api } from '@convex/_generated/api';

function recordedNames(): string[] {
  return recordedCalls.calls.map((c) => getFunctionName(c.query as Parameters<typeof getFunctionName>[0]));
}

function LocationProbe(): JSX.Element {
  const loc = useLocation();
  return <span data-testid="probe-path">{loc.pathname}</span>;
}

function BackTrigger(): JSX.Element {
  const navigate = useNavigate();
  return <button data-testid="back-trigger" onClick={() => navigate(-1)} />;
}

/** Minimal stand-in for the canonical detail route (R-1 convention: every
 * existing fh-mobile route test asserts against a retyped `<Routes>` tree,
 * never the real `main.tsx`). Captures the matchId the resolver navigated
 * to and issues the SAME `getBySupabaseId` query shape the real
 * MatchDetailPage does, so TEST-004 can assert on the recorded args. */
function DetailProbe(): JSX.Element {
  const { matchId } = useParams<{ matchId: string }>();
  mockedUseQuery(api.functions.matches.getBySupabaseId, matchId ? { supabaseId: matchId } : 'skip');
  return <div data-testid="match-detail-mounted">{matchId}</div>;
}

/** Stand-in for LineupPage — TEST-012 only needs to prove this never
 * mounts, not exercise the real lineup adapter/fetch stack. */
function LineupStub(): JSX.Element {
  return <div data-testid="lineup-page-mounted" />;
}

function appTree() {
  return (
    <Routes>
      <Route path=":slug" element={<TenantLayout />}>
        {/* Declared BEFORE matches/:matchId/lineup on purpose (Test Plan
         * "Route-ranking note", TEST-012): both paths score equally in
         * React Router v6 (2 static + 1 dynamic segment each), so for the
         * degenerate URL matches/external/lineup the EARLIER-declared
         * branch wins the tie and this route — not LineupPage — mounts. */}
        <Route
          path="matches/external/:externalId"
          element={
            <QueryErrorBoundary errorTitle="Zápas se nepodařilo načíst" errorDescription="Zkontroluj připojení a zkus to znovu." retryLabel="Zkusit znovu">
              <ExternalMatchRedirect />
            </QueryErrorBoundary>
          }
        />
        <Route path="matches/:matchId/lineup" element={<LineupStub />} />
        <Route path="matches/:matchId" element={<DetailProbe />} />
        <Route path="matches" element={<div data-testid="matches-list" />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}

beforeEach(() => {
  mockResolved.current = undefined;
  mockShouldThrow.current = false;
  recordedCalls.calls = [];
  vi.clearAllMocks();
  return import('../../lib/tenantBySlug').then((m) =>
    (m as { __resetTenantBySlugCache: () => void }).__resetTenantBySlugCache(),
  );
});

describe('TEST-002 (Spec-AC-01): the nested route mounts the resolver, never NotFoundPage, while pending', () => {
  it('mounts external-match-redirect at /e2e-test/matches/external/23111 and never NotFoundPage', async () => {
    mockResolved.current = undefined; // still pending
    render(
      <MemoryRouter initialEntries={['/e2e-test/matches/external/23111']}>
        {appTree()}
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByTestId('external-match-redirect')).toBeInTheDocument());
    expect(screen.queryByRole('heading')).toBeNull();
  });
});

describe('TEST-003 (Spec-AC-02): a resolved match replace-navigates to the canonical route', () => {
  it('pathname becomes /e2e-test/matches/<supabaseId>', async () => {
    mockResolved.current = { supabaseId: 'uuid-x' };
    render(
      <MemoryRouter initialEntries={['/e2e-test/matches/external/23111']}>
        {appTree()}
        <LocationProbe />
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByTestId('probe-path')).toHaveTextContent('/e2e-test/matches/uuid-x'));
    expect(screen.getByTestId('match-detail-mounted')).toHaveTextContent('uuid-x');
  });
});

describe('TEST-004 (Spec-AC-03): the detail query is issued with the canonical id, never the external one', () => {
  it('the recorded getBySupabaseId call carries {supabaseId: "uuid-x"}, never {supabaseId: "23111"}', async () => {
    mockResolved.current = { supabaseId: 'uuid-x' };
    render(
      <MemoryRouter initialEntries={['/e2e-test/matches/external/23111']}>
        {appTree()}
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByTestId('match-detail-mounted')).toBeInTheDocument());

    const detailCalls = recordedCalls.calls.filter(
      (c) => c.args && typeof c.args === 'object' && 'supabaseId' in (c.args as object),
    );
    expect(detailCalls.length).toBeGreaterThan(0);
    expect(detailCalls[0].args).toEqual({ supabaseId: 'uuid-x' });
    expect(detailCalls.some((c) => (c.args as { supabaseId: string }).supabaseId === '23111')).toBe(false);
  });
});

describe('TEST-005 (Spec-AC-04): the resolver is removed from history (replace, not push)', () => {
  it('a back navigation after resolution lands on /e2e-test/matches, never re-entering /external/', async () => {
    mockResolved.current = { supabaseId: 'uuid-x' };
    render(
      <MemoryRouter
        initialEntries={['/e2e-test/matches', '/e2e-test/matches/external/23111']}
        initialIndex={1}
      >
        {appTree()}
        <LocationProbe />
        <BackTrigger />
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByTestId('probe-path')).toHaveTextContent('/e2e-test/matches/uuid-x'));

    fireEvent.click(screen.getByTestId('back-trigger'));

    // EXACT match (not substring): a regression where the resolver still
    // PUSHES (instead of replacing) would leave '/matches/external/23111' on
    // the stack, and going back once would re-land there, re-trigger the
    // resolver's effect (match is still resolved), and auto-forward again to
    // '/e2e-test/matches/uuid-x' -- which a substring check on
    // '/e2e-test/matches' would wrongly accept (measured: the original
    // substring-based assertion stayed GREEN under the TEST-005 mutation).
    await waitFor(() => expect(screen.getByTestId('probe-path')).toHaveTextContent(/^\/e2e-test\/matches$/));
  });
});

describe('TEST-011 (Spec-AC-07): not-found, no navigation — ambiguous match and unknown slug alike', () => {
  it('a null resolution renders the standard not-found copy and never navigates', async () => {
    mockResolved.current = null;
    render(
      <MemoryRouter initialEntries={['/e2e-test/matches/external/99999']}>
        {appTree()}
        <LocationProbe />
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByRole('heading')).toBeInTheDocument());
    expect(screen.getByTestId('probe-path')).toHaveTextContent('/e2e-test/matches/external/99999');
    expect(screen.queryByTestId('external-match-redirect')).toBeNull();
  });

  it('an unknown slug renders the same not-found via TenantLayout and issues NO Convex call for this route', async () => {
    mockResolved.current = { supabaseId: 'uuid-x' };
    render(
      <MemoryRouter initialEntries={['/does-not-exist/matches/external/23111']}>
        {appTree()}
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByRole('heading')).toBeInTheDocument());
    const resolverCalls = recordedCalls.calls.filter(
      (c) => c.args && typeof c.args === 'object' && 'externalId' in (c.args as object),
    );
    expect(resolverCalls).toHaveLength(0);
  });
});

describe('TEST-012 (Spec-AC-07): the degenerate /external/lineup URL and a percent-encoded id both miss', () => {
  it('/e2e-test/matches/external/lineup resolves not-found and never mounts LineupPage', async () => {
    mockResolved.current = null; // 'lineup' is not a real externalId
    render(
      <MemoryRouter initialEntries={['/e2e-test/matches/external/lineup']}>
        {appTree()}
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByRole('heading')).toBeInTheDocument());
    expect(screen.queryByTestId('lineup-page-mounted')).toBeNull();
  });

  it('a percent-encoded externalId segment resolves not-found without crashing', async () => {
    mockResolved.current = null;
    render(
      <MemoryRouter initialEntries={['/e2e-test/matches/external/%4A%4A%4A']}>
        {appTree()}
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByRole('heading')).toBeInTheDocument());
  });
});

describe('TEST-020 (Spec-AC-12): only resolveExternalIdToSupabaseId is called, never getBySupabaseId, before the redirect', () => {
  it('the recorded call names functions/matches:resolveExternalIdToSupabaseId and never functions/matches:getBySupabaseId while pending', async () => {
    mockResolved.current = undefined; // pending — resolver only, detail route never mounts
    render(
      <MemoryRouter initialEntries={['/e2e-test/matches/external/23111']}>
        {appTree()}
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByTestId('external-match-redirect')).toBeInTheDocument());

    const names = recordedNames();
    expect(names).toContain('functions/matches:resolveExternalIdToSupabaseId');
    expect(names).not.toContain('functions/matches:getBySupabaseId');
  });
});

describe('NB-1 remediation: the route-scoped QueryErrorBoundary (main.tsx:170) actually catches a thrown render', () => {
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // The boundary's own catch logs via React's error reporting (console.error);
    // silence it here only, same convention as QueryErrorBoundary.test.tsx.
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    errorSpy.mockRestore();
  });

  it('a thrown Convex query error is caught locally (ErrorState + retry), never escaping to an outer boundary', async () => {
    mockShouldThrow.current = true;
    render(
      <MemoryRouter initialEntries={['/e2e-test/matches/external/23111']}>
        {appTree()}
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByText('Zápas se nepodařilo načíst')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Zkusit znovu' })).toBeInTheDocument();
    // Neither the spinner nor the resolved navigation ever mounted.
    expect(screen.queryByTestId('external-match-redirect')).toBeNull();
    expect(screen.queryByTestId('match-detail-mounted')).toBeNull();
  });

  it('the happy path is unaffected by the boundary: a resolved match still replace-navigates', async () => {
    mockShouldThrow.current = false;
    mockResolved.current = { supabaseId: 'uuid-x' };
    render(
      <MemoryRouter initialEntries={['/e2e-test/matches/external/23111']}>
        {appTree()}
        <LocationProbe />
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByTestId('probe-path')).toHaveTextContent('/e2e-test/matches/uuid-x'));
    expect(screen.queryByText('Zápas se nepodařilo načíst')).toBeNull();
  });
});
