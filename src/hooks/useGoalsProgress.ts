import { useNostr } from '@nostrify/react';
import { useQuery } from '@tanstack/react-query';
import { useAppContext } from '@/hooks/useAppContext';
import { getActiveRelays } from '@/lib/relays';
import { calculateGoalProgress, type GoalProgress } from '@/lib/catallax';

/**
 * Fetch funding progress for many goals in ONE pooled query (the 9041 goals + their
 * 9735 receipts), returning a `Map<goalId, GoalProgress>`. Used by the browse so a
 * funding-progress sort is deterministic (vs. a query per card). Reads the configured
 * relays.
 */
export function useGoalsProgress(goalIds: string[]): {
  progressByGoal: Map<string, GoalProgress>;
  isLoading: boolean;
} {
  const { nostr } = useNostr();
  const { config, presetRelays } = useAppContext();
  const relays = getActiveRelays(config, presetRelays);
  const ids = [...new Set(goalIds)].sort();

  const query = useQuery({
    queryKey: ['goals-progress', ids, relays],
    queryFn: async (c) => {
      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(8000)]);
      const events = await nostr.query(
        [
          { kinds: [9041], ids },
          { kinds: [9735], '#e': ids },
        ],
        relays.length > 0 ? { signal, relays } : { signal },
      );
      const goals = events.filter((e) => e.kind === 9041);
      const receipts = events.filter((e) => e.kind === 9735);
      const map = new Map<string, GoalProgress>();
      for (const goal of goals) {
        const goalReceipts = receipts.filter((r) => r.tags.some((t) => t[0] === 'e' && t[1] === goal.id));
        map.set(goal.id, calculateGoalProgress(goal, goalReceipts));
      }
      return map;
    },
    enabled: ids.length > 0,
    staleTime: 30_000,
  });

  return { progressByGoal: query.data ?? new Map<string, GoalProgress>(), isLoading: query.isLoading };
}
