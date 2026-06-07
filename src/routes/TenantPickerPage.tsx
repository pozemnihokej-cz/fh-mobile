import { useEffect, useState } from 'react';
import {
  Box,
  Container,
  Typography,
  List,
  ListItem,
  CircularProgress,
  Paper,
  alpha,
  useTheme,
} from '@mui/material';
import { SportsHockey as HockeyIcon, ArrowForwardIos as ChevronIcon } from '@mui/icons-material';
import { useTranslation } from '@fh/i18n';
import { supabase } from '../lib/supabase';

/**
 * CHANGE-055 Spec-AC-02: root `/` tenant picker.
 * Overhauled with premium fancy GUI.
 */
interface PickerRow {
  id: string;
  slug: string;
  name: string;
}

export default function TenantPickerPage(): JSX.Element {
  const { t } = useTranslation();
  const theme = useTheme();
  const [rows, setRows] = useState<PickerRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { data, error: fetchError } = await supabase
        .from('tenants')
        .select('id,slug,name')
        .eq('is_active', true);
      if (cancelled) return;
      if (fetchError) {
        setError(`${fetchError.message} (${fetchError.code})`);
        setRows([]);
        return;
      }
      const list = ((data ?? []) as PickerRow[])
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name));
      setRows(list);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <Box
      sx={{
        minHeight: '100vh',
        bgcolor: 'background.default',
        color: '#ffffff',
        py: 6,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Background decoration */}
      <Box
        sx={{
          position: 'absolute',
          top: '-10%',
          right: '-10%',
          width: '60%',
          height: '40%',
          background: `radial-gradient(circle, ${alpha(theme.palette.primary.main, 0.1)} 0%, transparent 70%)`,
          zIndex: 0,
        }}
      />

      <Container maxWidth="xs" sx={{ position: 'relative', zIndex: 1 }}>
        <Box sx={{ textAlign: 'center', mb: 6 }}>
          <HockeyIcon sx={{ color: 'primary.main', fontSize: 64, mb: 2, filter: `drop-shadow(0 0 20px ${alpha(theme.palette.primary.main, 0.4)})` }} />
          <Typography
            variant="h4"
            sx={{
              fontWeight: 950,
              letterSpacing: '-1px',
              background: `linear-gradient(45deg, ${theme.palette.primary.main} 30%, ${theme.palette.primary.light} 90%)`,
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              mb: 1,
            }}
          >
            FH FANZONE
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            {t('mobile.routing.picker.title')}
          </Typography>
        </Box>

        {rows === null && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
            <CircularProgress color="primary" thickness={5} size={50} />
          </Box>
        )}

        {rows && rows.length === 0 && !error && (
          <Paper
            elevation={0}
            sx={{
              p: 4,
              textAlign: 'center',
              bgcolor: alpha(theme.palette.common.white, 0.03),
              borderRadius: '24px',
              border: `1px solid ${alpha(theme.palette.common.white, 0.06)}`,
            }}
          >
            <Typography variant="body2" sx={{ color: 'text.secondary', fontWeight: 600 }}>
              {t('mobile.routing.picker.empty')}
            </Typography>
          </Paper>
        )}

        {error && (
          <Paper
            elevation={0}
            sx={{
              p: 3,
              textAlign: 'center',
              bgcolor: alpha(theme.palette.error.main, 0.05),
              borderRadius: '24px',
              border: `1px solid ${alpha(theme.palette.error.main, 0.2)}`,
            }}
          >
            <Typography variant="body2" sx={{ color: 'error.light', fontWeight: 700 }}>
              {error}
            </Typography>
          </Paper>
        )}

        {rows && rows.length > 0 && (
          <List data-testid="tenant-picker-list" sx={{ width: '100%', p: 0 }}>
            {rows.map((row) => (
              <ListItem key={row.id} disablePadding sx={{ mb: 2 }}>
                <Paper
                  component="a"
                  href={`/${row.slug}/`}
                  data-testid={`tenant-picker-row-${row.slug}`}
                  elevation={0}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    width: '100%',
                    padding: '20px 24px',
                    color: '#ffffff',
                    textDecoration: 'none',
                    bgcolor: alpha(theme.palette.common.white, 0.03),
                    backdropFilter: 'blur(10px)',
                    border: `1px solid ${alpha(theme.palette.common.white, 0.08)}`,
                    borderRadius: '24px',
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    '&:hover': {
                      transform: 'translateY(-4px)',
                      bgcolor: alpha(theme.palette.common.white, 0.06),
                      borderColor: alpha(theme.palette.primary.main, 0.4),
                      boxShadow: `0 12px 40px ${alpha(theme.palette.common.black, 0.4)}`,
                    },
                  }}
                >
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="h6" sx={{ fontWeight: 800, color: '#fff', lineHeight: 1.2 }}>
                      {row.name}
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'primary.main', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                      {row.slug}
                    </Typography>
                  </Box>
                  <ChevronIcon sx={{ color: alpha(theme.palette.common.white, 0.2), fontSize: 16 }} />
                </Paper>
              </ListItem>
            ))}
          </List>
        )}
      </Container>
    </Box>
  );
}
