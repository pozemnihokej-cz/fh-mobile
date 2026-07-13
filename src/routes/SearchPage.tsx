import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Container, Typography, Avatar, Stack, InputBase, alpha, useTheme } from '@mui/material';
import { StickyGlassHeader, EmptyState, FhIcon, typeScale, focusRing } from '@fh/ui';
import { useTranslation } from '@fh/i18n';
import { AsyncBoundary } from '../components/AsyncBoundary';
import { FanListSkeleton } from '../components/FanListSkeleton';
import { useAsyncData } from '../lib/useAsyncData';
import { supabase } from '../lib/supabase';
import { fetchSearch, type SearchResult } from '../lib/adapters/search';
import { useTenantContext } from './TenantContext';

/**
 * PRD-055 Phase 2 (Spec-AC-04/05): search at `/<slug>/search`. Real data via the
 * search adapter across anon `clubs`/`teams` + the fan-safe `persons_public`.
 */
export default function SearchPage(): JSX.Element {
  const { tenantId } = useTenantContext();
  const navigate = useNavigate();
  const theme = useTheme();
  const { t } = useTranslation();
  const white = theme.palette.common.white;

  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');

  useEffect(() => {
    const h = setTimeout(() => setDebounced(query.trim()), 300);
    return () => clearTimeout(h);
  }, [query]);

  const active = debounced.length >= 2;
  const { data, error, loading, refetch } = useAsyncData(
    () => fetchSearch(supabase, tenantId as string, debounced),
    [tenantId, debounced],
    Boolean(tenantId) && active,
  );
  const results = data ?? { clubs: [], teams: [], players: [], total: 0 };

  const onResultClick = (r: SearchResult): void => {
    if (r.kind === 'club') navigate(`../clubs/${r.id}`, { relative: 'path' });
    else if (r.kind === 'player') navigate(`../players/${r.id}`, { relative: 'path' });
  };

  const renderGroup = (label: string, items: SearchResult[]): JSX.Element | null => {
    if (items.length === 0) return null;
    return (
      <Box sx={{ mb: 2.5 }}>
        <Typography sx={{ ...typeScale.label, color: 'text.secondary', mb: 1, display: 'block' }}>{label}</Typography>
        <Stack spacing={0.75}>
          {items.map((r) => (
            <Box
              key={`${r.kind}-${r.id}`}
              data-testid="search-result"
              onClick={() => onResultClick(r)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') onResultClick(r);
              }}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1.5,
                p: 1.25,
                minHeight: 44,
                borderRadius: '12px',
                cursor: 'pointer',
                bgcolor: alpha(white, 0.04),
                border: `1px solid ${alpha(white, 0.06)}`,
                ...focusRing(theme),
              }}
            >
              <Avatar src={r.imageUrl ?? undefined} sx={{ width: 34, height: 34, bgcolor: alpha(white, 0.08) }}>
                <FhIcon name={r.kind === 'player' ? 'roster' : 'hockey'} inline />
              </Avatar>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography sx={{ ...typeScale.bodyStrong, fontSize: '0.9rem', color: 'common.white' }} noWrap>
                  {r.title}
                </Typography>
                {r.subtitle && (
                  <Typography sx={{ ...typeScale.caption, color: 'text.secondary' }} noWrap>
                    {r.subtitle}
                  </Typography>
                )}
              </Box>
              <FhIcon name="chevronRight" sx={{ color: alpha(white, 0.25), fontSize: 16 }} />
            </Box>
          ))}
        </Stack>
      </Box>
    );
  };

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'transparent', color: 'common.white', pb: 12 }}>
      <StickyGlassHeader
        sx={{ mb: 2 }}
        title={t('mobile.fan.search.title')}
        leading={
          <Box
            sx={{
              width: 40,
              height: 40,
              borderRadius: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              bgcolor: alpha(theme.palette.primary.main, 0.12),
              color: 'primary.main',
            }}
          >
            <FhIcon name="search" />
          </Box>
        }
      />

      <Container maxWidth="xs" data-testid="search-screen">
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            px: 2,
            py: 1,
            mb: 2,
            borderRadius: '14px',
            bgcolor: alpha(white, 0.06),
            border: `1px solid ${alpha(white, 0.08)}`,
            ...focusRing(theme),
          }}
        >
          <FhIcon name="search" sx={{ color: 'text.secondary' }} inline />
          <InputBase
            fullWidth
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('mobile.fan.search.placeholder')}
            inputProps={{ 'aria-label': t('mobile.fan.search.title'), 'data-testid': 'search-input' }}
            sx={{ color: 'common.white', ...typeScale.body }}
          />
        </Box>

        {!active ? (
          <EmptyState
            icon={<FhIcon name="search" sx={{ fontSize: 44 }} />}
            title={t('mobile.fan.search.title')}
            description={t('mobile.fan.search.hint')}
          />
        ) : (
          <AsyncBoundary
            loading={loading}
            error={error}
            isEmpty={results.total === 0}
            skeleton={<FanListSkeleton count={5} />}
            onRetry={refetch}
            errorTitle={t('mobile.fan.search.error')}
            errorDescription={t('mobile.fan.search.errorDesc')}
            retryLabel={t('mobile.fan.errorRetry')}
            empty={
              <EmptyState
                icon={<FhIcon name="search" sx={{ fontSize: 44 }} />}
                title={t('mobile.fan.search.empty')}
                description={t('mobile.fan.search.emptyDesc')}
              />
            }
          >
            <Box>
              {renderGroup(t('mobile.fan.search.clubs'), results.clubs)}
              {renderGroup(t('mobile.fan.search.teams'), results.teams)}
              {renderGroup(t('mobile.fan.search.players'), results.players)}
            </Box>
          </AsyncBoundary>
        )}
      </Container>
    </Box>
  );
}
