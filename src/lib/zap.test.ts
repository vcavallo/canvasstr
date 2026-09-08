import { describe, it, expect } from 'vitest';
import type { NostrEvent } from '@nostrify/nostrify';
import {
  lightningAddressToLnurlPayUrl,
  buildZapRequest,
  validateZapAmount,
  buildInvoiceUrl,
  extractGoalRelays,
} from './zap';

// Unit tests for the pure NIP-57 / LNURL construction layer (Story 13 / ADR 0012).
// This is the automatable core — no network, no wallet. Actually moving sats is
// manual real-wallet verification (no Lightning backend on the local strfry).
// Failing until src/lib/zap.ts exists.

const ARBITER = 'arbiter'.padEnd(64, '0');
const OTHER = 'other'.padEnd(64, '1');
const GOAL = 'goal'.padEnd(64, 'a');

function tag(tags: string[][], name: string): string[] | undefined {
  return tags.find((t) => t[0] === name);
}

describe('lightningAddressToLnurlPayUrl', () => {
  it('resolves a lud16 lightning address (user@domain) to its LNURL-pay URL', () => {
    expect(lightningAddressToLnurlPayUrl('alice@example.com')).toBe(
      'https://example.com/.well-known/lnurlp/alice',
    );
  });

  it('decodes a lud06 bech32 LNURL to its URL', () => {
    // bech32-encoded https://example.com/.well-known/lnurlp/alice
    const lud06 =
      'lnurl1dp68gurn8ghj7etcv9khqmr99e3k7mf09emk2mrv944kummhdchkcmn4wfk8qtmpd35kxeg9saevq';
    expect(lightningAddressToLnurlPayUrl(lud06)).toBe(
      'https://example.com/.well-known/lnurlp/alice',
    );
  });

  it('is case-insensitive about the lnurl prefix', () => {
    const lud06 =
      'LNURL1DP68GURN8GHJ7ETCV9KHQMR99E3K7MF09EMK2MRV944KUMMHDCHKCMN4WFK8QTMPD35KXEG9SAEVQ';
    expect(lightningAddressToLnurlPayUrl(lud06)).toBe(
      'https://example.com/.well-known/lnurlp/alice',
    );
  });

  it('throws on a malformed address', () => {
    expect(() => lightningAddressToLnurlPayUrl('not-an-address')).toThrow();
    expect(() => lightningAddressToLnurlPayUrl('')).toThrow();
  });
});

describe('buildZapRequest', () => {
  const req = buildZapRequest({
    recipientPubkey: ARBITER,
    amountSats: 2500,
    goalId: GOAL,
    relays: ['wss://relay.grantless.org', 'wss://relay.nostr.band'],
    comment: 'for the cause',
  });

  it('is a kind-9734 zap request', () => {
    expect(req.kind).toBe(9734);
  });

  it('tags the recipient and carries the comment as content', () => {
    expect(tag(req.tags, 'p')?.[1]).toBe(ARBITER);
    expect(req.content).toBe('for the cause');
  });

  it('encodes the amount in millisats', () => {
    expect(tag(req.tags, 'amount')?.[1]).toBe('2500000');
  });

  it('references the goal via an e tag (so the receipt counts toward funding)', () => {
    expect(tag(req.tags, 'e')?.[1]).toBe(GOAL);
  });

  it('lists the relays where the receipt should be published', () => {
    expect(tag(req.tags, 'relays')).toEqual([
      'relays',
      'wss://relay.grantless.org',
      'wss://relay.nostr.band',
    ]);
  });

  it('defaults content to empty when no comment is given', () => {
    const r = buildZapRequest({ recipientPubkey: ARBITER, amountSats: 1, goalId: GOAL, relays: ['wss://x'] });
    expect(r.content).toBe('');
  });
});

describe('validateZapAmount', () => {
  // LNURL min/max are in millisats.
  const lnurl = { minSendable: 1000, maxSendable: 1_000_000, allowsNostr: true };

  it('accepts an amount within range when nostr zaps are allowed', () => {
    expect(validateZapAmount(500, lnurl).ok).toBe(true);
  });

  it('rejects an amount below the minimum', () => {
    expect(validateZapAmount(0, lnurl).ok).toBe(false);
  });

  it('rejects an amount above the maximum', () => {
    expect(validateZapAmount(2000, lnurl).ok).toBe(false);
  });

  it('rejects when the endpoint does not support nostr zaps', () => {
    expect(validateZapAmount(500, { ...lnurl, allowsNostr: false }).ok).toBe(false);
  });
});

describe('buildInvoiceUrl', () => {
  it('puts amount (msat), the zap request, and comment on the callback URL', () => {
    const out = buildInvoiceUrl('https://example.com/lnurl/cb', 2500000, '{"kind":9734}', 'hi');
    const url = new URL(out);
    expect(url.origin + url.pathname).toBe('https://example.com/lnurl/cb');
    expect(url.searchParams.get('amount')).toBe('2500000');
    expect(url.searchParams.get('nostr')).toBe('{"kind":9734}');
    expect(url.searchParams.get('comment')).toBe('hi');
  });

  it('preserves existing query params on the callback', () => {
    const out = buildInvoiceUrl('https://example.com/cb?foo=bar', 1000, '{}');
    const url = new URL(out);
    expect(url.searchParams.get('foo')).toBe('bar');
    expect(url.searchParams.get('amount')).toBe('1000');
  });
});

describe('openness: no recipient or relay is special-cased', () => {
  it('builds an identical-shape request for any recipient and any relay set', () => {
    const a = buildZapRequest({ recipientPubkey: ARBITER, amountSats: 10, goalId: GOAL, relays: ['wss://a'] });
    const b = buildZapRequest({ recipientPubkey: OTHER, amountSats: 10, goalId: GOAL, relays: ['wss://b'] });
    expect(tag(a.tags, 'p')?.[1]).toBe(ARBITER);
    expect(tag(b.tags, 'p')?.[1]).toBe(OTHER);
    expect(tag(a.tags, 'relays')).toEqual(['relays', 'wss://a']);
    expect(tag(b.tags, 'relays')).toEqual(['relays', 'wss://b']);
    // Same amount/goal ⇒ same amount + e tags (nothing about the parties is privileged).
    expect(tag(a.tags, 'amount')?.[1]).toBe(tag(b.tags, 'amount')?.[1]);
    expect(tag(a.tags, 'e')?.[1]).toBe(tag(b.tags, 'e')?.[1]);
  });
});

// Story 15 / ADR 0014 — NIP-75: a contribution's zap request must advertise the goal's
// declared relays (unioned with the viewer's active set, deduped). The pieces below are
// the pure, testable core; the ContributeDialog wiring + real payment are manual/inspection.

describe('buildZapRequest — relays are de-duplicated, order-preserving (goal relays first)', () => {
  const req = buildZapRequest({
    recipientPubkey: ARBITER,
    amountSats: 100,
    goalId: GOAL,
    // caller passes [...goalRelays, ...activeRelays]; goalA appears in both sets
    relays: ['wss://goal-a', 'wss://goal-b', 'wss://active-a', 'wss://goal-a'],
  });

  it('emits each relay once, preserving first-seen order (goal relays kept, not dropped)', () => {
    expect(tag(req.tags, 'relays')).toEqual([
      'relays',
      'wss://goal-a',
      'wss://goal-b',
      'wss://active-a',
    ]);
  });

  it('still carries the goal reference and msat amount', () => {
    expect(tag(req.tags, 'e')?.[1]).toBe(GOAL);
    expect(tag(req.tags, 'amount')?.[1]).toBe('100000');
  });
});

describe('extractGoalRelays', () => {
  function goalEvent(tags: string[][]): NostrEvent {
    return { id: 'g', pubkey: 'p', created_at: 1, kind: 9041, content: '', tags, sig: '' };
  }

  it('returns the values of the goal\'s relays tag', () => {
    const goal = goalEvent([
      ['amount', '210000'],
      ['relays', 'wss://one.example', 'wss://two.example'],
    ]);
    expect(extractGoalRelays(goal)).toEqual(['wss://one.example', 'wss://two.example']);
  });

  it('returns an empty array when the goal has no relays tag', () => {
    expect(extractGoalRelays(goalEvent([['amount', '210000']]))).toEqual([]);
  });
});
