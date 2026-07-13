import { Box, Container, alpha, useTheme } from '@mui/material';
import { StickyGlassHeader, EmptyState, FhIcon, type FhIconName } from '@fh/ui';

/**
 * PRD-055 Phase 2 (Spec-AC-05): the shared shell for the three stub screens
 * (News, Notifications, Profile). Each renders the DESIGNED EmptyState rather
 * than a blank/placeholder — the screen exists and is reachable, its data
 * source is simply not wired yet (News/Notifications have no source; Profile's
 * data = PRD-034 AC-008, a separate effort). Satisfies AC-05 via EmptyState.
 */
export function FanStubScreen({
  testid,
  icon,
  title,
  subtitle,
  emptyTitle,
  emptyDescription,
  note,
}: {
  testid: string;
  icon: FhIconName;
  title: string;
  subtitle?: string;
  emptyTitle: string;
  emptyDescription: string;
  note?: string;
}): JSX.Element {
  const theme = useTheme();
  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'transparent', color: 'common.white', pb: 12 }}>
      <StickyGlassHeader
        sx={{ mb: 2 }}
        title={title}
        subtitle={subtitle}
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
            <FhIcon name={icon} />
          </Box>
        }
      />
      <Container maxWidth="xs" data-testid={testid}>
        <EmptyState
          icon={<FhIcon name={icon} sx={{ fontSize: 44 }} />}
          title={emptyTitle}
          description={note ? `${emptyDescription} ${note}` : emptyDescription}
        />
      </Container>
    </Box>
  );
}
