import { useTranslation } from '@fh/i18n';
import { FanStubScreen } from './FanStubScreen';

/**
 * PRD-055 Phase 2 — Notifications STUB at `/<slug>/notifications`. No feed
 * source exists (delivery is out of scope); ships its designed EmptyState
 * (Spec-AC-05).
 */
export default function NotificationsPage(): JSX.Element {
  const { t } = useTranslation();
  return (
    <FanStubScreen
      testid="notifications-screen"
      icon="events"
      title={t('mobile.fan.notifications.title')}
      emptyTitle={t('mobile.fan.notifications.empty')}
      emptyDescription={t('mobile.fan.notifications.emptyDesc')}
    />
  );
}
