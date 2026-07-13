import { useLocation, useNavigate } from 'react-router-dom';
import { Box, BottomNavigation, BottomNavigationAction, alpha, useTheme } from '@mui/material';
import { FhIcon, focusRing, type FhIconName } from '@fh/ui';
import { useTranslation } from '@fh/i18n';
import { useTenantContext } from '../routes/TenantContext';

/**
 * PRD-055 Phase 2 (Spec-AC-04): the fan bottom navigation. Pinned tab bar that
 * makes the core fan screens reachable from every `/<slug>/*` route. Glyphs come
 * from the @fh/ui icon vocabulary; the active tab is derived from the URL.
 */
interface NavItem {
  segment: string;
  labelKey: string;
  icon: FhIconName;
}

const ITEMS: NavItem[] = [
  { segment: 'matches', labelKey: 'mobile.fan.nav.matches', icon: 'hockey' },
  { segment: 'standings', labelKey: 'mobile.fan.nav.standings', icon: 'shootout' },
  { segment: 'schedule', labelKey: 'mobile.fan.nav.schedule', icon: 'events' },
  { segment: 'search', labelKey: 'mobile.fan.nav.search', icon: 'search' },
  { segment: 'profile', labelKey: 'mobile.fan.nav.profile', icon: 'settings' },
];

export function FanBottomNav(): JSX.Element | null {
  const { slug } = useTenantContext();
  const { t } = useTranslation();
  const theme = useTheme();
  const navigate = useNavigate();
  const location = useLocation();

  if (!slug) return null;

  const active = ITEMS.findIndex((it) => location.pathname.startsWith(`/${slug}/${it.segment}`));

  return (
    <Box
      data-testid="fan-bottom-nav"
      sx={{
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 1200,
        borderTop: `1px solid ${alpha(theme.palette.common.white, 0.08)}`,
        bgcolor: alpha(theme.palette.common.black, 0.6),
        backdropFilter: 'blur(16px)',
      }}
    >
      <BottomNavigation
        showLabels
        value={active === -1 ? false : active}
        sx={{ bgcolor: 'transparent', maxWidth: 480, mx: 'auto' }}
      >
        {ITEMS.map((it) => (
          <BottomNavigationAction
            key={it.segment}
            label={t(it.labelKey)}
            data-testid={`fan-nav-${it.segment}`}
            onClick={() => navigate(`/${slug}/${it.segment}`)}
            icon={<FhIcon name={it.icon} />}
            sx={{
              color: alpha(theme.palette.common.white, 0.55),
              '&.Mui-selected': { color: theme.palette.primary.main },
              ...focusRing(theme),
            }}
          />
        ))}
      </BottomNavigation>
    </Box>
  );
}
