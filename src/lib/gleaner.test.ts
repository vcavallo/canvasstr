import { describe, expect, it } from 'vitest';
import { parseTaskProposal, parseTaskConclusion } from './catallax';
import {
  acceptedKinds, buildAcceptanceTemplate, buildCampaignFinalTemplate, buildCampaignTemplate, campaignSlots,
  campaignToInput, isCampaignEvent, latestAuthoritativeCampaign, markCampaignStatus, parseAcceptance, parseCampaign,
  type CampaignInput,
} from './gleaner';
import { asEvent } from '@/test/fixtures';

const PATRON = 'a'.repeat(64);
const ARBITER = 'b'.repeat(64);
const CONTRIB = 'c'.repeat(64);
const LIST = '39998:b83a28b7e4e5d20bd960c5faeb6625f95529166b8bdb045d42634a2f35919450:github-accounts';

const input: CampaignInput = {
  d: 'toronto-restaurants',
  patronPubkey: PATRON,
  arbiterPubkey: ARBITER,
  arbiterService: `33400:${ARBITER}:svc`,
  title: 'Restaurants in Toronto',
  description: 'Add restaurants you have eaten at.',
  requirements: 'Real places, one per item.',
  amount: '10000',
  status: 'open',
  fundingType: 'single',
  targets: [{ z: LIST, relay: 'wss://tags.brainstorm.world/relay', hint: 'item' }],
  rate: 500,
  maxPerPubkey: 3,
  payout: 'streaming',
  since: 1_700_000_000,
};

describe('buildCampaignTemplate', () => {
  const t = buildCampaignTemplate(input);
  it('is a 33401 that Catallax parsers accept with no worker', () => {
    const task = parseTaskProposal(asEvent(t, PATRON));
    expect(task?.patronPubkey).toBe(PATRON);
    expect(task?.arbiterPubkey).toBe(ARBITER);
    expect(task?.workerPubkey).toBeUndefined();
    expect(task?.amount).toBe('10000');
    expect(t.tags.filter(([n]) => n === 'p')).toHaveLength(2);
  });
  it('carries the extension tags and both t tags', () => {
    expect(t.tags).toContainEqual(['campaign', 'curation']);
    expect(t.tags).toContainEqual(['target', LIST, 'wss://tags.brainstorm.world/relay', 'item']);
    expect(t.tags).toContainEqual(['rate', '500']);
    expect(t.tags).toContainEqual(['max_per_pubkey', '3']);
    expect(t.tags).toContainEqual(['payout', 'streaming']);
    expect(t.tags).toContainEqual(['since', '1700000000']);
    expect(t.tags).toContainEqual(['status', 'open']);
    expect(t.tags.filter(([n, v]) => n === 't' && (v === 'catallax' || v === 'gleaner'))).toHaveLength(2);
  });
  it('rejects bad economics', () => {
    expect(() => buildCampaignTemplate({ ...input, rate: 0 })).toThrow();
    expect(() => buildCampaignTemplate({ ...input, targets: [] })).toThrow();
    expect(() => buildCampaignTemplate({ ...input, maxPerPubkey: -1 })).toThrow();
  });
  it('never emits gleaner twice even if passed as a category', () => {
    const t2 = buildCampaignTemplate({ ...input, categories: ['gleaner', 'food'] });
    expect(t2.tags.filter(([n, v]) => n === 't' && v === 'gleaner')).toHaveLength(1);
    expect(t2.tags).toContainEqual(['t', 'food']);
  });
});

describe('parseCampaign / campaignToInput round-trip', () => {
  const ev = asEvent(buildCampaignTemplate(input), PATRON);
  const c = parseCampaign(ev)!;
  it('parses every field', () => {
    expect(c.status).toBe('open');
    expect(c.rate).toBe(500);
    expect(c.maxPerPubkey).toBe(3);
    expect(c.payout).toBe('streaming');
    expect(c.targets[0]).toEqual({ z: LIST, relay: 'wss://tags.brainstorm.world/relay', hint: 'item' });
    expect(c.accepts).toBeUndefined();
    expect(acceptedKinds(c)).toEqual(['item', 'event-tag', 'profile-tag']);
    expect(c.since).toBe(1_700_000_000);
  });
  it('round-trips through campaignToInput', () => {
    const again = buildCampaignTemplate(campaignToInput(c));
    expect(again.tags).toEqual(ev.tags);
    expect(again.content).toEqual(ev.content);
  });
  it('markCampaignStatus changes only the status', () => {
    const t = markCampaignStatus(c, 'concluded');
    expect(t.tags).toContainEqual(['status', 'concluded']);
    expect(t.tags.filter(([n]) => n !== 'status')).toEqual(ev.tags.filter(([n]) => n !== 'status'));
  });
  it('is null for plain Catallax tasks and for campaigns missing rate/target', () => {
    const plain = { ...ev, tags: ev.tags.filter(([n]) => n !== 'campaign') };
    expect(isCampaignEvent(plain)).toBe(false);
    expect(parseCampaign(plain)).toBeNull();
    expect(parseCampaign({ ...ev, tags: ev.tags.filter(([n]) => n !== 'rate') })).toBeNull();
    expect(parseCampaign({ ...ev, tags: ev.tags.filter(([n]) => n !== 'target') })).toBeNull();
  });
});

describe('latestAuthoritativeCampaign', () => {
  const v1 = asEvent(buildCampaignTemplate({ ...input, status: 'funded' }), PATRON, 100);
  const v2 = asEvent(buildCampaignTemplate(input), ARBITER, 200); // arbiter opens it
  const forged = asEvent(buildCampaignTemplate({ ...input, rate: 1 }), CONTRIB, 300);
  it('takes the newest patron/arbiter-signed version and ignores strangers', () => {
    const c = latestAuthoritativeCampaign([forged, v1, v2], PATRON, input.d);
    expect(c?.status).toBe('open');
    expect(c?.rate).toBe(500);
  });
});

describe('campaignSlots', () => {
  it('floors after the fee', () => {
    expect(campaignSlots({ amount: '10000', rate: 500 })).toBe(20);
    expect(campaignSlots({ amount: '10000', rate: 500 }, 1000)).toBe(18);
    expect(campaignSlots({ amount: '100', rate: 500 })).toBe(0);
    expect(campaignSlots({ amount: 'x', rate: 500 })).toBe(0);
  });
});

describe('acceptances', () => {
  const campaignEv = asEvent(buildCampaignTemplate(input), PATRON, 100, 'campaign-id');
  const campaign = parseCampaign(campaignEv)!;
  const contribution = { id: 'contrib-id', pubkey: CONTRIB, kind: 39999, tags: [['d', 'sushi-kaji']] };
  const t = buildAcceptanceTemplate({ campaign, contribution, payoutReceiptId: 'receipt-id', resolution: 'successful', relay: 'wss://r' });

  it('is a 3402 Catallax parsers read positionally', () => {
    const c = parseTaskConclusion(asEvent(t, ARBITER))!;
    expect(c.payoutZapReceiptId).toBe('receipt-id');
    expect(c.taskProposalId).toBe('campaign-id');
    expect(c.workerPubkey).toBe(CONTRIB);
    expect(c.resolution).toBe('successful');
    expect(c.taskReference).toBe(`33401:${PATRON}:toronto-restaurants`);
  });
  it('names the contribution both ways', () => {
    expect(t.tags).toContainEqual(['contribution', `39999:${CONTRIB}:sushi-kaji`, 'wss://r']);
    expect(t.tags).toContainEqual(['e', 'contrib-id', 'wss://r', 'contribution']);
    const a = parseAcceptance(asEvent(t, ARBITER));
    expect(a && !a.isFinal && a.contributionId).toBe('contrib-id');
  });
  it('refuses a successful acceptance without a receipt, allows rejection without one', () => {
    expect(() => buildAcceptanceTemplate({ campaign, contribution, resolution: 'successful' })).toThrow();
    const r = buildAcceptanceTemplate({ campaign, contribution, resolution: 'rejected' });
    expect(parseTaskConclusion(asEvent(r, ARBITER))?.payoutZapReceiptId).toBe('campaign-id'); // positional quirk: no receipt → task id first
    expect(parseAcceptance(asEvent(r, ARBITER))?.resolution).toBe('rejected');
  });
  it('final conclusion has no worker and the marker', () => {
    const f = buildCampaignFinalTemplate({ campaign, resolution: 'cancelled', refundReceiptId: 'refund' });
    expect(f.tags.filter(([n]) => n === 'p')).toHaveLength(2);
    expect(f.tags).toContainEqual(['campaign_final', '1']);
    const parsed = parseAcceptance(asEvent(f, ARBITER));
    expect(parsed?.isFinal).toBe(true);
  });
  it('ignores ordinary 3402s without contribution tags', () => {
    const plain = { ...asEvent(t, ARBITER), tags: t.tags.filter(([n]) => n !== 'contribution') };
    expect(parseAcceptance(plain)).toBeNull();
  });
});
