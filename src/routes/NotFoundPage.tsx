import { Box, Typography, Button } from '@mui/material';
import { useTranslation } from '@fh/i18n';

/**
 * CHANGE-055 Spec-AC-03: i18n-driven 404 view.
 *
 * Heading uses i18n key `mobile.routing.notFound.title`; back-to-picker
 * affordance is a hard `<a href="/">` so browser-back history stays clean
 * (no react-router state to unwind).
 */
export default function NotFoundPage(): JSX.Element {
  const { t } = useTranslation();
  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        textAlign: 'center',
        p: 4,
        bgcolor: '#121212',
        color: '#ffffff',
      }}
    >
      <Typography variant="h5" sx={{ fontWeight: 900, mb: 2 }}>
        {t('mobile.routing.notFound.title')}
      </Typography>
      <Typography
        variant="body2"
        sx={{ color: 'rgba(255,255,255,0.6)', mb: 3, maxWidth: 400 }}
      >
        {t('mobile.routing.notFound.message')}
      </Typography>
      <Button
        component="a"
        href="/"
        variant="contained"
        color="success"
        sx={{ borderRadius: '12px' }}
      >
        {t('mobile.routing.notFound.backToPicker')}
      </Button>
    </Box>
  );
}
