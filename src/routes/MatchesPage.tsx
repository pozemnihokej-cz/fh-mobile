import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from 'convex/react';
import { api } from '@convex/_generated/api';
import { Box, Container, Typography, CircularProgress } from '@mui/material';
import { MatchCard, type MatchCardData } from '../components/MatchCard';
import { useTenantContext } from './TenantContext';

/**
 * CHANGE-055 Spec-AC-01 / Spec-AC-12: matches list at `/<slug>/matches`.
 *
 * Reads tenantId from TenantContext (URL-resolved) and calls
 * `api.functions.matches.list({ tenantId })`. NO Convex mutations are
 * imported in this render tree — Spec-AC-12 / TEST-011.
 *
 * Starred matches are persisted client-side under `fh_starred_matches`
 * (read/write to localStorage is NOT a server mutation; CHANGE-055 §3
 * documents that "Moje kluby" / starred remain client-only).
 */
export default function MatchesPage(): JSX.Element {
  const { tenantId } = useTenantContext();
  const navigate = useNavigate();
  const matches = useQuery(
    api.functions.matches.list,
    tenantId ? { tenantId } : 'skip',
  );

  const [starredMatches, setStarredMatches] = useState<string[]>(() => {
    try {
      const saved = typeof window !== 'undefined' ? window.localStorage.getItem('fh_starred_matches') : null;
      return saved ? (JSON.parse(saved) as string[]) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem('fh_starred_matches', JSON.stringify(starredMatches));
    } catch {
      /* storage disabled */
    }
  }, [starredMatches]);

  const toggleStar = (supabaseId: string, e: React.MouseEvent): void => {
    e.stopPropagation();
    setStarredMatches((prev) =>
      prev.includes(supabaseId) ? prev.filter((id) => id !== supabaseId) : [...prev, supabaseId],
    );
  };

  const sorted = useMemo<MatchCardData[]>(() => {
    if (!matches) return [];
    return [...(matches as MatchCardData[])].sort((a, b) => b.date - a.date);
  }, [matches]);

  if (matches === undefined) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4, bgcolor: '#121212', minHeight: '100vh' }}>
        <CircularProgress color="success" />
      </Box>
    );
  }

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#121212', color: '#ffffff' }}>
      <Container maxWidth="xs" sx={{ py: 2 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 800, mb: 2, color: 'rgba(255,255,255,0.7)' }}>
          PŘEHLED VŠECH UTKÁNÍ
        </Typography>
        {sorted.length === 0 ? (
          <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.4)', textAlign: 'center', py: 5 }}>
            Žádné zápasy.
          </Typography>
        ) : (
          sorted.map((m) => (
            <MatchCard
              key={m._id}
              match={m}
              isStarred={starredMatches.includes(m.supabaseId)}
              onToggleStar={(e) => toggleStar(m.supabaseId, e)}
              onClick={() => navigate(m.supabaseId)}
            />
          ))
        )}
      </Container>
    </Box>
  );
}
