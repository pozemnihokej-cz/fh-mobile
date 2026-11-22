/**
 * TEST-003 (Spec-AC-04, Spec-AC-05): YouTube stream public read adapter and hook gating.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, waitFor, cleanup } from '@testing-library/react';
import {
  fetchMatchYoutubeStreams,
  PUBLIC_YOUTUBE_STREAM_RPC,
  type YoutubeRpcClient,
} from '../adapters/youtubeStreams';

const TENANT_ID = '11111111-1111-4111-8111-111111111111';
const MATCH_1 = '22222222-2222-4222-8222-222222222222';
const MATCH_2 = '33333333-3333-4333-8333-333333333333';

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe('TEST-003 (Spec-AC-04, Spec-AC-05): fetchMatchYoutubeStreams adapter', () => {
  it('calls public_match_youtube_streams with deduplicated UUIDs and maps eligible statuses', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [
        {
          match_id: MATCH_1,
          broadcast_id: 'dQw4w9WgXcQ',
          youtube_url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
          status: 'live',
        },
        {
          match_id: MATCH_2,
          broadcast_id: 'abc123_XYZ-',
          youtube_url: null,
          status: 'scheduled',
        },
      ],
      error: null,
    });

    const result = await fetchMatchYoutubeStreams(
      { rpc },
      TENANT_ID,
      [MATCH_1, 'not-a-uuid', MATCH_2, MATCH_1],
    );

    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith(PUBLIC_YOUTUBE_STREAM_RPC, {
      p_tenant_id: TENANT_ID,
      p_match_ids: [MATCH_1, MATCH_2],
    });

    expect(result.size).toBe(2);
    expect(result.get(MATCH_1)).toEqual({
      matchId: MATCH_1,
      broadcastId: 'dQw4w9WgXcQ',
      youtubeUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      embedUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
      status: 'live',
    });
    expect(result.get(MATCH_2)).toEqual({
      matchId: MATCH_2,
      broadcastId: 'abc123_XYZ-',
      youtubeUrl: 'https://www.youtube.com/watch?v=abc123_XYZ-',
      embedUrl: 'https://www.youtube.com/embed/abc123_XYZ-',
      status: 'scheduled',
    });
  });

  it('filters out non-eligible statuses (provisioning/failed/cancelled) and malformed broadcast ids', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [
        { match_id: MATCH_1, broadcast_id: 'validId123', youtube_url: null, status: 'provisioning' },
        { match_id: MATCH_1, broadcast_id: 'validId123', youtube_url: null, status: 'failed' },
        { match_id: MATCH_1, broadcast_id: 'validId123', youtube_url: null, status: 'cancelled' },
        { match_id: MATCH_2, broadcast_id: 'bad?id=1/../../', youtube_url: 'https://evil.example', status: 'ready' },
      ],
      error: null,
    });

    const result = await fetchMatchYoutubeStreams({ rpc }, TENANT_ID, [MATCH_1, MATCH_2]);
    expect(result.size).toBe(0);
  });

  it('skips RPC completely for non-UUID tenantId or when matchIds contain no UUIDs', async () => {
    const rpc = vi.fn();
    expect((await fetchMatchYoutubeStreams({ rpc }, 'not-a-uuid', [MATCH_1])).size).toBe(0);
    expect((await fetchMatchYoutubeStreams({ rpc }, TENANT_ID, ['78901', ''])).size).toBe(0);
    expect((await fetchMatchYoutubeStreams({ rpc }, null, [MATCH_1])).size).toBe(0);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('fails open to an empty map on RPC error, thrown exception, or missing .rpc method', async () => {
    const errRpc = vi.fn().mockResolvedValue({ data: null, error: { message: 'db down' } });
    expect((await fetchMatchYoutubeStreams({ rpc: errRpc }, TENANT_ID, [MATCH_1])).size).toBe(0);

    const throwRpc = vi.fn().mockRejectedValue(new Error('network fail'));
    expect((await fetchMatchYoutubeStreams({ rpc: throwRpc }, TENANT_ID, [MATCH_1])).size).toBe(0);

    expect((await fetchMatchYoutubeStreams({} as YoutubeRpcClient, TENANT_ID, [MATCH_1])).size).toBe(0);
  });
});

describe('TEST-003 (Spec-AC-01, Spec-AC-05): useMatchYoutubeStreams hook gating & anon client', () => {
  it('does not invoke supabase.rpc when production gate disables preview', async () => {
    const rpcSpy = vi.fn().mockResolvedValue({ data: [], error: null });
    vi.stubEnv('PROD', true);
    vi.stubEnv('VITE_ENABLE_FAN_YOUTUBE_PREVIEW', '');
    vi.doMock('../supabase', () => ({
      supabase: { rpc: rpcSpy },
      authSupabase: { rpc: vi.fn() },
    }));

    const { useMatchYoutubeStreams } = await import('../../hooks/useMatchYoutubeStreams');
    const { result } = renderHook(() => useMatchYoutubeStreams(TENANT_ID, [MATCH_1]));
    expect(result.current.size).toBe(0);
    expect(rpcSpy).not.toHaveBeenCalled();
  });

  it('queries anon-pinned supabase when enabled and returns mapped streams', async () => {
    const rpcSpy = vi.fn().mockResolvedValue({
      data: [{ match_id: MATCH_1, broadcast_id: 'streamKeyOk99', youtube_url: null, status: 'complete' }],
      error: null,
    });
    const authRpcSpy = vi.fn();
    vi.stubEnv('PROD', true);
    vi.stubEnv('VITE_ENABLE_FAN_YOUTUBE_PREVIEW', 'true');
    vi.doMock('../supabase', () => ({
      supabase: { rpc: rpcSpy },
      authSupabase: { rpc: authRpcSpy },
    }));

    const { useMatchYoutubeStreams } = await import('../../hooks/useMatchYoutubeStreams');
    const { result } = renderHook(() => useMatchYoutubeStreams(TENANT_ID, [MATCH_1]));

    await waitFor(() => {
      expect(result.current.get(MATCH_1)?.broadcastId).toBe('streamKeyOk99');
    });
    expect(rpcSpy).toHaveBeenCalledTimes(1);
    expect(authRpcSpy).not.toHaveBeenCalled();
  });
});
