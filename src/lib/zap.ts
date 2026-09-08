import { bech32 } from '@scure/base';
import type { NostrEvent } from '@nostrify/nostrify';

// Pure NIP-57 / LNURL construction (Story 13 / ADR 0012). No network, no DOM, no
// wallet — the unit-tested core of real Lightning contributions. The side effects
// (fetch LNURL, sign, pay, poll for the receipt) live in useLightningZap.

/**
 * Resolve a recipient's Lightning address to its LNURL-pay URL.
 * - lud16 (`user@domain`) → `https://domain/.well-known/lnurlp/user`
 * - lud06 (`lnurl1…` bech32) → the decoded http(s) URL (case-insensitive)
 * Throws on anything malformed — callers surface that honestly rather than guessing.
 */
export function lightningAddressToLnurlPayUrl(address: string): string {
  const addr = address.trim();
  if (!addr) throw new Error('Empty Lightning address');

  if (addr.includes('@')) {
    const [name, domain] = addr.split('@');
    if (!name || !domain) throw new Error('Malformed Lightning address');
    return `https://${domain}/.well-known/lnurlp/${name}`;
  }

  if (addr.toLowerCase().startsWith('lnurl')) {
    // LNURLs exceed bech32's default 90-char limit, so raise it.
    const decoded = bech32.decode(addr.toLowerCase() as `${string}1${string}`, 2000);
    const url = new TextDecoder().decode(Uint8Array.from(bech32.fromWords(decoded.words)));
    if (!/^https?:\/\//i.test(url)) throw new Error('Decoded LNURL is not an http(s) URL');
    return url;
  }

  throw new Error('Unrecognized Lightning address format');
}

export interface ZapRequestInput {
  /** The recipient's pubkey (for a contribution, the task's arbiter). */
  recipientPubkey: string;
  amountSats: number;
  /** The 9041 zap-goal event id — referenced so the receipt counts toward funding. */
  goalId: string;
  /** Relays where the receipt should be published (must be publicly reachable). */
  relays: string[];
  comment?: string;
}

/**
 * Build an unsigned NIP-57 zap request (kind 9734). Pure. The `e` tag points at the
 * goal so the LNURL server's resulting 9735 receipt references it (NIP-57 copies the
 * request's tags), which is how `useZapGoal` attributes the contribution.
 */
export function buildZapRequest(
  input: ZapRequestInput,
): { kind: number; content: string; tags: string[][] } {
  return {
    kind: 9734,
    content: input.comment ?? '',
    tags: [
      ['p', input.recipientPubkey],
      ['amount', String(input.amountSats * 1000)],
      // De-duplicated, order-preserving: callers pass [...goalRelays, ...activeRelays],
      // so the goal's declared relays come first and are never dropped (NIP-75).
      ['relays', ...new Set(input.relays)],
      ['e', input.goalId],
    ],
  };
}

export interface LnurlPayParams {
  /** Minimum sendable, in millisats (LNURL-pay spec). */
  minSendable: number;
  /** Maximum sendable, in millisats. */
  maxSendable: number;
  /** Whether the endpoint supports NIP-57 nostr zaps. */
  allowsNostr?: boolean;
}

/** Validate a sat amount against an LNURL-pay endpoint's constraints. Pure. */
export function validateZapAmount(
  amountSats: number,
  lnurl: LnurlPayParams,
): { ok: true } | { ok: false; reason: string } {
  if (!lnurl.allowsNostr) {
    return { ok: false, reason: 'This Lightning address does not support Nostr zaps.' };
  }
  const msat = amountSats * 1000;
  if (!Number.isFinite(msat) || msat <= 0) {
    return { ok: false, reason: 'Enter a positive amount of sats.' };
  }
  if (msat < lnurl.minSendable) {
    return { ok: false, reason: `Minimum is ${Math.ceil(lnurl.minSendable / 1000)} sats.` };
  }
  if (msat > lnurl.maxSendable) {
    return { ok: false, reason: `Maximum is ${Math.floor(lnurl.maxSendable / 1000)} sats.` };
  }
  return { ok: true };
}

/**
 * Build the LNURL-pay callback URL that requests the invoice, preserving any query
 * params already on the callback. Pure.
 */
export function buildInvoiceUrl(
  callback: string,
  amountMsat: number,
  zapRequestJson: string,
  comment?: string,
): string {
  const url = new URL(callback);
  url.searchParams.set('amount', String(amountMsat));
  url.searchParams.set('nostr', zapRequestJson);
  if (comment) url.searchParams.set('comment', comment);
  return url.toString();
}

/**
 * The relays a NIP-75 zap goal (kind 9041) declares in its `relays` tag — where the
 * goal's zaps are "sent to and tallied from." A contribution MUST advertise these in
 * its zap request (NIP-75). Returns [] when the goal has no relays tag. Pure.
 */
export function extractGoalRelays(goal: NostrEvent): string[] {
  return goal.tags.find(([name]) => name === 'relays')?.slice(1) ?? [];
}
