import { Outlet } from 'react-router-dom';
import { Box } from '@mui/material';

/**
 * CHANGE-055: fh-mobile root layout shell.
 * Overhauled with premium black GUI.
 */
export default function App(): JSX.Element {
  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#121212', color: '#ffffff' }}>
      <Outlet />
    </Box>
  );
}
