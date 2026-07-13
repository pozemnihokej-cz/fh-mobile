import { useTranslation } from '@fh/i18n';
import { FanStubScreen } from './FanStubScreen';

/**
 * PRD-055 Phase 2 — News STUB at `/<slug>/news`. No news source exists; the
 * screen ships its designed EmptyState (Spec-AC-05).
 */
export default function NewsPage(): JSX.Element {
  const { t } = useTranslation();
  return (
    <FanStubScreen
      testid="news-screen"
      icon="events"
      title={t('mobile.fan.news.title')}
      emptyTitle={t('mobile.fan.news.empty')}
      emptyDescription={t('mobile.fan.news.emptyDesc')}
    />
  );
}
