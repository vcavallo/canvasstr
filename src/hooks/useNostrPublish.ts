import { useNostr } from "@nostrify/react";
import { useMutation, useQueryClient, type UseMutationResult } from "@tanstack/react-query";

import { useCurrentUser } from "./useCurrentUser";
import { CATALLAX_KINDS } from "@/lib/catallax";

import type { NostrEvent } from "@nostrify/nostrify";

/**
 * Publish an event, retrying with backoff on failure. A write soon after a cold load
 * can race the relay websocket (still (re)connecting — e.g. right after a relay-config
 * change), so `NPool.event`'s `Promise.any` rejects with "No Promise in Promise.any
 * was resolved" / "All promises were rejected". A few backed-off retries give the
 * socket time to open. Re-sending the same signed event is idempotent (relays dedupe
 * by event id), so retrying is safe.
 */
async function publishWithRetry(
  nostr: { event: (event: NostrEvent, opts?: { signal?: AbortSignal }) => Promise<void> },
  event: NostrEvent,
): Promise<void> {
  const backoffs = [0, 400, 1200, 2500];
  let lastError: unknown;
  for (const delay of backoffs) {
    if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
    try {
      await nostr.event(event, { signal: AbortSignal.timeout(6000) });
      return;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}

export function useNostrPublish(): UseMutationResult<NostrEvent> {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (t: Omit<NostrEvent, 'id' | 'pubkey' | 'sig'>) => {
      if (user) {
        const tags = t.tags ?? [];

        // Add the client tag if it doesn't exist
        if (location.protocol === "https:" && !tags.some(([name]) => name === "client")) {
          tags.push(["client", location.hostname]);
        }

        const event = await user.signer.signEvent({
          kind: t.kind,
          content: t.content ?? "",
          tags,
          created_at: t.created_at ?? Math.floor(Date.now() / 1000),
        });

        await publishWithRetry(nostr, event);
        return event;
      } else {
        throw new Error("User is not logged in");
      }
    },
    onError: (error) => {
      console.error("Failed to publish event:", error);
    },
    onSuccess: (data) => {
      console.log("Event published successfully:", data);

      // Invalidate relevant queries based on event kind
      if (data.kind === CATALLAX_KINDS.TASK_PROPOSAL) {
        console.log('Invalidating task-related queries after publishing task proposal');
        // Invalidate all task-related queries with more aggressive patterns
        queryClient.invalidateQueries({ queryKey: ['catallax'] });
        // Also try to refetch immediately
        queryClient.refetchQueries({ queryKey: ['catallax', 'tasks'] });
        queryClient.refetchQueries({ queryKey: ['catallax', 'my-tasks'] });
        queryClient.refetchQueries({ queryKey: ['catallax', 'worker-tasks'] });
        queryClient.refetchQueries({ queryKey: ['catallax', 'arbiter-tasks'] });
      } else if (data.kind === CATALLAX_KINDS.ARBITER_ANNOUNCEMENT) {
        console.log('Invalidating arbiter-related queries after publishing arbiter announcement');
        // Invalidate arbiter-related queries
        queryClient.invalidateQueries({ queryKey: ['catallax', 'arbiters'] });
        queryClient.invalidateQueries({ queryKey: ['catallax', 'my-services'] });
      } else if (data.kind === CATALLAX_KINDS.TASK_CONCLUSION) {
        console.log('Invalidating conclusion-related queries after publishing task conclusion');
        // Invalidate conclusion-related queries
        queryClient.invalidateQueries({ queryKey: ['catallax', 'conclusions'] });
      } else if (data.kind === 9041) {
        console.log('Invalidating zap-goal queries after publishing goal event');
        queryClient.invalidateQueries({ queryKey: ['zap-goal'] });
      }
    },
  });
}