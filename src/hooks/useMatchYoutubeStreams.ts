import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { youtubeStreamPreviewEnabled } from '../lib/releaseGate';
import { isUuidShaped } from '../lib/matchReadId';
import {
  fetchMatchYoutubeStreams,
  type PublicMatchYoutubeStream,
} from '../lib/adapters/youtubeStreams';

const EMPTY_MAP = new Map<string, PublicMatchYoutubeStream>();

/**
 * Batch-load public current YouTube streams for visible matches via the
 * anon-pinned Supabase client. Completely skips network calls when the test
 * release gate disables previews or when no UUID ids are ready.
 */
export function useMatchYoutubeStreams(
  tenantId: string | null | undefined,
  matchIds: readonly (string | null | undefined)[],
): Map<string, PublicMatchYoutubeStream> {
  const enabled = youtubeStreamPreviewEnabled();
  const [streams, setStreams] = useState<Map<string, PublicMatchYoutubeStream>>(EMPTY_MAP);

  const normalizedIds = useMemo(() => {
    const unique = new Set<string>();
    for (const id of matchIds) {
      if (id && isUuidShaped(id)) unique.add(id);
    }
    return Array.from(unique).sort();
  }, [matchIds]);

  const idsKey = normalizedIds.join(',');

  useEffect(() => {
    if (!enabled || !isUuidShaped(tenantId ?? undefined) || normalizedIds.length === 0) {
      setStreams(EMPTY_MAP);
      return;
    }

    let cancelled = false;
    void fetchMatchYoutubeStreams(supabase, tenantId, normalizedIds).then((map) => {
      if (!cancelled) {
        setStreams(map);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [enabled, tenantId, idsKey]);

  return streams;
}

/** Single-match convenience hook sharing the same anon RPC + gate contract. */
export function useMatchYoutubeStream(
  tenantId: string | null | undefined,
  matchId: string | null | undefined,
): PublicMatchYoutubeStream | null {
  const ids = useMemo(() => (matchId ? [matchId] : []), [matchId]);
  const map = useMatchYoutubeStreams(tenantId, ids);
  return matchId ? map.get(matchId) ?? null : null;
}
