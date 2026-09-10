import { describe, expect, it } from 'vitest';
import type { NostrEvent } from '@nostrify/nostrify';
import { buildLedger } from './ledger';
import { collectContributions } from './contributions';
import { buildAcceptanceTemplate, buildCampaignFinalTemplate, buildCampaignTemplate, buildConclusionRetractionTemplate, parseCampaign } from './canvasstr';
import { asEvent } from '@/test/fixtures';

const PATRON = 'a'.repeat(64);
const ARBITER = 'b'.repeat(64);
const LIST = '39998:' + 'd'.repeat(64) + ':places';

function item(pubkey: string, d: string, created_at: number): NostrEvent {
  return { kind: 39999, pubkey, created_at, id: `${d}-${pubkey.slice(0, 4)}`, sig: '', content: '', tags: [['d', d], ['z', LIST], ['name', d]] };
}
function receipt(contributionId: string, payer: string, sats: number, created_at: number): NostrEvent {
  const req = { pubkey: payer, tags: [['e', contributionId], ['amount', String(sats * 1000)]] };
  return { kind: 9735, pubkey: 'zapper', created_at, id: `r-${contributionId}`, sig: '', content: '', tags: [['e', contributionId], ['description', JSON.stringify(req)]] };
}

const campaign = parseCampaign(asEvent(buildCampaignTemplate({
  d: 'places', patronPubkey: PATRON, arbiterPubkey: ARBITER, title: 't', description: 'd', requirements: 'r',
  amount: '1500', targets: [{ z: LIST }], rate: 500, maxPerPubkey: 1, payout: 'streaming', status: 'open', since: 1,
}), PATRON, 10, 'campaign'))!;

const alice = '1'.repeat(64), bob = '2'.repeat(64), carol = '3'.repeat(64);
const events = [item(alice, 'a1', 20), item(bob, 'b1', 30), item(bob, 'b2', 31), item(carol, 'c1', 40), item(PATRON, 'self', 41)];
const contributions = collectContributions(events, campaign.targets);

describe('buildLedger', () => {
  it('starts all candidates, 3 slots, shows the patron\'s own row as ineligible', () => {
    const l = buildLedger(campaign, contributions, [], []);
    expect(l.rows.map((r) => r.status)).toEqual(['candidate', 'candidate', 'candidate', 'candidate', 'candidate']);
    expect(l.slots).toBe(3);
    expect(l.remaining).toBe(3);
    const own = l.rows.find((r) => r.contribution.pubkey === PATRON)!;
    expect(own.selfDealing).toBe(true);
    expect(own.fundable).toBe(false);
  });
  it('flips to paid on an arbiter-signed receipt before any 3402, and counts the slot', () => {
    const l = buildLedger(campaign, contributions, [], [receipt('a1-1111', ARBITER, 500, 50)]);
    expect(l.rows[0].status).toBe('paid');
    expect(l.rows[0].paidSats).toBe(500);
    expect(l.paid).toBe(1);
    expect(l.remaining).toBe(2);
  });
  it('ignores receipts whose zap request was not signed by the arbiter', () => {
    const l = buildLedger(campaign, contributions, [], [receipt('a1-1111', alice, 500, 50)]);
    expect(l.rows[0].status).toBe('candidate');
  });
  it('reads acceptances and rejections from arbiter-signed 3402s only', () => {
    const acc = asEvent(buildAcceptanceTemplate({ campaign, contribution: events[0], payoutReceiptId: 'rcpt', resolution: 'successful' }), ARBITER, 60);
    const rej = asEvent(buildAcceptanceTemplate({ campaign, contribution: events[1], resolution: 'rejected' }), ARBITER, 61);
    const forged = asEvent(buildAcceptanceTemplate({ campaign, contribution: events[3], payoutReceiptId: 'x', resolution: 'successful' }), carol, 62);
    const l = buildLedger(campaign, contributions, [acc, rej, forged], []);
    expect(l.rows.map((r) => r.status)).toEqual(['paid', 'rejected', 'candidate', 'candidate', 'candidate']);
    expect(l.rejected).toBe(1);
  });
  it('enforces max_per_pubkey and slot exhaustion as fundability, not hiding', () => {
    const paidA = receipt('a1-1111', ARBITER, 500, 50);
    const paidB1 = receipt('b1-2222', ARBITER, 500, 51);
    const l = buildLedger(campaign, contributions, [], [paidA, paidB1]);
    const b2 = l.rows.find((r) => r.contribution.id === 'b2-2222')!;
    expect(b2.status).toBe('candidate');
    expect(b2.fundable).toBe(false); // bob already has his one
    const c1 = l.rows.find((r) => r.contribution.id === 'c1-3333')!;
    expect(c1.fundable).toBe(true);
    expect(l.remaining).toBe(1);
    const paidC = receipt('c1-3333', ARBITER, 500, 52);
    const full = buildLedger(campaign, contributions, [], [paidA, paidB1, paidC]);
    expect(full.remaining).toBe(0);
    expect(full.rows.every((r) => r.status === 'paid' || !r.fundable)).toBe(true);
    expect(full.rows.filter((r) => r.selfDealing)).toHaveLength(1);
  });
  it('marks later submissions of the same thing as duplicates of the first (time order)', () => {
    const dup = item(carol, 'sushi-kaji-again', 45); dup.tags = dup.tags.map((tg) => (tg[0] === 'name' ? ['name', '  SUSHI  Kaji '] : tg));
    const l = buildLedger(campaign, collectContributions([...events, dup], campaign.targets), [], []);
    const first = l.rows.find((r) => r.contribution.label === 'a1')!;
    const later = l.rows.find((r) => r.contribution.pubkey === carol && r.contribution.label.includes('Kaji'))!;
    expect(first.duplicateOf).toBeUndefined();
    expect(later.duplicateOf).toBeUndefined(); // 'a1' ≠ 'sushi kaji'
    const dup2 = item(bob, 'a1-copy', 46); dup2.tags = dup2.tags.map((tg) => (tg[0] === 'name' ? ['name', 'A1'] : tg));
    const l2 = buildLedger(campaign, collectContributions([...events, dup2], campaign.targets), [], []);
    expect(l2.rows.find((r) => r.contribution.id === 'a1-copy-2222')!.duplicateOf).toBe(first.position);
  });

  it('an arbiter-signed kind-5 reverses their own rejection; a stranger\'s does not', () => {
    const rej = asEvent(buildAcceptanceTemplate({ campaign, contribution: events[1], resolution: 'rejected' }), ARBITER, 61, 'rej-id');
    const undo = asEvent(buildConclusionRetractionTemplate('rej-id', campaign), ARBITER, 62);
    const forgedUndo = asEvent(buildConclusionRetractionTemplate('rej-id', campaign), bob, 63);
    expect(buildLedger(campaign, contributions, [rej], []).rows[1].status).toBe('rejected');
    expect(buildLedger(campaign, contributions, [rej, forgedUndo], []).rows[1].status).toBe('rejected');
    expect(buildLedger(campaign, contributions, [rej, undo], []).rows[1].status).toBe('candidate');
    expect(undo.tags).toContainEqual(['a', `33401:${PATRON}:places`]);
  });

  it('prior items are reference only and flag later duplicates as existing', () => {
    const prior = collectContributions([item(carol, 'a1', 5)], campaign.targets); // carol's earlier 'a1'
    const l = buildLedger(campaign, contributions, [], [], { prior });
    expect(l.prior).toHaveLength(1);
    expect(l.rows.find((r) => r.contribution.label === 'a1')!.duplicateOf).toBe('existing');
    expect(l.rows).toHaveLength(5); // prior never becomes a row
  });

  it('folds the purser\'s duplicate of an existing entry into that row as an endorsement', () => {
    const co = item(ARBITER, 'a1', 50); co.tags = co.tags.map((tg) => (tg[0] === 'name' ? ['name', 'a1'] : tg));
    const l = buildLedger(campaign, collectContributions([...events, co], campaign.targets), [], []);
    const a1 = l.rows.find((r) => r.contribution.label === 'a1' && r.contribution.pubkey === alice)!;
    expect(a1.purserEndorsement?.pubkey).toBe(ARBITER);
    expect(l.rows.filter((r) => r.contribution.pubkey === ARBITER)).toHaveLength(0);
    const solo = item(ARBITER, 'zed', 51);
    const l2 = buildLedger(campaign, collectContributions([...events, solo], campaign.targets), [], []);
    expect(l2.rows.find((r) => r.contribution.id === 'zed-bbbb')?.selfDealing).toBe(true);
  });

  it('picks up the final conclusion', () => {
    const fin = asEvent(buildCampaignFinalTemplate({ campaign, resolution: 'successful' }), ARBITER, 99);
    expect(buildLedger(campaign, contributions, [fin], []).final?.resolution).toBe('successful');
  });
});
