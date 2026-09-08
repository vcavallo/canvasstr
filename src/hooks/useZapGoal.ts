import { useNostr } from '@nostrify/react';
import { useQuery } from '@tanstack/react-query';
import { useAppContext } from '@/hooks/useAppContext';
import { getActiveRelays } from '@/lib/relays';
import { calculateGoalProgress, type GoalProgress } from '@/lib/catallax';
import type { NostrEvent } from '@nostrify/nostrify';

interface ZapGoalData {
  goal: NostrEvent;
  receipts: NostrEvent[];
  progress: GoalProgress;
}

type ReceiptFilter = { kinds: number[]; '#e'?: string[]; '#a'?: string[]; limit?: number };

// Direct WebSocket query to specific relays - bypasses NPool issues. Accepts multiple
// filters so a single REQ (one round-trip) can fetch by both `#e` and `#a` at once.
async function queryRelaysDirect(
  relays: string[],
  filters: ReceiptFilter[],
  timeoutMs: number = 8000
): Promise<NostrEvent[]> {
  const allEvents: NostrEvent[] = [];
  const seenIds = new Set<string>();

  const promises = relays.map(relayUrl =>
    new Promise<NostrEvent[]>((resolve) => {
      const events: NostrEvent[] = [];
      try {
        const ws = new WebSocket(relayUrl);
        const subId = 'zap-' + Math.random().toString(36).slice(2);

        const timeout = setTimeout(() => {
          ws.close();
          resolve(events);
        }, timeoutMs);

        ws.onopen = () => {
          ws.send(JSON.stringify(['REQ', subId, ...filters]));
        };

        ws.onmessage = (msg) => {
          try {
            const data = JSON.parse(msg.data);
            if (data[0] === 'EVENT' && data[1] === subId) {
              events.push(data[2] as NostrEvent);
            } else if (data[0] === 'EOSE') {
              clearTimeout(timeout);
              ws.close();
              resolve(events);
            }
          } catch {
            // Ignore parse errors
          }
        };

        ws.onerror = () => {
          clearTimeout(timeout);
          ws.close();
          resolve(events);
        };
      } catch {
        resolve(events);
      }
    })
  );

  const results = await Promise.all(promises);
  for (const events of results) {
    for (const event of events) {
      if (!seenIds.has(event.id)) {
        seenIds.add(event.id);
        allEvents.push(event);
      }
    }
  }

  return allEvents;
}

export function useZapGoal(goalId: string | undefined) {
  const { nostr } = useNostr();
  const { config, presetRelays } = useAppContext();
  const activeRelays = getActiveRelays(config, presetRelays);

  return useQuery<ZapGoalData | null>({
    queryKey: ['zap-goal', goalId, activeRelays],
    queryFn: async (c) => {
      if (!goalId) return null;

      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(10000)]);

      // Fetch goal event first
      const goals = await nostr.query([{ ids: [goalId], kinds: [9041] }], { signal });
      const goal = goals[0];
      if (!goal) return null;

      // Extract the goal's linked addressable event (a tag) if any
      const linkedAddress = goal.tags.find(([name]) => name === 'a')?.[1];

      // Query the user's active relay set together with any relays the goal declares.
      // The active set is the reliable read path — the goal's embedded `relays` tag can
      // be stale or unreachable (e.g. a `ws://127.0.0.1` dev relay viewed from another
      // machine), so we never rely on it alone, and we keep no hardcoded relay fallback
      // (the active set is the overridable source of truth, per the prime directive).
      const goalRelays = goal.tags.find(([name]) => name === 'relays')?.slice(1) || [];
      const relaysToQuery = [...new Set([...activeRelays, ...goalRelays])];

      // Fetch zap receipts in a SINGLE round-trip: one REQ carrying both the `#e`
      // (goal id) and, when present, the `#a` (linked addressable) filter — instead
      // of two sequential queries. Direct WebSocket (bypasses NPool issues).
      const filters: ReceiptFilter[] = [{ kinds: [9735], '#e': [goalId], limit: 500 }];
      if (linkedAddress) {
        filters.push({ kinds: [9735], '#a': [linkedAddress], limit: 500 });
      }
      const receipts = await queryRelaysDirect(relaysToQuery, filters);

      // Deduplicate receipts by event ID
      const seen = new Set<string>();
      const uniqueReceipts = receipts.filter(r => {
        if (seen.has(r.id)) return false;
        seen.add(r.id);
        return true;
      });

      const progress = calculateGoalProgress(goal, uniqueReceipts);

      return {
        goal,
        receipts: uniqueReceipts,
        progress,
      };
    },
    enabled: !!goalId,
    staleTime: 30000, // 30 seconds - balance freshness vs relay load
    refetchOnWindowFocus: true,
  });
}
