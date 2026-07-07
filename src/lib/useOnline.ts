import { useSyncExternalStore } from 'react';

function subscribe(callback: () => void): () => void {
  window.addEventListener('online', callback);
  window.addEventListener('offline', callback);
  return () => {
    window.removeEventListener('online', callback);
    window.removeEventListener('offline', callback);
  };
}

/**
 * Reactive connectivity signal — `true` while online, flips on the browser
 * online/offline events. Backs the fan app's offline posture (SPEC-PRD-055
 * Spec-AC-06). Defaults to online during SSR/first paint.
 */
export function useOnline(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true,
  );
}
