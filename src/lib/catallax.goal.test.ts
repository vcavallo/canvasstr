import { describe, it, expect } from 'vitest';
import type { NostrEvent } from '@nostrify/nostrify';
import {
  buildZapGoalTemplate,
  buildMockZapReceiptTemplate,
  calculateGoalProgress,
  buildTaskProposalTemplate,
  taskProposalToInput,
  parseTaskProposal,
  type TaskProposal,
} from './catallax';

const PATRON = 'patron'.padEnd(64, '0');
const ARBITER = 'arbiter'.padEnd(64, '0');
const FUNDER_A = 'fundera'.padEnd(64, '0');
const FUNDER_B = 'funderb'.padEnd(64, '0');
const RELAY = 'ws://127.0.0.1:7787';

function ev(tmpl: { kind: number; content: string; tags: string[][] }, pubkey: string, id = 'evt', createdAt = 1000): NostrEvent {
  return { id, pubkey, created_at: createdAt, kind: tmpl.kind, content: tmpl.content, tags: tmpl.tags, sig: '' };
}
function tag(tags: string[][], name: string) {
  return tags.find((t) => t[0] === name);
}

describe('buildZapGoalTemplate', () => {
  const tmpl = buildZapGoalTemplate(
    { title: 'Offline sync', description: 'desc', amount: '50000', d: 't1' },
    PATRON,
    ARBITER,
    [RELAY],
  );

  it('is a kind-9041 goal with the target in msats, the arbiter as zap recipient, and the task coord', () => {
    expect(tmpl.kind).toBe(9041);
    expect(tag(tmpl.tags, 'amount')?.[1]).toBe('50000000'); // 50000 sats * 1000
    expect(tag(tmpl.tags, 'zap')?.[1]).toBe(ARBITER);
    expect(tag(tmpl.tags, 'a')?.[1]).toBe(`33401:${PATRON}:t1`);
    expect(tag(tmpl.tags, 'relays')).toContain(RELAY);
    expect(tmpl.content).toContain('Offline sync');
  });
});

describe('calculateGoalProgress over mocked contributions', () => {
  // Target 100 sats.
  const goal = ev(buildZapGoalTemplate({ title: 'T', description: 'd', amount: '100', d: 't1' }, PATRON, ARBITER, [RELAY]), PATRON, 'goal-1');
  const receipt = (sender: string, sats: number, id: string) =>
    ev(buildMockZapReceiptTemplate({ senderPubkey: sender, recipient: ARBITER, amountSats: sats, referencedId: 'goal-1' }), sender, id);

  it('sums receipts, computes percent/met, and aggregates contributors by sender', () => {
    const progress = calculateGoalProgress(goal, [
      receipt(FUNDER_A, 30, 'r1'),
      receipt(FUNDER_B, 50, 'r2'),
      receipt(FUNDER_A, 20, 'r3'), // second from A → aggregates to 50
    ]);
    expect(progress.targetSats).toBe(100);
    expect(progress.raisedSats).toBe(100);
    expect(progress.isGoalMet).toBe(true);
    expect(progress.percentComplete).toBe(100);
    expect(progress.contributors).toHaveLength(2);
    expect(progress.contributors.find((c) => c.pubkey === FUNDER_A)?.amountSats).toBe(50);
  });

  it('reports partial progress below target', () => {
    const progress = calculateGoalProgress(goal, [receipt(FUNDER_A, 25, 'r1')]);
    expect(progress.raisedSats).toBe(25);
    expect(progress.isGoalMet).toBe(false);
    expect(progress.percentComplete).toBe(25);
  });
});

describe('linking the goal to the task', () => {
  it('re-publishes the task with a goal tag, preserving status', () => {
    const proposed = parseTaskProposal(
      ev(
        buildTaskProposalTemplate({
          d: 't1', patronPubkey: PATRON, title: 'T', description: 'd', requirements: 'r',
          amount: '50000', status: 'proposed', fundingType: 'crowdfunding',
          arbiterPubkey: ARBITER, arbiterService: `33400:${ARBITER}:s`,
        }),
        PATRON,
      ),
    ) as TaskProposal;

    const linked = parseTaskProposal(
      ev(buildTaskProposalTemplate({ ...taskProposalToInput(proposed), goalId: 'goal-1' }), PATRON),
    );
    expect(linked?.goalId).toBe('goal-1');
    expect(linked?.status).toBe('proposed');
    expect(linked?.arbiterPubkey).toBe(ARBITER);
  });
});
