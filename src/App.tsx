import { Outlet } from 'react-router-dom';
import { Box } from '@mui/material';

/**
 * CHANGE-055: fh-mobile root layout shell.
 *
 * The pre-CHANGE-055 App.tsx was a single-page bottom-tab UI that
 * embedded its own data fetching and routing-by-state. That logic moved
 * into:
 *   - `routes/TenantPickerPage.tsx` (root `/`)
 *   - `routes/TenantLayout.tsx`     (`/:slug/*` wrapper)
 *   - `routes/MatchesPage.tsx`      (`/:slug/matches`)
 *   - `routes/MatchDetailPage.tsx`  (`/:slug/matches/:matchId`)
 *   - `routes/NotFoundPage.tsx`     (catchall)
 *
 * What's left here is the global frame (background, theme passthrough)
 * that any of those nested routes opt into via `<Outlet />`.
 */
export default function App(): JSX.Element {
  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#121212', color: '#ffffff' }}>
      <Outlet />
    </Box>
  );
}
