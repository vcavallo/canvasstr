import { describe, it, expect } from 'vitest';
import type { NostrEvent } from '@nostrify/nostrify';
import {
  buildArbiterAnnouncementTemplate,
  parseArbiterAnnouncement,
  generateServiceId,
  CATALLAX_KINDS,
} from './catallax';

// Unit tests for the pure 33400 builder (the protocol-construction core of Story 12 /
// ADR 0011). No relay: the builder is pure, and we round-trip its output through the
// existing parser to prove the two agree. Failing until buildArbiterAnnouncementTemplate
// is implemented in lib/catallax.ts.

const ARBITER = 'arbiter'.padEnd(64, '0');
const OTHER = 'other'.padEnd(64, '1');

function tag(tags: string[][], name: string): string[] | undefined {
  return tags.find((t) => t[0] === name);
}
function tagValues(tags: string[][], name: string): string[] {
  return tags.filter((t) => t[0] === name).map((t) => t[1]);
}
function toEvent(tmpl: { kind: number; content: string; tags: string[][] }, pubkey: string): NostrEvent {
  return { id: 'id', pubkey, created_at: 1000, kind: tmpl.kind, content: tmpl.content, tags: tmpl.tags, sig: '' };
}

describe('buildArbiterAnnouncementTemplate — minimal Grantless announcement', () => {
  const tmpl = buildArbiterAnnouncementTemplate({
    name: 'Reliable Escrow',
    feeType: 'flat',
    feeAmount: '10000',
    pubkey: ARBITER,
  });

  it('is a kind-33400 arbiter announcement', () => {
    expect(tmpl.kind).toBe(CATALLAX_KINDS.ARBITER_ANNOUNCEMENT);
  });

  it('derives the d tag from the service name', () => {
    expect(tag(tmpl.tags, 'd')?.[1]).toBe(generateServiceId('Reliable Escrow'));
  });

  it('tags the announcer as the p pubkey and is discoverable via t:catallax', () => {
    expect(tag(tmpl.tags, 'p')?.[1]).toBe(ARBITER);
    expect(tagValues(tmpl.tags, 't')).toContain('catallax');
  });

  it('carries the required fee terms', () => {
    expect(tag(tmpl.tags, 'fee_type')?.[1]).toBe('flat');
    expect(tag(tmpl.tags, 'fee_amount')?.[1]).toBe('10000');
  });

  it('puts the name in JSON content and omits unset optional fields', () => {
    const content = JSON.parse(tmpl.content) as Record<string, unknown>;
    expect(content.name).toBe('Reliable Escrow');
    expect('about' in content).toBe(false);
    expect('policy_text' in content).toBe(false);
  });

  it('omits optional tags when not provided', () => {
    expect(tag(tmpl.tags, 'r')).toBeUndefined();
    expect(tag(tmpl.tags, 'min_amount')).toBeUndefined();
    expect(tag(tmpl.tags, 'max_amount')).toBeUndefined();
  });

  it('round-trips through the existing parser', () => {
    const parsed = parseArbiterAnnouncement(toEvent(tmpl, ARBITER));
    expect(parsed).not.toBeNull();
    expect(parsed!.d).toBe(generateServiceId('Reliable Escrow'));
    expect(parsed!.arbiterPubkey).toBe(ARBITER);
    expect(parsed!.feeType).toBe('flat');
    expect(parsed!.feeAmount).toBe('10000');
    expect(parsed!.content.name).toBe('Reliable Escrow');
  });
});

describe('buildArbiterAnnouncementTemplate — full optional fields', () => {
  const tmpl = buildArbiterAnnouncementTemplate({
    name: 'Pro Arbiter',
    about: 'Ten years of escrow.',
    feeType: 'percentage',
    feeAmount: '0.05',
    detailsUrl: 'https://example.com/arb',
    minAmount: '1000',
    maxAmount: '5000000',
    categories: ['programming', 'design'],
    pubkey: ARBITER,
  });

  it('includes about in content', () => {
    const content = JSON.parse(tmpl.content) as Record<string, unknown>;
    expect(content.about).toBe('Ten years of escrow.');
  });

  it('emits the optional tags', () => {
    expect(tag(tmpl.tags, 'r')?.[1]).toBe('https://example.com/arb');
    expect(tag(tmpl.tags, 'min_amount')?.[1]).toBe('1000');
    expect(tag(tmpl.tags, 'max_amount')?.[1]).toBe('5000000');
  });

  it('adds each category as a t tag alongside catallax', () => {
    const ts = tagValues(tmpl.tags, 't');
    expect(ts).toContain('catallax');
    expect(ts).toContain('programming');
    expect(ts).toContain('design');
  });
});

describe('buildArbiterAnnouncementTemplate — openness: no pubkey is special-cased', () => {
  it('tags whichever announcer is given, identically', () => {
    const a = buildArbiterAnnouncementTemplate({ name: 'Svc', feeType: 'flat', feeAmount: '1', pubkey: ARBITER });
    const b = buildArbiterAnnouncementTemplate({ name: 'Svc', feeType: 'flat', feeAmount: '1', pubkey: OTHER });
    expect(tag(a.tags, 'p')?.[1]).toBe(ARBITER);
    expect(tag(b.tags, 'p')?.[1]).toBe(OTHER);
    // Same inputs aside from the announcer ⇒ same d and same fee terms (no privileged key).
    expect(tag(a.tags, 'd')?.[1]).toBe(tag(b.tags, 'd')?.[1]);
    expect(tag(a.tags, 'fee_amount')?.[1]).toBe(tag(b.tags, 'fee_amount')?.[1]);
  });
});
