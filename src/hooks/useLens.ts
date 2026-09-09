import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import { useSearchParams } from 'react-router-dom';
import { useCurrentUser } from './useCurrentUser';
import { useLocalStorage } from './useLocalStorage';
import { readLensEnv, toHexPubkey } from '@/lib/lensConfig';
import { useHttpRanks } from './useBrainstorm';
import { BRAINSTORM_API } from '@/lib/brainstorm';
import {
  KIND_TREASURE_MAP, indexScores, parseTreasureMap, rankFilters, resolveLens,
  type Lens, type LensProviders, type Provider, type Score,
} from '@/lib/pov';

const env = readLensEnv();

/** A pubkey's 10040 providers, read from the nip85 relay plus the active set. */
export function useTreasureMap(observer: string | undefined) {
  const { nostr } = useNostr();
  return useQuery<LensProviders | null>({
    queryKey: ['lens', 'treasure-map', observer ?? ''],
    enabled: !!observer,
    staleTime: 10 * 60_000,
    queryFn: async ({ signal }) => {
      const events = await nostr.query(
        [{ kinds: [KIND_TREASURE_MAP], authors: [observer!], limit: 1 }],
        { signal: AbortSignal.any([signal, AbortSignal.timeout(6000)]), relays: [env.nip85Relay] },
      ).catch(() => []);
      const latest = events.sort((a, b) => b.created_at - a.created_at)[0];
      return latest ? parseTreasureMap(latest) : null;
    },
  });
}

/**
 * Does Brainstorm have a computed POV for this observer? The batch endpoint silently serves
 * global scores for an unknown observer (verified live), so readiness is read from
 * /stats/pubkey with the personalised algorithm, which refuses with an error body.
 */
export function useHttpPovReady(observer: string | undefined) {
  return useQuery<boolean>({
    queryKey: ['brainstorm', 'pov-ready', observer ?? ''],
    enabled: !!observer,
    staleTime: 10 * 60_000,
    queryFn: async () => {
      const res = await fetch(`${BRAINSTORM_API}/stats/pubkey`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ pubkey: observer, pov: observer, algorithm: 'graperank-pov' }) }).catch(() => null);
      if (!res || res.status !== 200) return false;
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      return !body.error;
    },
  });
}

export interface LensState {
  lens: Lens;
  minRank: number;
  setMinRank: (n: number) => void;
  /** The logged-in user's POV status, for the onboarding prompt. */
  selfPov: 'none' | 'loading' | 'missing' | 'ready';
  urlPov?: string;
  author?: string;
  setAuthor: (npubOrHex: string | undefined) => void;
  setUrlPov: (npubOrHex: string | undefined) => void;
  env: typeof env;
}

/** PROTOCOL.md §8: ?author → ?pov → self → default → house. */
export function useLens(): LensState {
  const [params, setParams] = useSearchParams();
  const { user } = useCurrentUser();
  const [minRank, setMinRank] = useLocalStorage<number>('gleaner:min-rank', 1);
  const urlPov = toHexPubkey(params.get('pov'));
  const author = toHexPubkey(params.get('author'));
  const self = user?.pubkey;

  const urlMap = useTreasureMap(urlPov);
  const selfMap = useTreasureMap(self);
  const defaultMap = useTreasureMap(env.defaultPov);
  const urlHttp = useHttpPovReady(urlPov && !urlMap.data?.rank ? urlPov : undefined);
  const selfHttp = useHttpPovReady(self && !selfMap.data?.rank ? self : undefined);
  const defaultHttp = useHttpPovReady(env.defaultPov && !defaultMap.data?.rank ? env.defaultPov : undefined);

  const lens = useMemo(() => resolveLens({
    author,
    urlPov: urlPov ? { observer: urlPov, provider: urlMap.data?.rank, httpReady: urlHttp.data } : undefined,
    self: self ? { observer: self, provider: selfMap.data?.rank, httpReady: selfHttp.data } : undefined,
    defaultPov: env.defaultPov ? { observer: env.defaultPov, provider: defaultMap.data?.rank, httpReady: defaultHttp.data } : undefined,
    houseProvider: env.houseProvider ? { pubkey: env.houseProvider, relay: env.nip85Relay } : undefined,
  }), [author, urlPov, urlMap.data, urlHttp.data, self, selfMap.data, selfHttp.data, defaultMap.data, defaultHttp.data]);

  const selfPov: LensState['selfPov'] = !self ? 'none' : selfMap.isLoading || selfHttp.isLoading ? 'loading' : selfMap.data?.rank || selfHttp.data ? 'ready' : 'missing';

  const setParam = (name: string) => (v: string | undefined) => {
    const next = new URLSearchParams(params);
    const hex = toHexPubkey(v);
    if (hex) next.set(name, hex); else next.delete(name);
    setParams(next, { replace: true });
  };

  return { lens, minRank, setMinRank, selfPov, urlPov, author, setAuthor: setParam('author'), setUrlPov: setParam('pov'), env };
}

/** Ranks for a set of pubkeys under a lens: kind-30382 via the observer's provider, or Brainstorm HTTP. */
export function useRanks(lens: Pick<Lens, 'provider' | 'observer' | 'via' | 'source'> | Provider | undefined, pubkeys: string[]) {
  const l: Pick<Lens, 'provider' | 'observer' | 'via'> = lens && 'pubkey' in lens ? { provider: lens, via: 'relay' } : (lens ?? {});
  const relay = useRelayRanks(l.via === 'relay' ? l.provider : undefined, pubkeys);
  const http = useHttpRanks(l.via === 'http' ? l.observer : undefined, pubkeys);
  return l.via === 'http' ? { ...http, data: http.data?.scores, httpState: http.data?.state } : { ...relay, httpState: undefined };
}

function useRelayRanks(provider: Provider | undefined, pubkeys: string[]) {
  const { nostr } = useNostr();
  const sorted = useMemo(() => [...new Set(pubkeys)].sort(), [pubkeys]);
  return useQuery<Map<string, Score>>({
    queryKey: ['lens', 'ranks', provider?.pubkey ?? '', sorted],
    enabled: !!provider && sorted.length > 0,
    staleTime: 5 * 60_000,
    placeholderData: (prev) => prev,
    queryFn: async ({ signal }) => {
      const filters = rankFilters(provider!, sorted);
      const relays = [provider!.relay ?? env.nip85Relay];
      const events = await nostr.query(filters, { signal: AbortSignal.any([signal, AbortSignal.timeout(8000)]), relays }).catch(() => []);
      return indexScores(events, provider!.pubkey);
    },
  });
}
