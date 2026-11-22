import type { SupabaseClient } from '@supabase/supabase-js';
import { isUuidShaped } from '../matchReadId';

/** Public SECURITY DEFINER RPC exposing non-secret current broadcast metadata. */
export const PUBLIC_YOUTUBE_STREAM_RPC = 'public_match_youtube_streams';

/** Lifecycle statuses surfaced in the public fan app. */
export const ELIGIBLE_PUBLIC_YOUTUBE_STATUSES = new Set([
  'scheduled',
  'ready',
  'live',
  'complete',
] as const);

export type PublicYoutubeStatus = 'scheduled' | 'ready' | 'live' | 'complete';

export const YOUTUBE_BROADCAST_ID_RE = /^[A-Za-z0-9_-]{6,64}$/;

export interface PublicMatchYoutubeStream {
  matchId: string;
  broadcastId: string;
  youtubeUrl: string;
  embedUrl: string;
  status: PublicYoutubeStatus;
}

export type YoutubeRpcClient = Pick<SupabaseClient, 'rpc'>;

interface RawPublicYoutubeRow {
  match_id?: unknown;
  broadcast_id?: unknown;
  youtube_url?: unknown;
  status?: unknown;
}

export function buildYoutubeWatchUrl(broadcastId: string): string {
  return `https://www.youtube.com/watch?v=${broadcastId}`;
}

export function buildYoutubeEmbedUrl(broadcastId: string): string {
  return `https://www.youtube.com/embed/${broadcastId}`;
}

export function isPublicYoutubeStreamLive(stream: PublicMatchYoutubeStream): boolean {
  const liveStatus: PublicYoutubeStatus = 'live';
  return stream.status === liveStatus;
}

/** Sanitize one RPC row into canonical watch/embed URLs, or reject if invalid. */
export function sanitizePublicYoutubeStreamRow(raw: unknown): PublicMatchYoutubeStream | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as RawPublicYoutubeRow;
  const matchId = typeof row.match_id === 'string' ? row.match_id.trim() : '';
  const broadcastId = typeof row.broadcast_id === 'string' ? row.broadcast_id.trim() : '';
  const status = typeof row.status === 'string' ? row.status.trim() : '';

  if (!isUuidShaped(matchId)) return null;
  if (!YOUTUBE_BROADCAST_ID_RE.test(broadcastId)) return null;
  if (!ELIGIBLE_PUBLIC_YOUTUBE_STATUSES.has(status as PublicYoutubeStatus)) return null;

  return {
    matchId,
    broadcastId,
    youtubeUrl: buildYoutubeWatchUrl(broadcastId),
    embedUrl: buildYoutubeEmbedUrl(broadcastId),
    status: status as PublicYoutubeStatus,
  };
}

/**
 * Fetch sanitized current YouTube stream metadata for a list of match UUIDs
 * within one tenant. Fails open to an empty map on invalid inputs or RPC errors
 * so match lists and match detail stay resilient.
 */
export async function fetchMatchYoutubeStreams(
  client: YoutubeRpcClient | null | undefined,
  tenantId: string | null | undefined,
  matchIds: readonly string[],
): Promise<Map<string, PublicMatchYoutubeStream>> {
  const out = new Map<string, PublicMatchYoutubeStream>();
  if (!isUuidShaped(tenantId ?? undefined)) return out;
  if (!client || typeof (client as { rpc?: unknown }).rpc !== 'function') return out;

  const uniqueIds = Array.from(new Set(matchIds.filter((id) => isUuidShaped(id))));
  if (uniqueIds.length === 0) return out;

  try {
    const { data, error } = await client.rpc(PUBLIC_YOUTUBE_STREAM_RPC, {
      p_tenant_id: tenantId!,
      p_match_ids: uniqueIds,
    });
    if (error || !Array.isArray(data)) return out;

    for (const raw of data) {
      const sanitized = sanitizePublicYoutubeStreamRow(raw);
      if (sanitized && !out.has(sanitized.matchId)) {
        out.set(sanitized.matchId, sanitized);
      }
    }
    return out;
  } catch {
    return out;
  }
}
