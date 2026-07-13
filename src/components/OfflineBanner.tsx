import { ConnectionBanner } from '@fh/ui';
import { useOnline } from '../lib/useOnline';

/**
 * App-level offline strip (SPEC-PRD-055 Spec-AC-06): while the connection is
 * down it pins the `@fh/ui` ConnectionBanner above the screen so the fan knows
 * the shown data may be stale; the last-cached content stays visible below it.
 * Renders nothing while online.
 */
export function OfflineBanner(): JSX.Element | null {
  const online = useOnline();
  if (online) return null;
  return <ConnectionBanner status="offline" message="Nejste online — zobrazená data mohou být zastaralá" />;
}
