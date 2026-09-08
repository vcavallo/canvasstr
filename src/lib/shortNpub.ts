import { nip19 } from 'nostr-tools';

/**
 * A truncated `npub1…` for use as an identity fallback when a pubkey has no
 * kind-0 name (or its profile hasn't resolved yet). Preferred over a fabricated
 * `genUserName` placeholder: an npub is honest — it's the real identifier, never
 * mistaken for a name the person chose. Returns the raw hex (also truncated) if
 * the pubkey can't be bech32-encoded.
 */
export function shortNpub(pubkey: string): string {
  try {
    const npub = nip19.npubEncode(pubkey);
    return `${npub.slice(0, 12)}…${npub.slice(-6)}`;
  } catch {
    return pubkey.slice(0, 12);
  }
}
