import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import { useSearchParams } from 'react-router-dom';
import { useCurrentUser } from './useCurrentUser';
import { useLocalStorage } from './useLocalStorage';
import { readLensEnv, toHexPubkey } from '@/lib/lensConfig';
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

  const lens = useMemo(() => resolveLens({
    author,
    urlPov: urlPov ? { observer: urlPov, provider: urlMap.data?.rank } : undefined,
    self: self ? { observer: self, provider: selfMap.data?.rank } : undefined,
    defaultPov: env.defaultPov ? { observer: env.defaultPov, provider: defaultMap.data?.rank } : undefined,
    houseProvider: env.houseProvider ? { pubkey: env.houseProvider, relay: env.nip85Relay } : undefined,
  }), [author, urlPov, urlMap.data, self, selfMap.data, defaultMap.data]);

  const selfPov: LensState['selfPov'] = !self ? 'none' : selfMap.isLoading ? 'loading' : selfMap.data?.rank ? 'ready' : 'missing';

  const setParam = (name: string) => (v: string | undefined) => {
    const next = new URLSearchParams(params);
    const hex = toHexPubkey(v);
    if (hex) next.set(name, hex); else next.delete(name);
    setParams(next, { replace: true });
  };

  return { lens, minRank, setMinRank, selfPov, urlPov, author, setAuthor: setParam('author'), setUrlPov: setParam('pov'), env };
}

/** Ranks for a set of pubkeys under a provider; unscored pubkeys are simply absent. */
export function useRanks(provider: Provider | undefined, pubkeys: string[]) {
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
