import type { NostrEvent } from '@nostrify/nostrify';

// Catallax Event Kinds
export const CATALLAX_KINDS = {
  ARBITER_ANNOUNCEMENT: 33400,
  TASK_PROPOSAL: 33401,
  TASK_CONCLUSION: 3402,
} as const;

// Status Types
export type TaskStatus = 'proposed' | 'funded' | 'in_progress' | 'submitted' | 'concluded';
export type ResolutionType = 'successful' | 'rejected' | 'cancelled' | 'abandoned';
export type FeeType = 'flat' | 'percentage';
export type FundingType = 'single' | 'crowdfunding';

// Content Interfaces
export interface ArbiterAnnouncementContent {
  name: string;
  about?: string;
  policy_text?: string;
  policy_url?: string;
}

export interface TaskProposalContent {
  title: string;
  description: string;
  requirements: string;
  deadline?: number; // Unix timestamp
}

export interface TaskConclusionContent {
  resolution_details: string;
}

// Parsed Event Interfaces
export interface ArbiterAnnouncement {
  id: string;
  pubkey: string;
  created_at: number;
  content: ArbiterAnnouncementContent;
  d: string;
  arbiterPubkey: string;
  detailsUrl?: string;
  categories: string[];
  feeType: FeeType;
  feeAmount: string;
  minAmount?: string;
  maxAmount?: string;
}

export interface TaskProposal {
  id: string;
  pubkey: string;
  created_at: number;
  content: TaskProposalContent;
  d: string;
  patronPubkey: string;
  arbiterPubkey?: string;
  workerPubkey?: string;
  arbiterService?: string;
  amount: string;
  categories: string[];
  status: TaskStatus;
  zapReceiptId?: string;
  detailsUrl?: string;
  fundingType: FundingType;
  goalId?: string;
}

// NIP-75 Zap Goal Types
export interface GoalContributor {
  pubkey: string;
  zapReceiptId: string;
  amountSats: number;
  percentage: number;
  timestamp: number;
}

export interface GoalProgress {
  goalId: string;
  targetSats: number;
  raisedSats: number;
  percentComplete: number;
  isGoalMet: boolean;
  contributors: GoalContributor[];
}

export interface RefundSplit {
  recipientPubkey: string;
  amountSats: number;
  originalContribution: number;
  proportion: number;
}

export interface TaskConclusion {
  id: string;
  pubkey: string;
  created_at: number;
  content: TaskConclusionContent;
  payoutZapReceiptId?: string;
  taskProposalId?: string;
  patronPubkey?: string;
  arbiterPubkey?: string;
  workerPubkey?: string;
  resolution: ResolutionType;
  taskReference?: string;
}

// Utility Functions
export function parseArbiterAnnouncement(event: NostrEvent): ArbiterAnnouncement | null {
  try {
    const content = JSON.parse(event.content) as ArbiterAnnouncementContent;

    const d = event.tags.find(([name]) => name === 'd')?.[1];
    const arbiterPubkey = event.tags.find(([name]) => name === 'p')?.[1];
    const detailsUrl = event.tags.find(([name]) => name === 'r')?.[1];
    const categories = event.tags.filter(([name]) => name === 't').map(([, value]) => value);
    const feeType = event.tags.find(([name]) => name === 'fee_type')?.[1] as FeeType;
    const feeAmount = event.tags.find(([name]) => name === 'fee_amount')?.[1];
    const minAmount = event.tags.find(([name]) => name === 'min_amount')?.[1];
    const maxAmount = event.tags.find(([name]) => name === 'max_amount')?.[1];

    if (!d || !arbiterPubkey || !feeType || !feeAmount) {
      return null;
    }

    return {
      id: event.id,
      pubkey: event.pubkey,
      created_at: event.created_at,
      content,
      d,
      arbiterPubkey,
      detailsUrl,
      categories,
      feeType,
      feeAmount,
      minAmount,
      maxAmount,
    };
  } catch {
    return null;
  }
}

export function parseTaskProposal(event: NostrEvent): TaskProposal | null {
  try {
    const content = JSON.parse(event.content) as TaskProposalContent;

    const d = event.tags.find(([name]) => name === 'd')?.[1];
    const pTags = event.tags.filter(([name]) => name === 'p');
    const patronPubkey = pTags[0]?.[1];
    const arbiterPubkey = pTags[1]?.[1];
    const workerPubkey = pTags[2]?.[1];

    const arbiterService = event.tags.find(([name]) => name === 'a')?.[1];
    const amount = event.tags.find(([name]) => name === 'amount')?.[1];
    const categories = event.tags.filter(([name]) => name === 't').map(([, value]) => value);
    const status = event.tags.find(([name]) => name === 'status')?.[1] as TaskStatus;
    const zapReceiptId = event.tags.find(([name, , , marker]) => name === 'e' && marker === 'zap')?.[1];
    const detailsUrl = event.tags.find(([name]) => name === 'r')?.[1];

    // NIP-75 crowdfunding fields
    const fundingType = (event.tags.find(([name]) => name === 'funding_type')?.[1] as FundingType) || 'single';
    const goalTag = event.tags.find(([name]) => name === 'goal');
    const goalId = goalTag?.[1];

    if (!d || !patronPubkey || !amount || !status) {
      return null;
    }

    return {
      id: event.id,
      pubkey: event.pubkey,
      created_at: event.created_at,
      content,
      d,
      patronPubkey,
      arbiterPubkey,
      workerPubkey,
      arbiterService,
      amount,
      categories,
      status,
      zapReceiptId,
      detailsUrl,
      fundingType,
      goalId,
    };
  } catch {
    return null;
  }
}

export function parseTaskConclusion(event: NostrEvent): TaskConclusion | null {
  try {
    const content = JSON.parse(event.content) as TaskConclusionContent;

    const eTags = event.tags.filter(([name]) => name === 'e');
    const payoutZapReceiptId = eTags[0]?.[1];
    const taskProposalId = eTags[1]?.[1];

    const pTags = event.tags.filter(([name]) => name === 'p');
    const patronPubkey = pTags[0]?.[1];
    const arbiterPubkey = pTags[1]?.[1];
    const workerPubkey = pTags[2]?.[1];

    const resolution = event.tags.find(([name]) => name === 'resolution')?.[1] as ResolutionType;
    const taskReference = event.tags.find(([name]) => name === 'a')?.[1];

    if (!resolution) {
      return null;
    }

    return {
      id: event.id,
      pubkey: event.pubkey,
      created_at: event.created_at,
      content,
      payoutZapReceiptId,
      taskProposalId,
      patronPubkey,
      arbiterPubkey,
      workerPubkey,
      resolution,
      taskReference,
    };
  } catch {
    return null;
  }
}

export function formatSats(sats: string | number): string {
  const amount = typeof sats === 'string' ? parseInt(sats) : sats;
  if (amount >= 100000000) {
    return `${(amount / 100000000).toFixed(2)} BTC`;
  }
  return `${amount.toLocaleString()} sats`;
}

export function formatFee(feeType: FeeType, feeAmount: string): string {
  if (feeType === 'flat') {
    return `${formatSats(feeAmount)} fee`;
  }
  const percentage = parseFloat(feeAmount) * 100;
  return `${percentage}% fee`;
}

export function generateTaskId(title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();

  const timestamp = Date.now().toString().slice(-6);
  return `${slug}-${timestamp}`;
}

/** Input for building a kind-33401 task proposal. `d` is supplied by the caller
 *  (e.g. via `generateTaskId`) so the builder stays pure/deterministic. */
export interface TaskProposalInput {
  d: string;
  patronPubkey: string;
  title: string;
  description: string;
  requirements: string;
  /** Funding target / amount, in sats, as a string (the 33401 `amount` tag). */
  amount: string;
  status?: TaskStatus;
  fundingType?: FundingType;
  /** Arbiter pubkey (the escrow holder). Optional — set when an arbiter is chosen. */
  arbiterPubkey?: string;
  /** Arbiter service coordinate `33400:<arbiterPubkey>:<d>`. */
  arbiterService?: string;
  /** Worker pubkey. Only emitted alongside an arbiter (positional p-tag semantics). */
  workerPubkey?: string;
  /** NIP-75 zap-goal event id (set once funding is configured). */
  goalId?: string;
  detailsUrl?: string;
  categories?: string[];
  /** Deadline as a unix timestamp (seconds). */
  deadline?: number;
}

/**
 * Build a kind-33401 task-proposal event template (`{ kind, content, tags }`) ready
 * to sign/publish. Pure and deterministic. `parseTaskProposal` reads `p` tags
 * positionally (patron, arbiter, worker), so the patron is always the first `p`,
 * and a worker is only emitted when an arbiter is present — preserving that order.
 * Arbiter/`a`/`goal` are omitted unless provided, so a Grantless `proposed` task is
 * arbiter-less and goal-less by simply not passing them.
 */
export function buildTaskProposalTemplate(
  input: TaskProposalInput,
): { kind: number; content: string; tags: string[][] } {
  const content: TaskProposalContent = {
    title: input.title,
    description: input.description,
    requirements: input.requirements,
  };
  if (input.deadline !== undefined) {
    content.deadline = input.deadline;
  }

  const tags: string[][] = [
    ['d', input.d],
    ['p', input.patronPubkey],
  ];
  if (input.arbiterPubkey) {
    tags.push(['p', input.arbiterPubkey]);
    if (input.workerPubkey) {
      tags.push(['p', input.workerPubkey]);
    }
  }
  if (input.arbiterService) tags.push(['a', input.arbiterService]);
  tags.push(['amount', input.amount]);
  tags.push(['t', 'catallax']);
  tags.push(['status', input.status ?? 'proposed']);
  tags.push(['funding_type', input.fundingType ?? 'single']);
  if (input.detailsUrl) tags.push(['r', input.detailsUrl]);
  if (input.goalId) tags.push(['goal', input.goalId]);
  for (const category of input.categories ?? []) {
    tags.push(['t', category]);
  }

  return { kind: CATALLAX_KINDS.TASK_PROPOSAL, content: JSON.stringify(content), tags };
}

/**
 * Reconstruct the builder input from a parsed task proposal, so an existing task
 * can be re-published with one field changed:
 *   `buildTaskProposalTemplate({ ...taskProposalToInput(task), arbiterPubkey, arbiterService })`.
 * This is the re-publish primitive every status-transition / assignment flow reuses.
 */
export function taskProposalToInput(task: TaskProposal): TaskProposalInput {
  return {
    d: task.d,
    patronPubkey: task.patronPubkey,
    title: task.content.title,
    description: task.content.description,
    requirements: task.content.requirements,
    amount: task.amount,
    status: task.status,
    fundingType: task.fundingType,
    arbiterPubkey: task.arbiterPubkey,
    arbiterService: task.arbiterService,
    workerPubkey: task.workerPubkey,
    goalId: task.goalId,
    detailsUrl: task.detailsUrl,
    categories: task.categories,
    deadline: task.content.deadline,
  };
}

/** Re-publish template for a task with a new status (other fields preserved). */
export function markTaskStatus(
  task: TaskProposal,
  status: TaskStatus,
): { kind: number; content: string; tags: string[][] } {
  return buildTaskProposalTemplate({ ...taskProposalToInput(task), status });
}

/** Re-publish template assigning a worker (3rd `p`) and moving to `in_progress`. */
export function assignWorker(
  task: TaskProposal,
  workerPubkey: string,
): { kind: number; content: string; tags: string[][] } {
  return buildTaskProposalTemplate({ ...taskProposalToInput(task), workerPubkey, status: 'in_progress' });
}

export interface TaskConclusionInput {
  /** `33401:<patron>:<d>` of the task being concluded. */
  taskCoord: string;
  /** Event id of the (latest, submitted) task proposal. */
  taskId: string;
  /** Event id of the payout/refund zap receipt (mocked here). */
  payoutReceiptId?: string;
  patron: string;
  arbiter: string;
  worker?: string;
  resolution: ResolutionType;
  details?: string;
}

/**
 * Build a kind-3402 task-conclusion template. `parseTaskConclusion` reads `e` tags
 * positionally (payout receipt first, then the task id), so emit them in that order.
 * Pure.
 */
export function buildTaskConclusionTemplate(
  input: TaskConclusionInput,
): { kind: number; content: string; tags: string[][] } {
  const content: TaskConclusionContent = { resolution_details: input.details ?? '' };
  const tags: string[][] = [];
  if (input.payoutReceiptId) tags.push(['e', input.payoutReceiptId]);
  tags.push(['e', input.taskId]);
  tags.push(['p', input.patron]);
  tags.push(['p', input.arbiter]);
  if (input.worker) tags.push(['p', input.worker]);
  tags.push(['resolution', input.resolution]);
  tags.push(['a', input.taskCoord]);
  tags.push(['t', 'catallax']);
  return { kind: CATALLAX_KINDS.TASK_CONCLUSION, content: JSON.stringify(content), tags };
}

export interface MockZapReceiptInput {
  senderPubkey: string;
  recipient: string;
  amountSats: number;
  /** The goal or task event id this (mocked) receipt is associated with. */
  referencedId: string;
}

/**
 * Build a mocked kind-9735 zap receipt — a stand-in for a real LNURL-server receipt
 * (signed in-app by the payer). Used for payout/refund references until real
 * Lightning lands. Mirrors the nak harness shape. Pure.
 */
export function buildMockZapReceiptTemplate(
  input: MockZapReceiptInput,
): { kind: number; content: string; tags: string[][] } {
  const description = JSON.stringify({
    pubkey: input.senderPubkey,
    tags: [['amount', String(input.amountSats * 1000)]],
  });
  return {
    kind: 9735,
    content: '',
    tags: [
      ['e', input.referencedId],
      ['p', input.recipient],
      ['description', description],
    ],
  };
}

/**
 * Select the authoritative (latest, authorized-updater) version of a task from a
 * set of 33401 events for one `patron:d`. A task is a replaceable event keyed by
 * its *signer*, so a worker- or arbiter-signed status update lives at a different
 * coordinate than the patron's — callers must query by `#d` (not `authors`) and
 * dedupe here. An update counts only if signed by the task's own patron, arbiter,
 * or worker (authorized-updater rule); newest `created_at` wins. Pure.
 */
export function latestAuthoritativeTask(
  events: NostrEvent[],
  patronPubkey: string,
  d: string,
): TaskProposal | null {
  let latest: TaskProposal | null = null;
  for (const event of events) {
    const task = parseTaskProposal(event);
    if (!task || task.patronPubkey !== patronPubkey || task.d !== d) continue;
    const authorized =
      task.pubkey === task.patronPubkey ||
      task.pubkey === task.arbiterPubkey ||
      task.pubkey === task.workerPubkey;
    if (!authorized) continue;
    if (!latest || task.created_at > latest.created_at) latest = task;
  }
  return latest;
}

export function generateServiceId(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();

  return `${slug}-service`;
}

export interface ArbiterAnnouncementInput {
  name: string;
  about?: string;
  feeType: FeeType;
  feeAmount: string;
  policyText?: string;
  policyUrl?: string;
  detailsUrl?: string;
  minAmount?: string;
  maxAmount?: string;
  categories?: string[];
  /** The announcing arbiter's own pubkey (the `p` tag). */
  pubkey: string;
}

/**
 * Build a kind-33400 arbiter-announcement event template (`{ kind, content, tags }`)
 * ready to sign/publish. Pure and deterministic — the single source of truth for the
 * 33400 shape, shared by the lean Grantless "Become an Arbiter" flow and the full
 * Catallax arbiter-service form. `parseArbiterAnnouncement` reads these tags back, so
 * the two agree by construction. The `d` is derived from the service name, making a
 * re-announcement of the same name a replaceable update. No pubkey is privileged:
 * the announcer is tagged as itself, nothing more.
 */
export function buildArbiterAnnouncementTemplate(
  input: ArbiterAnnouncementInput,
): { kind: number; content: string; tags: string[][] } {
  const content: ArbiterAnnouncementContent = { name: input.name };
  if (input.about) content.about = input.about;
  if (input.policyText) content.policy_text = input.policyText;
  if (input.policyUrl) content.policy_url = input.policyUrl;

  const tags: string[][] = [
    ['d', generateServiceId(input.name)],
    ['p', input.pubkey],
    ['t', 'catallax'],
    ['fee_type', input.feeType],
    ['fee_amount', input.feeAmount],
  ];
  if (input.detailsUrl) tags.push(['r', input.detailsUrl]);
  if (input.minAmount) tags.push(['min_amount', input.minAmount]);
  if (input.maxAmount) tags.push(['max_amount', input.maxAmount]);
  for (const category of input.categories ?? []) {
    tags.push(['t', category]);
  }

  return { kind: CATALLAX_KINDS.ARBITER_ANNOUNCEMENT, content: JSON.stringify(content), tags };
}

export function getStatusColor(status: TaskStatus): string {
  switch (status) {
    case 'proposed': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
    case 'funded': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
    case 'in_progress': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300';
    case 'submitted': return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300';
    case 'concluded': return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300';
    default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300';
  }
}

export function getResolutionColor(resolution: ResolutionType): string {
  switch (resolution) {
    case 'successful': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
    case 'rejected': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
    case 'cancelled': return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300';
    case 'abandoned': return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300';
    default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300';
  }
}

export interface PaymentSplit {
  recipientPubkey: string;
  amount: number; // in sats
  weight: number; // for zap split
  purpose: string;
}

export function calculateArbiterFee(taskAmount: number, feeType: FeeType, feeAmount: string): number {
  if (feeType === 'flat') {
    return parseInt(feeAmount);
  } else {
    // Percentage fee
    const percentage = parseFloat(feeAmount);
    return Math.floor(taskAmount * percentage);
  }
}

// NIP-75 Zap Goal Utilities

export function buildGoalEventTags(
  task: { title: string; description: string; amount: string; d: string },
  patronPubkey: string,
  arbiterPubkey: string,
  relays: string[],
): string[][] {
  const targetMsats = (parseInt(task.amount) * 1000).toString();

  return [
    ['relays', ...relays],
    ['amount', targetMsats],
    ['summary', task.description.slice(0, 200)],
    ['a', `33401:${patronPubkey}:${task.d}`, relays[0] || ''],
    ['zap', arbiterPubkey, relays[0] || '', '1'],
    ['alt', `Crowdfunding goal for Catallax task: ${task.title}`],
  ];
}

/**
 * Build a NIP-75 zap-goal (kind 9041) event template for a task's crowdfund: target
 * = `amount` sats (stored as msats), `zap` = the arbiter (escrow recipient), `a` =
 * the task coordinate, `relays` = where contributions/receipts live. Pure.
 */
export function buildZapGoalTemplate(
  task: { title: string; description: string; amount: string; d: string },
  patronPubkey: string,
  arbiterPubkey: string,
  relays: string[],
): { kind: number; content: string; tags: string[][] } {
  return {
    kind: 9041,
    content: `Crowdfunding goal for: ${task.title}`,
    tags: buildGoalEventTags(task, patronPubkey, arbiterPubkey, relays),
  };
}

export function parseZapReceiptAmount(receipt: NostrEvent): number {
  // Per NIP-57, the amount is in the zap request inside the description tag
  const descTag = receipt.tags.find(([name]) => name === 'description');
  if (descTag?.[1]) {
    try {
      const zapRequest = JSON.parse(descTag[1]) as NostrEvent;
      const amountTag = zapRequest.tags.find(([name]) => name === 'amount');
      if (amountTag?.[1]) {
        return parseInt(amountTag[1]);
      }
    } catch {
      // Fall through to return 0
    }
  }
  return 0;
}

export function parseZapReceiptSender(receipt: NostrEvent): string | null {
  // The zap receipt contains the original zap request in the 'description' tag
  const descTag = receipt.tags.find(([name]) => name === 'description');
  if (!descTag?.[1]) return null;

  try {
    const zapRequest = JSON.parse(descTag[1]) as NostrEvent;
    return zapRequest.pubkey;
  } catch {
    return null;
  }
}

export function calculateGoalProgress(
  goal: NostrEvent,
  receipts: NostrEvent[],
): GoalProgress {
  // Parse target from goal
  const amountTag = goal.tags.find(([name]) => name === 'amount');
  const targetMsats = parseInt(amountTag?.[1] || '0');
  const targetSats = Math.floor(targetMsats / 1000);

  // Parse contributors from receipts
  const contributors: GoalContributor[] = [];
  let totalRaisedMsats = 0;

  for (const receipt of receipts) {
    const amountMsats = parseZapReceiptAmount(receipt);
    if (amountMsats <= 0) continue;

    const senderPubkey = parseZapReceiptSender(receipt);
    if (!senderPubkey) continue;

    totalRaisedMsats += amountMsats;

    // Aggregate multiple zaps from the same sender
    const existing = contributors.find((c) => c.pubkey === senderPubkey);
    if (existing) {
      existing.amountSats += Math.floor(amountMsats / 1000);
    } else {
      contributors.push({
        pubkey: senderPubkey,
        zapReceiptId: receipt.id,
        amountSats: Math.floor(amountMsats / 1000),
        percentage: 0,
        timestamp: receipt.created_at,
      });
    }
  }

  const raisedSats = Math.floor(totalRaisedMsats / 1000);

  // Calculate percentages
  for (const contributor of contributors) {
    contributor.percentage = raisedSats > 0 ? contributor.amountSats / raisedSats : 0;
  }

  // Sort by amount descending
  contributors.sort((a, b) => b.amountSats - a.amountSats);

  return {
    goalId: goal.id,
    targetSats,
    raisedSats,
    percentComplete: targetSats > 0 ? Math.min((raisedSats / targetSats) * 100, 100) : 0,
    isGoalMet: raisedSats >= targetSats,
    contributors,
  };
}

export function calculateCrowdfundingRefunds(
  contributors: GoalContributor[],
  arbiter: ArbiterAnnouncement,
  taskAmount: number,
  refundType: 'rejected' | 'cancelled',
): RefundSplit[] {
  const totalRaised = contributors.reduce((sum, c) => sum + c.amountSats, 0);

  // For cancellation: full refunds, no arbiter fee
  // For rejection: arbiter keeps their fee
  const arbiterFee =
    refundType === 'cancelled'
      ? 0
      : calculateArbiterFee(taskAmount, arbiter.feeType, arbiter.feeAmount);

  const refundPool = totalRaised - arbiterFee;

  return contributors.map((c) => {
    const proportion = c.amountSats / totalRaised;
    const refundAmount = Math.floor(refundPool * proportion);

    return {
      recipientPubkey: c.pubkey,
      amountSats: refundAmount,
      originalContribution: c.amountSats,
      proportion,
    };
  });
}

export function calculatePaymentSplit(
  task: TaskProposal,
  arbiter: ArbiterAnnouncement,
  recipientPubkey: string,
  paymentType: 'worker' | 'patron'
): PaymentSplit[] {
  const taskAmount = parseInt(task.amount);
  const arbiterFee = calculateArbiterFee(taskAmount, arbiter.feeType, arbiter.feeAmount);

  const splits: PaymentSplit[] = [];

  if (paymentType === 'worker') {
    // Worker gets the full task amount
    splits.push({
      recipientPubkey,
      amount: taskAmount,
      weight: taskAmount,
      purpose: `Payment for completed work: ${task.content.title}`,
    });

    // Arbiter gets their fee as additional amount
    if (arbiterFee > 0) {
      splits.push({
        recipientPubkey: task.arbiterPubkey!,
        amount: arbiterFee,
        weight: arbiterFee,
        purpose: `Arbiter fee for task: ${task.content.title}`,
      });
    }
  } else {
    // For refunds, patron gets the full task amount back
    splits.push({
      recipientPubkey,
      amount: taskAmount,
      weight: taskAmount,
      purpose: `Refund for task: ${task.content.title}`,
    });

    // Arbiter still gets their fee for arbitration service
    if (arbiterFee > 0) {
      splits.push({
        recipientPubkey: task.arbiterPubkey!,
        amount: arbiterFee,
        weight: arbiterFee,
        purpose: `Arbiter fee for task: ${task.content.title}`,
      });
    }
  }

  return splits;
}