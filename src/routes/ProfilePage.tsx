import { useTranslation } from '@fh/i18n';
import { FanStubScreen } from './FanStubScreen';

/**
 * PRD-055 Phase 2 — Profile STUB at `/<slug>/profile`. Profile's data (fan
 * preferences / sign-in) is PRD-034 AC-008, a SEPARATE effort. Until then the
 * screen ships its designed EmptyState (Spec-AC-05).
 */
export default function ProfilePage(): JSX.Element {
  const { t } = useTranslation();
  return (
    <FanStubScreen
      testid="profile-screen"
      icon="settings"
      title={t('mobile.fan.profile.title')}
      emptyTitle={t('mobile.fan.profile.empty')}
      emptyDescription={t('mobile.fan.profile.emptyDesc')}
    />
  );
}
