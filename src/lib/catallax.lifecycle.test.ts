import { describe, it, expect } from 'vitest';
import type { NostrEvent } from '@nostrify/nostrify';
import {
  buildTaskProposalTemplate,
  parseTaskProposal,
  parseTaskConclusion,
  markTaskStatus,
  assignWorker,
  buildTaskConclusionTemplate,
  buildMockZapReceiptTemplate,
  latestAuthoritativeTask,
  CATALLAX_KINDS,
  type TaskProposal,
} from './catallax';

const PATRON = 'patron'.padEnd(64, '0');
const ARBITER = 'arbiter'.padEnd(64, '0');
const WORKER = 'worker'.padEnd(64, '0');

function toEvent(tmpl: { kind: number; content: string; tags: string[][] }, pubkey: string): NostrEvent {
  return { id: 'evt-id', pubkey, created_at: 1000, kind: tmpl.kind, content: tmpl.content, tags: tmpl.tags, sig: '' };
}

/** A funded task that already has an arbiter (as it would after Story 6 + mark-funded). */
function fundedTask(): TaskProposal {
  const tmpl = buildTaskProposalTemplate({
    d: 'task-1', patronPubkey: PATRON, title: 'T', description: 'D', requirements: 'R',
    amount: '50000', status: 'funded', fundingType: 'crowdfunding',
    arbiterPubkey: ARBITER, arbiterService: `33400:${ARBITER}:svc`,
  });
  const t = parseTaskProposal(toEvent(tmpl, PATRON));
  if (!t) throw new Error('fixture failed');
  return t;
}

describe('markTaskStatus', () => {
  it('flips status while preserving every other field', () => {
    const t = fundedTask();
    const reparsed = parseTaskProposal(toEvent(markTaskStatus(t, 'submitted'), ARBITER));
    expect(reparsed?.status).toBe('submitted');
    expect(reparsed?.patronPubkey).toBe(PATRON);
    expect(reparsed?.arbiterPubkey).toBe(ARBITER);
    expect(reparsed?.amount).toBe('50000');
    expect(reparsed?.content.title).toBe('T');
  });
});

describe('assignWorker', () => {
  it('adds the worker (3rd p) and moves to in_progress, arbiter preserved', () => {
    const t = fundedTask();
    const tmpl = assignWorker(t, WORKER);
    expect(tmpl.tags.filter((tag) => tag[0] === 'p').map((tag) => tag[1])).toEqual([PATRON, ARBITER, WORKER]);
    const reparsed = parseTaskProposal(toEvent(tmpl, PATRON));
    expect(reparsed?.status).toBe('in_progress');
    expect(reparsed?.workerPubkey).toBe(WORKER);
    expect(reparsed?.arbiterPubkey).toBe(ARBITER);
  });

  it('supports self-assignment (worker === patron)', () => {
    const t = fundedTask();
    const reparsed = parseTaskProposal(toEvent(assignWorker(t, PATRON), PATRON));
    expect(reparsed?.workerPubkey).toBe(PATRON);
    expect(reparsed?.status).toBe('in_progress');
  });
});

describe('buildTaskConclusionTemplate', () => {
  it('builds a 3402 referencing the payout then the task, with roles + resolution', () => {
    const tmpl = buildTaskConclusionTemplate({
      taskCoord: `33401:${PATRON}:task-1`,
      taskId: 'task-event-id',
      payoutReceiptId: 'payout-id',
      patron: PATRON,
      arbiter: ARBITER,
      worker: WORKER,
      resolution: 'successful',
      details: 'done',
    });
    expect(tmpl.kind).toBe(CATALLAX_KINDS.TASK_CONCLUSION);

    const conc = parseTaskConclusion(toEvent(tmpl, ARBITER));
    expect(conc).not.toBeNull();
    expect(conc?.payoutZapReceiptId).toBe('payout-id'); // first e tag
    expect(conc?.taskProposalId).toBe('task-event-id'); // second e tag
    expect(conc?.patronPubkey).toBe(PATRON);
    expect(conc?.arbiterPubkey).toBe(ARBITER);
    expect(conc?.workerPubkey).toBe(WORKER);
    expect(conc?.resolution).toBe('successful');
    expect(conc?.taskReference).toBe(`33401:${PATRON}:task-1`);
    expect(conc?.content.resolution_details).toBe('done');
    expect(tmpl.tags.some((t) => t[0] === 't' && t[1] === 'catallax')).toBe(true);
  });
});

describe('latestAuthoritativeTask', () => {
  const D = 'task-1';
  // Each transition is signed by its acting role (different signer ⇒ different
  // replaceable coordinate), so resolution must span signers, not filter by author.
  const proposed = toEvent(
    buildTaskProposalTemplate({ d: D, patronPubkey: PATRON, title: 'T', description: 'D', requirements: 'R', amount: '1', status: 'proposed', arbiterPubkey: ARBITER, arbiterService: `33400:${ARBITER}:s` }),
    PATRON,
  );
  proposed.created_at = 100;
  const inProgress = { ...toEvent(buildTaskProposalTemplate({ d: D, patronPubkey: PATRON, title: 'T', description: 'D', requirements: 'R', amount: '1', status: 'in_progress', arbiterPubkey: ARBITER, arbiterService: `33400:${ARBITER}:s`, workerPubkey: WORKER }), PATRON), created_at: 200 };
  const submittedByWorker = { ...toEvent(buildTaskProposalTemplate({ d: D, patronPubkey: PATRON, title: 'T', description: 'D', requirements: 'R', amount: '1', status: 'submitted', arbiterPubkey: ARBITER, arbiterService: `33400:${ARBITER}:s`, workerPubkey: WORKER }), WORKER), created_at: 300 };

  it('picks the newest version across signers (worker-signed submitted wins)', () => {
    const latest = latestAuthoritativeTask([proposed, inProgress, submittedByWorker], PATRON, D);
    expect(latest?.status).toBe('submitted');
    expect(latest?.pubkey).toBe(WORKER);
  });

  it('ignores updates from an unauthorized signer (not patron/arbiter/worker)', () => {
    const STRANGER = 'stranger'.padEnd(64, '0');
    const hijack = { ...toEvent(buildTaskProposalTemplate({ d: D, patronPubkey: PATRON, title: 'T', description: 'D', requirements: 'R', amount: '1', status: 'concluded', arbiterPubkey: ARBITER, arbiterService: `33400:${ARBITER}:s`, workerPubkey: WORKER }), STRANGER), created_at: 999 };
    const latest = latestAuthoritativeTask([inProgress, submittedByWorker, hijack], PATRON, D);
    expect(latest?.status).toBe('submitted'); // the stranger's newer 'concluded' is rejected
  });
});

describe('buildMockZapReceiptTemplate', () => {
  it('builds a 9735 referencing the target, paying the recipient, amount in msats', () => {
    const tmpl = buildMockZapReceiptTemplate({
      senderPubkey: ARBITER,
      recipient: WORKER,
      amountSats: 50000,
      referencedId: 'goal-or-task-id',
    });
    expect(tmpl.kind).toBe(9735);
    expect(tmpl.tags.find((t) => t[0] === 'e')?.[1]).toBe('goal-or-task-id');
    expect(tmpl.tags.find((t) => t[0] === 'p')?.[1]).toBe(WORKER);
    const desc = JSON.parse(tmpl.tags.find((t) => t[0] === 'description')![1]);
    expect(desc.tags).toContainEqual(['amount', '50000000']); // 50000 sats * 1000
  });
});
