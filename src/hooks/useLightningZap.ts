import { useCallback } from 'react';
import { useNostr } from '@nostrify/react';
import type { WebLNProvider } from '@webbtc/webln-types';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import {
  buildInvoiceUrl,
  buildZapRequest,
  lightningAddressToLnurlPayUrl,
  validateZapAmount,
} from '@/lib/zap';

function getWebLN(): WebLNProvider | undefined {
  return (window as unknown as { webln?: WebLNProvider }).webln;
}

export interface PrepareInvoiceArgs {
  /** Recipient pubkey (for a contribution, the task's arbiter). */
  recipientPubkey: string;
  amountSats: number;
  goalId: string;
  relays: string[];
  comment?: string;
}

/**
 * Real NIP-57 zaps. Side effects only — the pure construction lives in `lib/zap.ts`.
 * The payment is plain Lightning (LNURL → invoice → wallet); the relay is only used
 * to read back the receipt, so the zap request's relays must be publicly reachable.
 * No DOM modal, no external QR service, no fabricated "I paid" receipt — funding only
 * advances when a real 9735 receipt appears.
 */
export function useLightningZap() {
  const { user } = useCurrentUser();
  const { nostr } = useNostr();

  /** Fetch a pubkey's Lightning address from their kind-0, or null if they have none. */
  const getLightningAddress = useCallback(
    async (pubkey: string): Promise<string | null> => {
      const events = await nostr.query(
        [{ kinds: [0], authors: [pubkey], limit: 1 }],
        { signal: AbortSignal.timeout(5000) },
      );
      if (events.length === 0) return null;
      try {
        const meta = JSON.parse(events[0].content) as { lud16?: string; lud06?: string };
        return meta.lud16 || meta.lud06 || null;
      } catch {
        return null;
      }
    },
    [nostr],
  );

  /**
   * Resolve the recipient's LNURL, validate the amount, sign the zap request, and
   * fetch a real bolt11 invoice. Throws a human-readable Error on any failure (the
   * "no Lightning address" message is surfaced honestly by the dialog).
   */
  const prepareInvoice = useCallback(
    async (args: PrepareInvoiceArgs): Promise<{ invoice: string; zapRequestId: string }> => {
      if (!user?.signer) throw new Error('Log in to contribute.');

      const address = await getLightningAddress(args.recipientPubkey);
      if (!address) {
        throw new Error(
          "This project's arbiter has no Lightning address (lud16/lud06) in their profile, so a real contribution can't be sent yet.",
        );
      }

      const lnurlUrl = lightningAddressToLnurlPayUrl(address);
      const res = await fetch(lnurlUrl);
      if (!res.ok) throw new Error(`Couldn't reach the recipient's Lightning service (${res.status}).`);
      const params = (await res.json()) as {
        tag?: string;
        callback?: string;
        minSendable?: number;
        maxSendable?: number;
        allowsNostr?: boolean;
      };
      if (params.tag !== 'payRequest' || !params.callback) {
        throw new Error("The recipient's Lightning address isn't a valid LNURL-pay endpoint.");
      }

      const check = validateZapAmount(args.amountSats, {
        minSendable: params.minSendable ?? 0,
        maxSendable: params.maxSendable ?? 0,
        allowsNostr: params.allowsNostr,
      });
      if (!check.ok) throw new Error(check.reason);

      const zapRequest = buildZapRequest(args);
      const signed = await user.signer.signEvent({
        ...zapRequest,
        created_at: Math.floor(Date.now() / 1000),
      });

      const invoiceUrl = buildInvoiceUrl(
        params.callback,
        args.amountSats * 1000,
        JSON.stringify(signed),
        args.comment,
      );
      const invRes = await fetch(invoiceUrl);
      if (!invRes.ok) throw new Error(`Couldn't get a Lightning invoice (${invRes.status}).`);
      const invData = (await invRes.json()) as { status?: string; reason?: string; pr?: string };
      if (invData.status === 'ERROR' || !invData.pr) {
        throw new Error(invData.reason || 'The Lightning service did not return an invoice.');
      }

      return { invoice: invData.pr, zapRequestId: signed.id };
    },
    [user, getLightningAddress],
  );

  /** Pay an invoice via a browser Lightning wallet, if one is present (additive). */
  const payWithWebLN = useCallback(async (invoice: string): Promise<void> => {
    const webln = getWebLN();
    if (!webln) throw new Error('No browser Lightning wallet (WebLN) detected.');
    await webln.enable();
    await webln.sendPayment(invoice);
  }, []);

  /**
   * Poll the given relays for a real 9735 receipt referencing the goal, published
   * after `sinceSecs`. Resolves true on first match; false if the signal aborts or
   * the poll window elapses. Never fabricates a receipt.
   */
  const waitForReceipt = useCallback(
    async (goalId: string, relays: string[], sinceSecs: number, signal: AbortSignal): Promise<boolean> => {
      const deadline = Date.now() + 3 * 60 * 1000; // ~3 minutes
      while (Date.now() < deadline && !signal.aborted) {
        try {
          const receipts = await nostr.query(
            [{ kinds: [9735], '#e': [goalId], since: sinceSecs, limit: 20 }],
            relays.length > 0 ? { signal: AbortSignal.timeout(4000), relays } : { signal: AbortSignal.timeout(4000) },
          );
          if (receipts.length > 0) return true;
        } catch {
          // transient relay error — keep polling
        }
        await new Promise((r) => setTimeout(r, 4000));
      }
      return false;
    },
    [nostr],
  );

  return {
    prepareInvoice,
    payWithWebLN,
    waitForReceipt,
    isWebLNAvailable: !!getWebLN(),
  };
}
