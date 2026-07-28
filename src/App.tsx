import { Outlet } from 'react-router-dom';
import { Box } from '@mui/material';
import { FAN_STAGE_BG } from '@fh/ui';
import { OfflineBanner } from './components/OfflineBanner';
import { FanPreferencesProvider } from './lib/useFanPreferences';

/**
 * CHANGE-055: fh-mobile root layout shell.
 * Premium "turf under lights" stage (shared @fh/ui FAN_STAGE_BG).
 * PRD-055 Spec-AC-06: a pinned offline banner sits above every screen.
 * PRD-034 AC-14: the fan-preferences store wraps the whole route subtree so the
 * three subscribed lists are one session-wide instance (single Convex sync,
 * live cross-screen updates). Sits inside ConvexProvider + AuthProvider (mounted
 * in main.tsx), so the Convex actions and the fan token are both available.
 */
export default function App(): JSX.Element {
  return (
    <FanPreferencesProvider>
      <Box sx={{ minHeight: '100vh', background: FAN_STAGE_BG, color: 'common.white' }}>
        <OfflineBanner />
        <Outlet />
      </Box>
    </FanPreferencesProvider>
  );
}
