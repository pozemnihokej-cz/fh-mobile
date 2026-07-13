import { Link } from 'react-router-dom';
import { Box, Container, Typography, Stack, Button, alpha, useTheme } from '@mui/material';
import { StickyGlassHeader, FhIcon, typeScale, focusRing, type FhIconName } from '@fh/ui';
import { useTranslation } from '@fh/i18n';
import { useTenantContext } from './TenantContext';

/**
 * PRD-055 Phase 2 (Spec-AC-04): onboarding at `/<slug>/onboarding`. Static
 * feature intro + a link back to the tenant picker and a CTA to matches. No
 * remote data — always renders (no async state surface required).
 */
export default function OnboardingPage(): JSX.Element {
  const { tenantName } = useTenantContext();
  const theme = useTheme();
  const { t } = useTranslation();
  const white = theme.palette.common.white;

  const steps: Array<{ icon: FhIconName; title: string; body: string }> = [
    { icon: 'score', title: t('mobile.fan.onboarding.step1Title'), body: t('mobile.fan.onboarding.step1Body') },
    { icon: 'shootout', title: t('mobile.fan.onboarding.step2Title'), body: t('mobile.fan.onboarding.step2Body') },
    { icon: 'roster', title: t('mobile.fan.onboarding.step3Title'), body: t('mobile.fan.onboarding.step3Body') },
  ];

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'transparent', color: 'common.white', pb: 12 }}>
      <StickyGlassHeader
        sx={{ mb: 2 }}
        title={t('mobile.fan.onboarding.title')}
        subtitle={tenantName || t('mobile.fan.onboarding.subtitle')}
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
            <FhIcon name="hockey" />
          </Box>
        }
      />

      <Container maxWidth="xs" data-testid="onboarding-screen">
        <Stack spacing={1.5} sx={{ px: 0.5, mb: 3 }}>
          {steps.map((s) => (
            <Box
              key={s.title}
              data-testid="onboarding-step"
              sx={{
                display: 'flex',
                gap: 1.5,
                p: 2,
                borderRadius: '16px',
                background: `linear-gradient(180deg, ${alpha(white, 0.06)}, ${alpha(white, 0.02)})`,
                border: `1px solid ${alpha(white, 0.08)}`,
              }}
            >
              <Box
                sx={{
                  width: 44,
                  height: 44,
                  flexShrink: 0,
                  borderRadius: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  bgcolor: alpha(theme.palette.primary.main, 0.15),
                  color: 'primary.main',
                }}
              >
                <FhIcon name={s.icon} />
              </Box>
              <Box>
                <Typography sx={{ ...typeScale.bodyStrong, color: 'common.white', mb: 0.5 }}>{s.title}</Typography>
                <Typography sx={{ ...typeScale.body, color: 'text.secondary', fontSize: '0.85rem' }}>{s.body}</Typography>
              </Box>
            </Box>
          ))}
        </Stack>

        <Stack spacing={1.5} sx={{ px: 0.5 }}>
          <Button
            component={Link}
            to="../matches"
            relative="path"
            variant="contained"
            data-testid="onboarding-cta"
            sx={{ borderRadius: '14px', fontWeight: 800, py: 1.25, ...focusRing(theme) }}
          >
            {t('mobile.fan.onboarding.cta')}
          </Button>
          <Button
            component={Link}
            to="/"
            variant="text"
            startIcon={<FhIcon name="back" inline />}
            sx={{ color: 'text.secondary', fontWeight: 700, ...focusRing(theme) }}
          >
            {t('mobile.fan.onboarding.pickOrg')}
          </Button>
        </Stack>
      </Container>
    </Box>
  );
}
