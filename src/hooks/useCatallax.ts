import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import { useAppContext } from '@/hooks/useAppContext';
import { getActiveRelays } from '@/lib/relays';
import {
  CATALLAX_KINDS,
  parseArbiterAnnouncement,
  parseTaskProposal,
  parseTaskConclusion,
  type ArbiterAnnouncement,
  type TaskProposal,
  type TaskConclusion,
  type TaskStatus
} from '@/lib/catallax';

// Utility hook for invalidating all Catallax-related queries
export function useCatallaxInvalidation() {
  const queryClient = useQueryClient();

  const invalidateAllCatallaxQueries = () => {
    // Invalidate all catallax queries
    queryClient.invalidateQueries({ queryKey: ['catallax'] });

    // Also invalidate specific task detail queries
    queryClient.invalidateQueries({ queryKey: ['task-detail'] });

    // Invalidate arbiter announcement queries
    queryClient.invalidateQueries({ queryKey: ['arbiter-announcement'] });
  };

  return { invalidateAllCatallaxQueries };
}

export function useArbiterAnnouncements() {
  const { nostr } = useNostr();
  const { config, presetRelays } = useAppContext();
  const activeRelays = getActiveRelays(config, presetRelays);

  return useQuery({
    queryKey: ['catallax', 'arbiters', activeRelays],
    queryFn: async (c) => {
      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(10000)]);
      const events = await nostr.query([
        {
          kinds: [CATALLAX_KINDS.ARBITER_ANNOUNCEMENT],
          '#t': ['catallax'],
          limit: 300, // Increase limit to get all versions
        }
      ], { signal });

      const parsedAnnouncements = events
        .map(parseArbiterAnnouncement)
        .filter((announcement): announcement is ArbiterAnnouncement => announcement !== null);

      // Handle parameterized replaceable events - only keep the latest per pubkey+d combination
      const latestAnnouncements = new Map<string, ArbiterAnnouncement>();

      parsedAnnouncements.forEach(announcement => {
        const key = `${announcement.pubkey}:${announcement.d}`;
        const existing = latestAnnouncements.get(key);

        if (!existing || announcement.created_at > existing.created_at) {
          latestAnnouncements.set(key, announcement);
        }
      });

      return Array.from(latestAnnouncements.values())
        .sort((a, b) => b.created_at - a.created_at);
    },
  });
}

export function useTaskProposals(status?: TaskStatus) {
  const { nostr } = useNostr();
  const { config, presetRelays } = useAppContext();
  const activeRelays = getActiveRelays(config, presetRelays);

  return useQuery({
    queryKey: ['catallax', 'tasks', status, activeRelays],
    queryFn: async (c) => {
      // Lower than the other catallax queries: the browse shows cached-first (SWR +
      // persisted cache), so a snappier cold-load budget beats blocking on a slow relay.
      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(5000)]);

      // Don't filter by status in the query - get ALL task events and filter after deduplication
      // This ensures we get all versions of each task to find the latest status
      const filters = [
        {
          kinds: [CATALLAX_KINDS.TASK_PROPOSAL],
          '#t': ['catallax'],
          limit: 1000, // Increase limit significantly to ensure we get all versions
        }
      ];

      const events = await nostr.query(filters, { signal });

      const parsedTasks = events
        .map(parseTaskProposal)
        .filter((task): task is TaskProposal => task !== null);

      // Handle parameterized replaceable events - only keep the latest per patronPubkey+d combination
      // Note: task.pubkey should equal task.patronPubkey, but we use patronPubkey to be explicit
      const latestTasks = new Map<string, TaskProposal>();

      parsedTasks.forEach(task => {
        // Use patronPubkey+d as the key since patrons own their task proposals
        const key = `${task.patronPubkey}:${task.d}`;
        const existing = latestTasks.get(key);

        // Accept updates from patron, arbiter, or worker (all authorized parties)
        const isAuthorizedUpdater = task.pubkey === task.patronPubkey ||
                                   task.pubkey === task.arbiterPubkey ||
                                   task.pubkey === task.workerPubkey;

        if (!isAuthorizedUpdater) {
          console.warn('Ignoring task update from unauthorized party:', task.pubkey, 'task:', task.d);
          return;
        }

        if (!existing || task.created_at > existing.created_at) {
          latestTasks.set(key, task);
        }
      });

      let result = Array.from(latestTasks.values());

      // Apply status filter AFTER deduplication to ensure we have the latest status
      if (status) {
        result = result.filter(task => task.status === status);
      }

      result = result.sort((a, b) => b.created_at - a.created_at);

      return result;
    },
  });
}

export function useTaskConclusions() {
  const { nostr } = useNostr();
  const { config, presetRelays } = useAppContext();
  const activeRelays = getActiveRelays(config, presetRelays);

  return useQuery({
    queryKey: ['catallax', 'conclusions', activeRelays],
    queryFn: async (c) => {
      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(10000)]);
      const events = await nostr.query([
        {
          kinds: [CATALLAX_KINDS.TASK_CONCLUSION],
          limit: 200, // Increase limit to get more conclusions
        }
      ], { signal });

      const conclusions = events
        .map(parseTaskConclusion)
        .filter((conclusion): conclusion is TaskConclusion => conclusion !== null)
        .sort((a, b) => b.created_at - a.created_at);

      return conclusions;
    },
  });
}

export function useMyArbiterServices(pubkey?: string) {
  const { nostr } = useNostr();
  const { config, presetRelays } = useAppContext();
  const activeRelays = getActiveRelays(config, presetRelays);

  return useQuery({
    queryKey: ['catallax', 'my-services', pubkey, activeRelays],
    queryFn: async (c) => {
      if (!pubkey) return [];

      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(10000)]);
      const events = await nostr.query([
        {
          kinds: [CATALLAX_KINDS.ARBITER_ANNOUNCEMENT],
          authors: [pubkey],
          '#t': ['catallax'],
          limit: 100, // Increase limit to get all versions
        }
      ], { signal });

      const parsedAnnouncements = events
        .map(parseArbiterAnnouncement)
        .filter((announcement): announcement is ArbiterAnnouncement => announcement !== null);

      // Handle parameterized replaceable events - only keep the latest per pubkey+d combination
      const latestAnnouncements = new Map<string, ArbiterAnnouncement>();

      parsedAnnouncements.forEach(announcement => {
        const key = `${announcement.pubkey}:${announcement.d}`;
        const existing = latestAnnouncements.get(key);

        if (!existing || announcement.created_at > existing.created_at) {
          latestAnnouncements.set(key, announcement);
        }
      });

      return Array.from(latestAnnouncements.values())
        .sort((a, b) => b.created_at - a.created_at);
    },
    enabled: !!pubkey,
  });
}

export function useMyTasks(pubkey?: string) {
  const { nostr } = useNostr();
  const { config, presetRelays } = useAppContext();
  const activeRelays = getActiveRelays(config, presetRelays);

  return useQuery({
    queryKey: ['catallax', 'my-tasks', pubkey, activeRelays],
    queryFn: async (c) => {
      if (!pubkey) return [];

      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(10000)]);

      // Get ALL task events, not just those authored by this pubkey
      // This ensures we get updates from arbiters and workers too
      const events = await nostr.query([
        {
          kinds: [CATALLAX_KINDS.TASK_PROPOSAL],
          '#t': ['catallax'],
          limit: 1000, // Get all task events to ensure we have all versions
        }
      ], { signal });

      const parsedTasks = events
        .map(parseTaskProposal)
        .filter((task): task is TaskProposal => task !== null)
        // Filter to only tasks where this pubkey is the patron
        .filter(task => task.patronPubkey === pubkey);

      // Handle parameterized replaceable events - only keep the latest per patronPubkey+d combination
      const latestTasks = new Map<string, TaskProposal>();

      parsedTasks.forEach(task => {
        // Use patronPubkey+d as the key since patrons own their task proposals
        const key = `${task.patronPubkey}:${task.d}`;
        const existing = latestTasks.get(key);

        // Accept updates from patron, arbiter, or worker (all authorized parties)
        const isAuthorizedUpdater = task.pubkey === task.patronPubkey ||
                                   task.pubkey === task.arbiterPubkey ||
                                   task.pubkey === task.workerPubkey;

        if (!isAuthorizedUpdater) {
          console.warn('Ignoring task update from unauthorized party:', task.pubkey, 'task:', task.d);
          return;
        }

        if (!existing || task.created_at > existing.created_at) {
          latestTasks.set(key, task);
        }
      });

      const result = Array.from(latestTasks.values())
        .sort((a, b) => b.created_at - a.created_at);

      return result;
    },
    enabled: !!pubkey,
  });
}

export function useTasksForWorker(pubkey?: string) {
  const { nostr } = useNostr();
  const { config, presetRelays } = useAppContext();
  const activeRelays = getActiveRelays(config, presetRelays);

  return useQuery({
    queryKey: ['catallax', 'worker-tasks', pubkey, activeRelays],
    queryFn: async (c) => {
      if (!pubkey) return [];

      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(10000)]);

      // Get ALL task events to ensure we have all versions including updates from arbiters
      const events = await nostr.query([
        {
          kinds: [CATALLAX_KINDS.TASK_PROPOSAL],
          '#t': ['catallax'],
          limit: 1000, // Get all task events to ensure we have all versions
        }
      ], { signal });

      const parsedTasks = events
        .map(parseTaskProposal)
        .filter((task): task is TaskProposal => task !== null && task.workerPubkey === pubkey);

      // Handle parameterized replaceable events - only keep the latest per patronPubkey+d combination
      const latestTasks = new Map<string, TaskProposal>();

      parsedTasks.forEach(task => {
        // Use patronPubkey+d as the key since patrons own their task proposals
        const key = `${task.patronPubkey}:${task.d}`;
        const existing = latestTasks.get(key);

        // Accept updates from patron, arbiter, or worker (all authorized parties)
        const isAuthorizedUpdater = task.pubkey === task.patronPubkey ||
                                   task.pubkey === task.arbiterPubkey ||
                                   task.pubkey === task.workerPubkey;

        if (!isAuthorizedUpdater) {
          console.warn('Ignoring task update from unauthorized party:', task.pubkey, 'task:', task.d);
          return;
        }

        if (!existing || task.created_at > existing.created_at) {
          latestTasks.set(key, task);
        }
      });

      return Array.from(latestTasks.values())
        .sort((a, b) => b.created_at - a.created_at);
    },
    enabled: !!pubkey,
  });
}

/**
 * Returns a map of arbiter pubkey -> number of completed tasks (successful or rejected resolutions)
 */
export function useArbiterExperience() {
  const { data: conclusions = [] } = useTaskConclusions();

  const experienceMap = new Map<string, number>();

  conclusions.forEach(conclusion => {
    // Only count successful or rejected as "completed" experience
    if (conclusion.arbiterPubkey && ['successful', 'rejected'].includes(conclusion.resolution)) {
      const current = experienceMap.get(conclusion.arbiterPubkey) || 0;
      experienceMap.set(conclusion.arbiterPubkey, current + 1);
    }
  });

  return experienceMap;
}

export function useTasksForArbiter(pubkey?: string) {
  const { nostr } = useNostr();
  const { config, presetRelays } = useAppContext();
  const activeRelays = getActiveRelays(config, presetRelays);

  return useQuery({
    queryKey: ['catallax', 'arbiter-tasks', pubkey, activeRelays],
    queryFn: async (c) => {
      if (!pubkey) return [];

      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(10000)]);

      // Get ALL task events to ensure we have all versions including updates from other parties
      const events = await nostr.query([
        {
          kinds: [CATALLAX_KINDS.TASK_PROPOSAL],
          '#t': ['catallax'],
          limit: 1000, // Get all task events to ensure we have all versions
        }
      ], { signal });

      const parsedTasks = events
        .map(parseTaskProposal)
        .filter((task): task is TaskProposal => task !== null && task.arbiterPubkey === pubkey);

      // Handle parameterized replaceable events - only keep the latest per patronPubkey+d combination
      const latestTasks = new Map<string, TaskProposal>();

      parsedTasks.forEach(task => {
        // Use patronPubkey+d as the key since patrons own their task proposals
        const key = `${task.patronPubkey}:${task.d}`;
        const existing = latestTasks.get(key);

        // Accept updates from patron, arbiter, or worker (all authorized parties)
        const isAuthorizedUpdater = task.pubkey === task.patronPubkey ||
                                   task.pubkey === task.arbiterPubkey ||
                                   task.pubkey === task.workerPubkey;

        if (!isAuthorizedUpdater) {
          console.warn('Ignoring task update from unauthorized party:', task.pubkey, 'task:', task.d);
          return;
        }

        if (!existing || task.created_at > existing.created_at) {
          latestTasks.set(key, task);
        }
      });

      return Array.from(latestTasks.values())
        .sort((a, b) => b.created_at - a.created_at);
    },
    enabled: !!pubkey,
  });
}