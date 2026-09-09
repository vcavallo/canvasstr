import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCurrentUser } from './useCurrentUser';
import { useLocalStorage } from './useLocalStorage';
import { usePublishTo } from './usePublishTo';
import { readLensEnv } from '@/lib/lensConfig';
import {
  BRAINSTORM_API, POLL_SECONDS, buildLoginTemplate, httpRankToScore, isTreasureMapRow, parseHistory, parseRankResults, parseResultStatus, povState,
  type BrainstormHistory, type PovState,
} from '@/lib/brainstorm';
import { KIND_TREASURE_MAP, type Score } from '@/lib/pov';

const env = readLensEnv();

async function api<T = unknown>(path: string, init: RequestInit = {}): Promise<{ status: number; body: T; headers: Headers }> {
  const res = await fetch(BRAINSTORM_API + path, init);
  const text = await res.text();
  let body: unknown = text;
  try { body = JSON.parse(text); } catch { /* text */ }
  return { status: res.status, body: body as T, headers: res.headers };
}

export type HttpRankState = 'ok' | 'computing' | 'unprovisioned' | 'error';

/**
 * Ranks of `pubkeys` under observer `pov` via Brainstorm's Open Ranking batch endpoint.
 * Used when the lens observer has no kind-10040 (or as a fallback). 202 → computing,
 * 422 → the POV has never been calculated.
 */
export function useHttpRanks(pov: string | undefined, pubkeys: string[], enabled = true) {
  const sorted = useMemo(() => [...new Set(pubkeys.filter((p) => /^[0-9a-f]{64}$/.test(p)))].sort(), [pubkeys]);
  return useQuery<{ state: HttpRankState; scores: Map<string, Score> }>({
    queryKey: ['brainstorm', 'ranks', pov ?? '', sorted],
    enabled: enabled && !!pov && sorted.length > 0,
    staleTime: 5 * 60_000,
    placeholderData: (prev) => prev,
    queryFn: async () => {
      const scores = new Map<string, Score>();
      for (let i = 0; i < sorted.length; i += 900) {
        const chunk = sorted.slice(i, i + 900);
        const r = await api('/rank/pubkeys', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ pubkeys: chunk, pov }) });
        if (r.status === 202) return { state: 'computing', scores };
        if (r.status === 422) return { state: 'unprovisioned', scores };
        if (r.status !== 200) return { state: 'error', scores };
        for (const x of parseRankResults(r.body)) scores.set(x.pubkey, { subject: x.pubkey, rank: httpRankToScore(x.rank), created_at: Math.floor(Date.now() / 1000) });
      }
      return { state: 'ok', scores };
    },
  });
}

export interface BrainstormAccount {
  /** Logged-in user's Brainstorm POV status. */
  state: PovState | 'loggedout' | 'busy';
  history: BrainstormHistory | null;
  error?: string;
  /** One click: challenge login (creates the account) then queue a calculation. */
  createPov: () => Promise<void>;
  /** Sign and publish the kind-10040 that delegates 30382 reads to Brainstorm's assistant key. */
  publishTreasureMap: () => Promise<void>;
  hasToken: boolean;
}

export function useBrainstormAccount(): BrainstormAccount {
  const { user } = useCurrentUser();
  const pk = user?.pubkey;
  const [tokens, setTokens] = useLocalStorage<Record<string, string>>('gleaner:brainstorm-tokens', {});
  const token = pk ? tokens[pk] : undefined;
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const { mutateAsync: publishTo } = usePublishTo();
  const qc = useQueryClient();

  const history = useQuery<{ history: BrainstormHistory | null; result?: ReturnType<typeof parseResultStatus> }>({
    queryKey: ['brainstorm', 'history', pk ?? '', !!token],
    enabled: !!pk && !!token,
    refetchInterval: (q) => (q.state.data && povState(q.state.data.history, q.state.data.result) === 'computing' ? POLL_SECONDS * 1000 : false),
    queryFn: async () => {
      const H = { authorization: `Bearer ${token}` };
      const r = await api('/user/history', { headers: H });
      if (r.status === 401) { setTokens((t) => { const n = { ...t }; delete n[pk!]; return n; }); return { history: null }; }
      const res = await api('/user/graperankResult', { headers: H }).catch(() => null);
      return { history: parseHistory(r.body), result: res ? parseResultStatus(res.body) : undefined };
    },
  });

  const login = useCallback(async (): Promise<string> => {
    if (!user) throw new Error('Log in first.');
    const ch = await api<{ data?: { challenge?: string } }>(`/authChallenge/${user.pubkey}`);
    const challenge = ch.body?.data?.challenge;
    if (!challenge) throw new Error('Brainstorm did not issue a challenge.');
    const signed = await user.signer.signEvent({ ...buildLoginTemplate(challenge), created_at: Math.floor(Date.now() / 1000) });
    const v = await api<{ data?: { token?: string } }>(`/authChallenge/${user.pubkey}/verify`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ signed_event: signed }) });
    const jwt = v.body?.data?.token;
    if (!jwt) throw new Error('Brainstorm rejected the signed login.');
    setTokens((t) => ({ ...t, [user.pubkey]: jwt }));
    return jwt;
  }, [user, setTokens]);

  const createPov = useCallback(async () => {
    setError(undefined); setBusy(true);
    try {
      const jwt = token ?? (await login());
      const r = await api('/user/graperank', { method: 'POST', headers: { authorization: `Bearer ${jwt}` } });
      if (r.status === 429) throw new Error(`Brainstorm is rate-limiting calculations (try again in ${r.headers.get('retry-after') ?? '30 min'}).`);
      if (r.status === 401) { setTokens((t) => { const n = { ...t }; delete n[pk!]; return n; }); throw new Error('Brainstorm session expired; click again.'); }
      if (r.status !== 200) throw new Error(`Brainstorm refused the request (${r.status}${r.headers.get('x-reason') ? ': ' + r.headers.get('x-reason') : ''}).`);
      await qc.invalidateQueries({ queryKey: ['brainstorm', 'history'] });
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  }, [token, login, qc, pk, setTokens]);

  const publishTreasureMap = useCallback(async () => {
    if (!pk) return;
    setError(undefined); setBusy(true);
    try {
      const r = await api<string[][]>(`/setup/${pk}`);
      const rows = Array.isArray(r.body) ? r.body.filter(isTreasureMapRow) : [];
      if (rows.length === 0) throw new Error('Brainstorm has no delegation rows for you yet.');
      const relays = [...new Set([env.nip85Relay, ...rows.map((row) => row[2]).filter((x) => /^wss:\/\//.test(x))])];
      await publishTo({ template: { kind: KIND_TREASURE_MAP, content: '', tags: rows }, relays });
      await qc.invalidateQueries({ queryKey: ['lens', 'treasure-map', pk] });
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  }, [pk, publishTo, qc]);

  // Once a calculation completes, refresh any HTTP ranks read under this POV.
  const st = povState(history.data?.history ?? null, history.data?.result);
  useEffect(() => { if (st === 'ready') void qc.invalidateQueries({ queryKey: ['brainstorm', 'ranks', pk] }); }, [st, pk, qc]);

  return {
    state: !pk ? 'loggedout' : busy ? 'busy' : !token ? 'none' : history.isLoading ? 'unknown' : st,
    history: history.data?.history ?? null, error, createPov, publishTreasureMap, hasToken: !!token,
  };
}
