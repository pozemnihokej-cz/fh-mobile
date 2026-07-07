import { Outlet } from 'react-router-dom';
import { Box } from '@mui/material';
import { FAN_STAGE_BG } from '@fh/ui';
import { OfflineBanner } from './components/OfflineBanner';

/**
 * CHANGE-055: fh-mobile root layout shell.
 * Premium "turf under lights" stage (shared @fh/ui FAN_STAGE_BG).
 * PRD-055 Spec-AC-06: a pinned offline banner sits above every screen.
 */
export default function App(): JSX.Element {
  return (
    <Box sx={{ minHeight: '100vh', background: FAN_STAGE_BG, color: 'common.white' }}>
      <OfflineBanner />
      <Outlet />
    </Box>
  );
}
