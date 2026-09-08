import { describe, it, expect } from 'vitest';
import type { NostrEvent } from '@nostrify/nostrify';
import {
  buildTaskProposalTemplate,
  parseTaskProposal,
  taskProposalToInput,
  type TaskProposal,
} from './catallax';

// Unit tests for the re-publish primitive: parse a task → reconstruct the builder
// input → re-build, and prove fields survive (and that assigning an arbiter to a
// proposed task produces the right tags while keeping status `proposed`).

const PATRON = 'patron'.padEnd(64, '0');
const ARBITER = 'arbiter'.padEnd(64, '0');

function toEvent(tmpl: { kind: number; content: string; tags: string[][] }, pubkey: string): NostrEvent {
  return { id: 'id', pubkey, created_at: 1000, kind: tmpl.kind, content: tmpl.content, tags: tmpl.tags, sig: '' };
}

/** A proposed, arbiter-less task as Story 5 would create. */
function proposedTask(): TaskProposal {
  const tmpl = buildTaskProposalTemplate({
    d: 'proj-1',
    patronPubkey: PATRON,
    title: 'Reproducible builds',
    description: 'Make the build reproducible.',
    requirements: 'CI proof.',
    amount: '75000',
    status: 'proposed',
    fundingType: 'crowdfunding',
    detailsUrl: 'https://example.com',
    categories: ['dev'],
    deadline: 1893456000,
  });
  const task = parseTaskProposal(toEvent(tmpl, PATRON));
  if (!task) throw new Error('fixture task failed to parse');
  return task;
}

describe('taskProposalToInput', () => {
  it('round-trips a task through input → build → parse, preserving fields', () => {
    const task = proposedTask();
    const rebuilt = parseTaskProposal(toEvent(buildTaskProposalTemplate(taskProposalToInput(task)), PATRON));
    expect(rebuilt).not.toBeNull();
    expect(rebuilt?.d).toBe(task.d);
    expect(rebuilt?.patronPubkey).toBe(PATRON);
    expect(rebuilt?.amount).toBe('75000');
    expect(rebuilt?.status).toBe('proposed');
    expect(rebuilt?.fundingType).toBe('crowdfunding');
    expect(rebuilt?.content.title).toBe('Reproducible builds');
    expect(rebuilt?.content.deadline).toBe(1893456000);
    expect(rebuilt?.detailsUrl).toBe('https://example.com');
    expect(rebuilt?.categories).toContain('dev');
  });

  it('assigns an arbiter to a proposed task without changing status', () => {
    const task = proposedTask();
    const serviceCoord = `33400:${ARBITER}:svc-1`;
    const tmpl = buildTaskProposalTemplate({
      ...taskProposalToInput(task),
      arbiterPubkey: ARBITER,
      arbiterService: serviceCoord,
    });

    // Arbiter is the second p tag; a-coord present.
    const pTags = tmpl.tags.filter((t) => t[0] === 'p').map((t) => t[1]);
    expect(pTags).toEqual([PATRON, ARBITER]);
    expect(tmpl.tags.find((t) => t[0] === 'a')?.[1]).toBe(serviceCoord);

    const reparsed = parseTaskProposal(toEvent(tmpl, PATRON));
    expect(reparsed?.arbiterPubkey).toBe(ARBITER);
    expect(reparsed?.arbiterService).toBe(serviceCoord);
    expect(reparsed?.status).toBe('proposed'); // assigning an arbiter does not change status
    expect(reparsed?.patronPubkey).toBe(PATRON);
    expect(reparsed?.amount).toBe('75000');
  });
});
