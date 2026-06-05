import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { ConvexProvider, ConvexReactClient } from 'convex/react';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { Box, Typography, Button } from '@mui/material';
import { fhTheme } from '@fh/ui';
import { AuthProvider } from '@fh/auth';
import { initI18n } from '@fh/i18n';
import { resolveBaseUrl, resolveSiblingUrl } from './lib/runtimeUrls';
import { supabase } from './lib/supabase';
import App from './App';
import TenantPickerPage from './routes/TenantPickerPage';
import TenantLayout from './routes/TenantLayout';
import MatchesPage from './routes/MatchesPage';
import MatchDetailPage from './routes/MatchDetailPage';
import NotFoundPage from './routes/NotFoundPage';

initI18n();

// Runtime injections to avoid issues with inline styles
document.body.style.cssText = 'margin:0;padding:0;background-color:#121212;-webkit-tap-highlight-color:transparent';

const convexUrl = resolveSiblingUrl('fh-convex', import.meta.env.VITE_CONVEX_URL, 'http://localhost:3210');
const convex = new ConvexReactClient(convexUrl);

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      const isConvexError = this.state.error.message?.includes('CONVEX')
        || this.state.error.message?.includes('Could not find public function');
      return (
        <Box sx={{ p: 4, textAlign: 'center', minHeight: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', bgcolor: '#121212', color: '#ffffff' }}>
          <Typography variant="h5" sx={{ fontWeight: 900, mb: 2 }}>
            {isConvexError ? 'Convex backend nedostupný' : 'Nastala chyba'}
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary', mb: 3, maxWidth: 400, mx: 'auto' }}>
            {isConvexError
              ? 'Konvexní backend nebyl spuštěn nebo funkce nebyly nasazeny.'
              : this.state.error.message}
          </Typography>
          <Button variant="contained" color="primary" onClick={() => { this.setState({ error: null }); window.location.reload(); }}>
            Zkusit znovu
          </Button>
        </Box>
      );
    }
    return this.props.children;
  }
}

// CHANGE-055 route table:
//   /                          → tenant picker
//   /:slug/                    → matches (index redirect to ./matches)
//   /:slug/matches             → MatchesPage
//   /:slug/matches/:matchId    → MatchDetailPage
//   /:slug/*                   → NotFoundPage (tenant resolved, route unknown)
//   *                          → NotFoundPage (slug-less catchall)
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <ThemeProvider theme={fhTheme}>
        <CssBaseline />
        <ErrorBoundary>
          <AuthProvider
            supabaseClient={supabase}
            apiUrl={resolveBaseUrl(import.meta.env.VITE_API_URL, 'http://localhost:4000')}
          >
            <ConvexProvider client={convex}>
              <Routes>
                <Route element={<App />}>
                  <Route index element={<TenantPickerPage />} />
                  <Route path=":slug" element={<TenantLayout />}>
                    <Route index element={<Navigate to="matches" replace />} />
                    <Route path="matches" element={<MatchesPage />} />
                    <Route path="matches/:matchId" element={<MatchDetailPage />} />
                    <Route path="*" element={<NotFoundPage />} />
                  </Route>
                  <Route path="*" element={<NotFoundPage />} />
                </Route>
              </Routes>
            </ConvexProvider>
          </AuthProvider>
        </ErrorBoundary>
      </ThemeProvider>
    </BrowserRouter>
  </React.StrictMode>
);
