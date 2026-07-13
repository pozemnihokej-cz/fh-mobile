import { Box, Skeleton, useTheme, alpha } from '@mui/material';

/**
 * PRD-055 Phase 2 (Spec-AC-05): a neutral list placeholder for the supabase-js
 * fan screens that have no bespoke skeleton (unlike matches, which use
 * MatchCardSkeleton). Rounded glass rows that mirror the resolved list shape so
 * data resolving does not shift layout.
 */
export function FanListSkeleton({ count = 6 }: { count?: number }): JSX.Element {
  const theme = useTheme();
  return (
    <Box data-testid="fan-list-skeleton" sx={{ px: 2, pt: 1 }}>
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton
          key={i}
          variant="rounded"
          height={56}
          sx={{
            mb: 1,
            borderRadius: '14px',
            bgcolor: alpha(theme.palette.common.white, 0.06),
          }}
        />
      ))}
    </Box>
  );
}
