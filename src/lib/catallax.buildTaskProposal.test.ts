import { describe, it, expect } from 'vitest';
import type { NostrEvent } from '@nostrify/nostrify';
import {
  buildTaskProposalTemplate,
  parseTaskProposal,
  CATALLAX_KINDS,
  type TaskProposalContent,
} from './catallax';

// Unit tests for the pure 33401 builder (the protocol-construction core of Story 5).
// No relay: the builder is pure, and we round-trip its output through the existing
// parser to prove the two agree.

const PATRON = 'patron'.padEnd(64, '0');
const ARBITER = 'arbiter'.padEnd(64, '0');
const WORKER = 'worker'.padEnd(64, '0');

function tag(tags: string[][], name: string): string[] | undefined {
  return tags.find((t) => t[0] === name);
}
function tagValues(tags: string[][], name: string): string[] {
  return tags.filter((t) => t[0] === name).map((t) => t[1]);
}
function toEvent(tmpl: { kind: number; content: string; tags: string[][] }, pubkey: string): NostrEvent {
  return { id: 'id', pubkey, created_at: 1000, kind: tmpl.kind, content: tmpl.content, tags: tmpl.tags, sig: '' };
}

describe('buildTaskProposalTemplate — Grantless proposed/crowdfunding (no arbiter, no goal)', () => {
  const tmpl = buildTaskProposalTemplate({
    d: 'proj-1',
    patronPubkey: PATRON,
    title: 'Reproducible builds',
    description: 'Make the build bit-for-bit reproducible.',
    requirements: 'CI proof + docs.',
    amount: '75000',
    status: 'proposed',
    fundingType: 'crowdfunding',
  });

  it('is a kind-33401 task proposal', () => {
    expect(tmpl.kind).toBe(CATALLAX_KINDS.TASK_PROPOSAL);
  });

  it('puts title/description/requirements in JSON content, omitting deadline when unset', () => {
    const content = JSON.parse(tmpl.content) as TaskProposalContent;
    expect(content).toMatchObject({
      title: 'Reproducible builds',
      description: 'Make the build bit-for-bit reproducible.',
      requirements: 'CI proof + docs.',
    });
    expect('deadline' in content).toBe(false);
  });

  it('carries the required tags with the patron as the sole, first p tag', () => {
    expect(tag(tmpl.tags, 'd')?.[1]).toBe('proj-1');
    expect(tagValues(tmpl.tags, 'p')).toEqual([PATRON]);
    expect(tmpl.tags[1]).toEqual(['p', PATRON]); // patron is the FIRST p tag
    expect(tag(tmpl.tags, 'amount')?.[1]).toBe('75000');
    expect(tag(tmpl.tags, 'status')?.[1]).toBe('proposed');
    expect(tag(tmpl.tags, 'funding_type')?.[1]).toBe('crowdfunding');
    expect(tagValues(tmpl.tags, 't')).toContain('catallax');
  });

  it('carries no arbiter p/a tag and no goal (deferred to Stories 6–7)', () => {
    expect(tagValues(tmpl.tags, 'p')).toHaveLength(1); // patron only
    expect(tag(tmpl.tags, 'a')).toBeUndefined();
    expect(tag(tmpl.tags, 'goal')).toBeUndefined();
  });

  it('round-trips through parseTaskProposal', () => {
    const parsed = parseTaskProposal(toEvent(tmpl, PATRON));
    expect(parsed).not.toBeNull();
    expect(parsed?.patronPubkey).toBe(PATRON);
    expect(parsed?.status).toBe('proposed');
    expect(parsed?.fundingType).toBe('crowdfunding');
    expect(parsed?.amount).toBe('75000');
    expect(parsed?.arbiterPubkey).toBeUndefined();
    expect(parsed?.goalId).toBeUndefined();
  });
});

describe('buildTaskProposalTemplate — optional fields & defaults', () => {
  it('defaults status to proposed and funding_type to single when omitted', () => {
    const tmpl = buildTaskProposalTemplate({
      d: 'd1', patronPubkey: PATRON, title: 't', description: 'd', requirements: 'r', amount: '10',
    });
    expect(tag(tmpl.tags, 'status')?.[1]).toBe('proposed');
    expect(tag(tmpl.tags, 'funding_type')?.[1]).toBe('single');
  });

  it('includes deadline in content, a details-url r tag, and one t per category', () => {
    const tmpl = buildTaskProposalTemplate({
      d: 'd2', patronPubkey: PATRON, title: 't', description: 'd', requirements: 'r', amount: '10',
      deadline: 1893456000, detailsUrl: 'https://example.com/spec', categories: ['dev', 'docs'],
    });
    const content = JSON.parse(tmpl.content) as TaskProposalContent;
    expect(content.deadline).toBe(1893456000);
    expect(tag(tmpl.tags, 'r')?.[1]).toBe('https://example.com/spec');
    expect(tagValues(tmpl.tags, 't')).toEqual(expect.arrayContaining(['catallax', 'dev', 'docs']));
  });

  it('orders p tags patron, arbiter, worker and includes a/goal when set (locks ordering for later stories)', () => {
    const tmpl = buildTaskProposalTemplate({
      d: 'd3', patronPubkey: PATRON, title: 't', description: 'd', requirements: 'r', amount: '10',
      status: 'in_progress', fundingType: 'crowdfunding',
      arbiterPubkey: ARBITER, arbiterService: `33400:${ARBITER}:svc`, workerPubkey: WORKER, goalId: 'goal-id',
    });
    expect(tagValues(tmpl.tags, 'p')).toEqual([PATRON, ARBITER, WORKER]);
    expect(tag(tmpl.tags, 'a')?.[1]).toBe(`33400:${ARBITER}:svc`);
    expect(tag(tmpl.tags, 'goal')?.[1]).toBe('goal-id');
    const parsed = parseTaskProposal(toEvent(tmpl, PATRON));
    expect(parsed?.arbiterPubkey).toBe(ARBITER);
    expect(parsed?.workerPubkey).toBe(WORKER);
    expect(parsed?.goalId).toBe('goal-id');
  });
});
