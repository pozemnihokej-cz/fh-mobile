import { Box, Container, Typography, Stack, Button, Chip, alpha, useTheme } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { StickyGlassHeader, EmptyState, FhIcon, focusRing, typeScale } from '@fh/ui';
import { useAuth } from '@fh/auth';
import { useTranslation } from '@fh/i18n';
import { AuthForm } from '../components/AuthForm';
import { useFanPreferences } from '../lib/useFanPreferences';
import { useTenantContext } from './TenantContext';

/**
 * PRD-034 Spec-AC-13 / -14 / -15 — auth-aware Profile at `/<slug>/profile`.
 *
 * Signed-out: a designed register/login form (AuthForm). No login wall —
 * anonymous browsing of every other screen is untouched.
 * Signed-in: the fan account (email/name + sign-out) plus their synced
 * subscriptions (clubs / leagues / matches) with per-item remove + clear-all.
 */
export default function ProfilePage(): JSX.Element {
  const theme = useTheme();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { user, isAuthenticated, signOut } = useAuth();
  const { tenantName } = useTenantContext();
  const prefs = useFanPreferences();

  const white = theme.palette.common.white;
  const totalSubs = prefs.clubs.length + prefs.leagues.length + prefs.matches.length;

  const sectionLabelSx = { ...typeScale.label, color: 'text.secondary', mb: 1, display: 'block' } as const;
  const cardSx = {
    p: 2,
    borderRadius: '16px',
    bgcolor: alpha(white, 0.03),
    border: `1px solid ${alpha(white, 0.08)}`,
  } as const;

  const renderChips = (
    label: string,
    ids: string[],
    onRemove: (id: string) => void,
  ): JSX.Element | null => {
    if (ids.length === 0) return null;
    return (
      <Box sx={{ mb: 1.5 }}>
        <Typography sx={sectionLabelSx}>
          {label} ({ids.length})
        </Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
          {ids.map((id) => (
            <Chip
              key={id}
              data-testid="subscription-chip"
              label={id.length > 10 ? `${id.slice(0, 8)}…` : id}
              onDelete={() => onRemove(id)}
              deleteIcon={<FhIcon name="close" inline />}
              size="small"
              sx={{ bgcolor: alpha(white, 0.06), color: 'common.white', borderRadius: '10px' }}
            />
          ))}
        </Box>
      </Box>
    );
  };

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'transparent', color: 'common.white', pb: 12 }}>
      <StickyGlassHeader
        sx={{ mb: 2 }}
        title={t('mobile.fan.profile.title')}
        subtitle={isAuthenticated ? (user?.name || user?.email || undefined) : undefined}
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
            <FhIcon name="settings" />
          </Box>
        }
      />

      <Container maxWidth="xs" data-testid="profile-screen">
        {/* CHANGE-194 Bug 3 — switch active organization (back to the tenant
            picker). Shown in both auth states: switching org is independent of
            being signed in, and there was previously no affordance linking to
            the `/` picker from inside the app. */}
        <Box sx={{ ...cardSx, mb: 2.5 }}>
          <Typography sx={sectionLabelSx}>{t('mobile.fan.profile.organization')}</Typography>
          {tenantName && (
            <Typography sx={{ ...typeScale.bodyStrong, color: 'common.white' }}>{tenantName}</Typography>
          )}
          <Button
            data-testid="profile-switch-org"
            onClick={() => navigate('/')}
            variant="outlined"
            color="inherit"
            startIcon={<FhIcon name="dashboard" inline />}
            endIcon={<FhIcon name="chevronRight" inline />}
            sx={{ mt: 1.5, borderRadius: '12px', fontWeight: 700, justifyContent: 'space-between', ...focusRing(theme) }}
            fullWidth
          >
            {t('mobile.fan.profile.switchOrg')}
          </Button>
        </Box>

        {!isAuthenticated ? (
          import.meta.env.PROD && import.meta.env.VITE_ENABLE_UNRELEASED_PAGES !== 'true' ? (
            <Box sx={{ ...cardSx, textAlign: 'center', py: 3 }}>
              <Typography sx={{ ...typeScale.body, color: 'text.secondary' }}>
                Přihlášení a vytváření uživatelských účtů není v této verzi k dispozici.
              </Typography>
            </Box>
          ) : (
            <Stack spacing={2}>
              <Box>
                <Typography sx={{ ...typeScale.title, color: 'common.white', mb: 0.5 }}>
                  {t('mobile.fan.profile.signInTitle')}
                </Typography>
                <Typography sx={{ ...typeScale.body, color: 'text.secondary' }}>
                  {t('mobile.fan.profile.signInDesc')}
                </Typography>
              </Box>
              <AuthForm />
            </Stack>
          )
        ) : (
          <Stack spacing={2.5}>
            {/* Account */}
            <Box sx={cardSx}>
              <Typography sx={sectionLabelSx}>{t('mobile.fan.profile.account')}</Typography>
              <Typography sx={{ ...typeScale.bodyStrong, color: 'common.white' }}>
                {user?.name || user?.email}
              </Typography>
              {user?.name && (
                <Typography sx={{ ...typeScale.caption, color: 'text.secondary' }}>{user?.email}</Typography>
              )}
              <Button
                data-testid="profile-signout"
                onClick={() => signOut()}
                variant="outlined"
                color="inherit"
                startIcon={<FhIcon name="back" inline />}
                sx={{ mt: 1.5, borderRadius: '12px', fontWeight: 700, ...focusRing(theme) }}
              >
                {t('mobile.fan.profile.signOut')}
              </Button>
            </Box>

            {/* Subscriptions */}
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
                <Typography sx={{ ...typeScale.title, color: 'common.white' }}>
                  {t('mobile.fan.profile.subsTitle')}
                </Typography>
                {totalSubs > 0 && (
                  <Button
                    data-testid="profile-clear-all"
                    onClick={() => prefs.clearAll()}
                    size="small"
                    startIcon={<FhIcon name="remove" inline />}
                    sx={{ color: 'text.secondary', fontWeight: 700, ...focusRing(theme) }}
                  >
                    {t('mobile.fan.profile.clearAll')}
                  </Button>
                )}
              </Box>

              {totalSubs === 0 ? (
                <EmptyState
                  icon={<FhIcon name="starOutline" sx={{ fontSize: 44 }} />}
                  title={t('mobile.fan.profile.subsTitle')}
                  description={t('mobile.fan.profile.subsEmpty')}
                />
              ) : (
                <Box sx={cardSx}>
                  {renderChips(t('mobile.fan.profile.clubs'), prefs.clubs, prefs.toggleClub)}
                  {renderChips(t('mobile.fan.profile.leagues'), prefs.leagues, prefs.toggleLeague)}
                  {renderChips(t('mobile.fan.profile.matches'), prefs.matches, prefs.toggleMatch)}
                </Box>
              )}
            </Box>
          </Stack>
        )}
      </Container>
    </Box>
  );
}
