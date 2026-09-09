/**
 * The board: join a campaign with its contributions, acceptances (3402) and zap receipts
 * (9735) into rows that flip candidate → accepted → paid, plus slot totals. Pure.
 * Slot accounting borrows Magic Carpet's rule: an accepted-but-unreceipted row holds a slot
 * exactly like a paid one, so the board never over-promises.
 */
import type { NostrEvent } from '@nostrify/nostrify';
import { parseZapReceiptSender } from './catallax';
import type { Contribution } from './contributions';
import { campaignSlots, parseAcceptance, type Acceptance, type Campaign, type CampaignFinal } from './gleaner';

export type RowStatus = 'candidate' | 'accepted' | 'paid' | 'rejected';

export interface LedgerRow {
  contribution: Contribution;
  status: RowStatus;
  acceptance?: Acceptance;
  receipt?: NostrEvent;
  /** Sats paid per the receipt's zap request, if any. */
  paidSats?: number;
  /** Order in which it arrived among counted contributions (1-based). */
  position: number;
  /** False when this row is beyond the slots the escrow can pay. */
  fundable: boolean;
  /** Position of the earliest row submitting the same thing to the same target, if any. */
  duplicateOf?: number;
}

export interface Ledger {
  rows: LedgerRow[];
  slots: number;
  accepted: number;
  paid: number;
  rejected: number;
  remaining: number;
  final?: CampaignFinal;
}

interface ReceiptInfo {
  receipt: NostrEvent;
  sats: number;
}

/** Receipts whose embedded zap request was signed by an accepted payer (the arbiter). */
function indexReceipts(receipts: NostrEvent[], payers: Set<string>): Map<string, ReceiptInfo> {
  const byContribution = new Map<string, ReceiptInfo>();
  for (const r of receipts) {
    if (r.kind !== 9735) continue;
    const desc = r.tags.find(([n]) => n === 'description')?.[1];
    if (!desc) continue;
    let req: NostrEvent;
    try { req = JSON.parse(desc) as NostrEvent; } catch { continue; }
    if (!payers.has(req.pubkey)) continue;
    const amountMsat = Number(req.tags?.find(([n]) => n === 'amount')?.[1] ?? 0);
    const eIds = (req.tags ?? []).filter(([n]) => n === 'e').map(([, v]) => v);
    for (const id of eIds) {
      const prev = byContribution.get(id);
      if (!prev || r.created_at > prev.receipt.created_at) {
        byContribution.set(id, { receipt: r, sats: Math.floor(amountMsat / 1000) });
      }
    }
  }
  return byContribution;
}

/** What two contributions must agree on to be "the same item": target + primary value, case/space-insensitive. */
export function contributionKey(c: Pick<Contribution, 'target' | 'label' | 'taggedRef' | 'tagCoord' | 'kindOfContribution'>): string {
  const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const value = c.kindOfContribution === 'item' ? norm(c.label) : `${c.taggedRef ?? ''}|${c.tagCoord ?? ''}`;
  return `${c.target}|${value}`;
}

export function buildLedger(
  campaign: Campaign,
  contributions: Contribution[],
  conclusions: NostrEvent[],
  receipts: NostrEvent[],
  opts: { arbiterFeeSats?: number } = {},
): Ledger {
  const arbiter = campaign.arbiterPubkey;
  const retracted = new Set<string>();
  for (const e of conclusions) {
    if (e.kind === 5 && (!arbiter || e.pubkey === arbiter)) for (const [n, v] of e.tags) if (n === 'e' && v) retracted.add(v);
  }
  const acceptances = new Map<string, Acceptance>();
  let final: CampaignFinal | undefined;
  for (const e of conclusions) {
    if (arbiter && e.pubkey !== arbiter) continue; // only the arbiter's word counts
    if (retracted.has(e.id)) continue; // NIP-09 by the arbiter reverses their own 3402
    const a = parseAcceptance(e);
    if (!a) continue;
    if (a.isFinal) { if (!final || a.created_at > final.created_at) final = a; continue; }
    const prev = acceptances.get(a.contributionId);
    if (!prev || a.created_at > prev.created_at) acceptances.set(a.contributionId, a);
  }
  const receiptIndex = indexReceipts(receipts, new Set(arbiter ? [arbiter] : []));
  const slots = campaignSlots(campaign, opts.arbiterFeeSats ?? 0);
  const perPubkey = new Map<string, number>();

  const rows: LedgerRow[] = [];
  const firstByKey = new Map<string, number>();
  let held = 0;
  let paid = 0;
  let rejected = 0;
  for (const c of contributions) {
    if (c.pubkey === campaign.patronPubkey || c.pubkey === arbiter) continue; // no self-dealing
    const acceptance = acceptances.get(c.id);
    const paidInfo = receiptIndex.get(c.id);
    let status: RowStatus = 'candidate';
    if (acceptance?.resolution === 'rejected') status = 'rejected';
    else if (acceptance || paidInfo) status = paidInfo || acceptance?.payoutZapReceiptId ? 'paid' : 'accepted';
    if (status === 'rejected') rejected++;
    const consumesSlot = status === 'paid' || status === 'accepted';
    const count = perPubkey.get(c.pubkey) ?? 0;
    const overCap = campaign.maxPerPubkey !== undefined && count >= campaign.maxPerPubkey && !consumesSlot;
    const fundable = consumesSlot || (!overCap && held + paid < slots);
    if (consumesSlot) { perPubkey.set(c.pubkey, count + 1); if (status === 'paid') paid++; else held++; }
    const key = contributionKey(c);
    const position = rows.length + 1;
    const duplicateOf = firstByKey.get(key);
    if (duplicateOf === undefined) firstByKey.set(key, position);
    rows.push({ contribution: c, status, acceptance, receipt: paidInfo?.receipt, paidSats: paidInfo?.sats, position, fundable, duplicateOf });
  }
  return { rows, slots, accepted: held + paid, paid, rejected, remaining: Math.max(0, slots - held - paid), final };
}

export { parseZapReceiptSender };
