import { useNostr } from '@nostrify/react';
import { useMutation } from '@tanstack/react-query';
import type { NostrEvent } from '@nostrify/nostrify';
import { useCurrentUser } from './useCurrentUser';

/** Sign and publish a template to an explicit relay set (in addition to nothing else). */
export function usePublishTo() {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();
  return useMutation({
    mutationFn: async ({ template, relays }: { template: { kind: number; content: string; tags: string[][] }; relays: string[] }): Promise<NostrEvent> => {
      if (!user) throw new Error('User is not logged in');
      const event = await user.signer.signEvent({ ...template, created_at: Math.floor(Date.now() / 1000) });
      await nostr.event(event, { signal: AbortSignal.timeout(8000), relays });
      return event;
    },
  });
}
