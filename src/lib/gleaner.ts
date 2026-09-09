/**
 * Gleaner protocol layer: campaigns (kind 33401 + extension tags) and acceptances
 * (one kind 3402 per accepted contribution). Pure, deterministic, no I/O.
 * Wire shapes: PROTOCOL.md §2–§5. Decision record: engineering/decisions/0001.
 */
import type { NostrEvent } from '@nostrify/nostrify';
import {
  CATALLAX_KINDS,
  buildTaskConclusionTemplate,
  buildTaskProposalTemplate,
  parseTaskConclusion,
  parseTaskProposal,
  type ResolutionType,
  type TaskConclusion,
  type TaskProposal,
  type TaskProposalInput,
} from './catallax';

export const GLEANER_TAG = 'gleaner';
export const CAMPAIGN_MARKER = 'curation';

/** Catallax status machine plus Gleaner's `open` (PROTOCOL.md §2). */
export type CampaignStatus = 'proposed' | 'funded' | 'open' | 'concluded';
export type PayoutMode = 'streaming' | 'terminal';
export type ContributionKind = 'item' | 'event-tag' | 'profile-tag';

export interface CampaignTarget {
  /**
   * A Tapestry `z` value (`39998:<pk>:<d>` list/concept header, `39999:<pk>:tagging:<slug>-tagging`
   * per-tag header) or, with hint `profile-tag`, a tag-element coordinate `39999:<author>:<slug>`:
   * then contributions are the profile taggings that apply that tag (matched by `a` = coordinate,
   * or legacy `e` = `tagEventId`).
   */
  z: string;
  relay?: string;
  /** Advisory render hint; `profile-tag` on a 39999 coordinate means "tag element". */
  hint?: ContributionKind;
  /** For tag-element targets: the tag's event id, so legacy id-keyed taggings match too. */
  tagEventId?: string;
}

export interface CampaignInput extends Omit<TaskProposalInput, 'workerPubkey' | 'status'> {
  status?: CampaignStatus;
  targets: CampaignTarget[];
  /** Sats per accepted contribution. */
  rate: number;
  maxPerPubkey?: number;
  payout: PayoutMode;
  accepts?: ContributionKind[];
  /**
   * Contributions created before this unix timestamp do not count. Required so it is
   * pinned at first publish and survives status republishes (whose created_at moves).
   */
  since: number;
}

export interface Campaign extends Omit<TaskProposal, 'status'> {
  status: CampaignStatus;
  targets: CampaignTarget[];
  rate: number;
  maxPerPubkey?: number;
  payout: PayoutMode;
  /** Undefined = every kind (the default). */
  accepts?: ContributionKind[];
  /** Falls back to the event's created_at for legacy campaigns without the tag. */
  since: number;
}

export type EventTemplate = { kind: number; content: string; tags: string[][] };

const CONTRIBUTION_KINDS: ContributionKind[] = ['item', 'event-tag', 'profile-tag'];

function isContributionKind(v: string | undefined): v is ContributionKind {
  return CONTRIBUTION_KINDS.includes(v as ContributionKind);
}

/** Build a campaign 33401. Wraps the Catallax builder; never emits a worker `p`. */
export function buildCampaignTemplate(input: CampaignInput): EventTemplate {
  if (!Number.isInteger(input.rate) || input.rate <= 0) throw new Error('rate must be a positive integer (sats)');
  if (input.targets.length === 0) throw new Error('a campaign needs at least one target');
  if (input.maxPerPubkey !== undefined && (!Number.isInteger(input.maxPerPubkey) || input.maxPerPubkey <= 0)) {
    throw new Error('max_per_pubkey must be a positive integer');
  }
  const { targets, rate, maxPerPubkey, payout, accepts, since, status, ...task } = input;
  const base = buildTaskProposalTemplate({
    ...task,
    // The base parser only knows Catallax statuses; `open` passes through as a string.
    status: (status ?? 'proposed') as TaskProposalInput['status'],
    categories: [GLEANER_TAG, ...(task.categories ?? []).filter((c) => c !== GLEANER_TAG)],
  });
  const tags = [...base.tags, ['campaign', CAMPAIGN_MARKER]];
  for (const t of targets) {
    const tag = ['target', t.z, t.relay ?? '', t.hint ?? ''];
    if (t.tagEventId) tag.push(t.tagEventId);
    tags.push(tag);
  }
  tags.push(['rate', String(rate)]);
  if (maxPerPubkey !== undefined) tags.push(['max_per_pubkey', String(maxPerPubkey)]);
  tags.push(['payout', payout]);
  for (const a of accepts ?? []) tags.push(['accepts', a]);
  if (!Number.isInteger(since) || since <= 0) throw new Error('since must be a unix timestamp');
  tags.push(['since', String(since)]);
  return { ...base, tags };
}

export function isCampaignEvent(event: NostrEvent): boolean {
  return (
    event.kind === CATALLAX_KINDS.TASK_PROPOSAL &&
    event.tags.some(([n, v]) => n === 'campaign' && v === CAMPAIGN_MARKER)
  );
}

/** Parse a campaign; returns null for non-campaign or malformed 33401s. */
export function parseCampaign(event: NostrEvent): Campaign | null {
  if (!isCampaignEvent(event)) return null;
  const task = parseTaskProposal(event);
  if (!task) return null;
  const targets: CampaignTarget[] = event.tags
    .filter(([n, z]) => n === 'target' && z)
    .map(([, z, relay, hint, tagEventId]) => ({
      z,
      relay: relay || undefined,
      hint: isContributionKind(hint) ? hint : undefined,
      tagEventId: tagEventId && /^[0-9a-f]{64}$/.test(tagEventId) ? tagEventId : undefined,
    }));
  const rate = Number(event.tags.find(([n]) => n === 'rate')?.[1]);
  if (targets.length === 0 || !Number.isInteger(rate) || rate <= 0) return null;
  const maxRaw = event.tags.find(([n]) => n === 'max_per_pubkey')?.[1];
  const maxPerPubkey = maxRaw !== undefined ? Number(maxRaw) : undefined;
  const payoutRaw = event.tags.find(([n]) => n === 'payout')?.[1];
  const payout: PayoutMode = payoutRaw === 'terminal' ? 'terminal' : 'streaming';
  const accepts = event.tags.map(([n, v]) => (n === 'accepts' ? v : undefined)).filter(isContributionKind);
  const sinceRaw = event.tags.find(([n]) => n === 'since')?.[1];
  const since = sinceRaw !== undefined ? Number(sinceRaw) : undefined;
  const status = task.status as string;
  const campaignStatus: CampaignStatus = ['proposed', 'funded', 'open', 'concluded'].includes(status)
    ? (status as CampaignStatus)
    : status === 'in_progress' || status === 'submitted'
      ? 'open'
      : 'proposed';
  return {
    ...task,
    status: campaignStatus,
    targets,
    rate,
    maxPerPubkey: maxPerPubkey && Number.isInteger(maxPerPubkey) && maxPerPubkey > 0 ? maxPerPubkey : undefined,
    payout,
    accepts: accepts.length ? accepts : undefined,
    since: since && Number.isFinite(since) && since > 0 ? since : event.created_at,
  };
}

/** Inverse of `buildCampaignTemplate`, for re-publish-with-one-change flows. */
export function campaignToInput(c: Campaign): CampaignInput {
  return {
    d: c.d,
    patronPubkey: c.patronPubkey,
    title: c.content.title,
    description: c.content.description,
    requirements: c.content.requirements,
    amount: c.amount,
    status: c.status,
    fundingType: c.fundingType,
    arbiterPubkey: c.arbiterPubkey,
    arbiterService: c.arbiterService,
    goalId: c.goalId,
    detailsUrl: c.detailsUrl,
    categories: c.categories.filter((x) => x !== 'catallax' && x !== GLEANER_TAG),
    deadline: c.content.deadline,
    targets: c.targets,
    rate: c.rate,
    maxPerPubkey: c.maxPerPubkey,
    payout: c.payout,
    accepts: c.accepts,
    since: c.since,
  };
}

/** Contribution kinds a campaign counts (all three unless narrowed). */
export function acceptedKinds(c: Pick<Campaign, 'accepts'>): ContributionKind[] {
  return c.accepts ?? [...CONTRIBUTION_KINDS];
}

export function markCampaignStatus(c: Campaign, status: CampaignStatus): EventTemplate {
  return buildCampaignTemplate({ ...campaignToInput(c), status });
}

export function campaignCoord(c: Pick<Campaign, 'patronPubkey' | 'd'>): string {
  return `${CATALLAX_KINDS.TASK_PROPOSAL}:${c.patronPubkey}:${c.d}`;
}

/** Latest authoritative version among 33401s for one `patron:d` (patron/arbiter signed). */
export function latestAuthoritativeCampaign(events: NostrEvent[], patronPubkey: string, d: string): Campaign | null {
  let latest: Campaign | null = null;
  for (const event of events) {
    const c = parseCampaign(event);
    if (!c || c.patronPubkey !== patronPubkey || c.d !== d) continue;
    if (c.pubkey !== c.patronPubkey && c.pubkey !== c.arbiterPubkey) continue;
    if (!latest || c.created_at > latest.created_at) latest = c;
  }
  return latest;
}

/** Number of contributions the escrow can pay at `rate`, after the arbiter's fee. */
export function campaignSlots(c: Pick<Campaign, 'amount' | 'rate'>, arbiterFeeSats = 0): number {
  const net = Number(c.amount) - arbiterFeeSats;
  if (!Number.isFinite(net) || net <= 0) return 0;
  return Math.floor(net / c.rate);
}

// ---------------------------------------------------------------- acceptances

export interface AcceptanceInput {
  campaign: Pick<Campaign, 'patronPubkey' | 'd' | 'id' | 'arbiterPubkey'>;
  /** The accepted contribution event. */
  contribution: Pick<NostrEvent, 'id' | 'pubkey' | 'kind' | 'tags'>;
  /** Payout zap receipt id. Required for `successful`; absent for `rejected`. */
  payoutReceiptId?: string;
  resolution: 'successful' | 'rejected';
  details?: string;
  relay?: string;
}

/** Coordinate of an addressable event (`kind:pubkey:d`) or its id for regular events. */
export function contributionRef(e: Pick<NostrEvent, 'id' | 'pubkey' | 'kind' | 'tags'>): string {
  if (e.kind >= 30000 && e.kind < 40000) {
    const d = e.tags.find(([n]) => n === 'd')?.[1] ?? '';
    return `${e.kind}:${e.pubkey}:${d}`;
  }
  return e.id;
}

/** One 3402 per accepted (or explicitly rejected) contribution. PROTOCOL.md §4. */
export function buildAcceptanceTemplate(input: AcceptanceInput): EventTemplate {
  if (!input.campaign.arbiterPubkey) throw new Error('campaign has no arbiter');
  if (input.resolution === 'successful' && !input.payoutReceiptId) {
    throw new Error('a successful acceptance needs a payout receipt');
  }
  const base = buildTaskConclusionTemplate({
    taskCoord: campaignCoord(input.campaign),
    taskId: input.campaign.id,
    payoutReceiptId: input.payoutReceiptId,
    patron: input.campaign.patronPubkey,
    arbiter: input.campaign.arbiterPubkey,
    worker: input.contribution.pubkey,
    resolution: input.resolution,
    details: input.details,
  });
  const relay = input.relay ?? '';
  return {
    ...base,
    tags: [
      ...base.tags,
      ['t', GLEANER_TAG],
      ['contribution', contributionRef(input.contribution), relay],
      ['e', input.contribution.id, relay, 'contribution'],
    ],
  };
}

export interface CampaignFinalInput {
  campaign: Pick<Campaign, 'patronPubkey' | 'd' | 'id' | 'arbiterPubkey'>;
  resolution: Extract<ResolutionType, 'successful' | 'cancelled'>;
  /** Refund receipt for any remainder. */
  refundReceiptId?: string;
  details?: string;
}

/** The closing 3402 (no worker `p`, `campaign_final`). PROTOCOL.md §4. */
export function buildCampaignFinalTemplate(input: CampaignFinalInput): EventTemplate {
  if (!input.campaign.arbiterPubkey) throw new Error('campaign has no arbiter');
  const base = buildTaskConclusionTemplate({
    taskCoord: campaignCoord(input.campaign),
    taskId: input.campaign.id,
    payoutReceiptId: input.refundReceiptId,
    patron: input.campaign.patronPubkey,
    arbiter: input.campaign.arbiterPubkey,
    resolution: input.resolution,
    details: input.details,
  });
  return { ...base, tags: [...base.tags, ['t', GLEANER_TAG], ['campaign_final', '1']] };
}

export interface Acceptance extends TaskConclusion {
  /** `kind:pubkey:d` or event id of the contribution. */
  contributionRef: string;
  contributionId: string;
  isFinal: false;
}
export interface CampaignFinal extends TaskConclusion {
  isFinal: true;
}

export function parseAcceptance(event: NostrEvent): Acceptance | CampaignFinal | null {
  if (event.kind !== CATALLAX_KINDS.TASK_CONCLUSION) return null;
  const base = parseTaskConclusion(event);
  if (!base) return null;
  if (event.tags.some(([n, v]) => n === 'campaign_final' && v === '1')) {
    return { ...base, isFinal: true };
  }
  const ref = event.tags.find(([n]) => n === 'contribution')?.[1];
  const id = event.tags.find(([n, , , marker]) => n === 'e' && marker === 'contribution')?.[1];
  if (!ref || !id) return null;
  return { ...base, contributionRef: ref, contributionId: id, isFinal: false };
}

/** NIP-25 `+` on an accepted contribution: the DList NIP's endorsement signal (PROTOCOL.md §6). */
export function buildEndorsementTemplate(contribution: Pick<NostrEvent, 'id' | 'pubkey' | 'kind' | 'tags'>, relay?: string): EventTemplate {
  const tags: string[][] = [['e', contribution.id, relay ?? ''], ['p', contribution.pubkey], ['k', String(contribution.kind)]];
  if (contribution.kind >= 30000 && contribution.kind < 40000) tags.push(['a', contributionRef(contribution), relay ?? '']);
  return { kind: 7, content: '+', tags };
}

/**
 * NIP-09 deletion of one of the arbiter's own 3402s (e.g. reversing a rejection). Carries the
 * campaign `a` so the board's settlement subscription (`#a` campaign) sees it. PROTOCOL.md §4.
 */
export function buildConclusionRetractionTemplate(conclusionId: string, campaign: Pick<Campaign, 'patronPubkey' | 'd'>, reason = ''): EventTemplate {
  return { kind: 5, content: reason, tags: [['e', conclusionId], ['a', campaignCoord(campaign)], ['k', String(CATALLAX_KINDS.TASK_CONCLUSION)]] };
}
