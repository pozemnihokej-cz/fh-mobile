import { Outlet } from 'react-router-dom';
import { Box } from '@mui/material';
import { FAN_STAGE_BG } from '@fh/ui';

/**
 * CHANGE-055: fh-mobile root layout shell.
 * Premium "turf under lights" stage (shared @fh/ui FAN_STAGE_BG).
 */
export default function App(): JSX.Element {
  return (
    <Box sx={{ minHeight: '100vh', background: FAN_STAGE_BG, color: '#ffffff' }}>
      <Outlet />
    </Box>
  );
}
