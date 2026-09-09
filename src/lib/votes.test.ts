import { describe, expect, it } from 'vitest';
import type { NostrEvent } from '@nostrify/nostrify';
import { buildVoteTemplate, parseVote, tallyVotes, votesFilters } from './votes';

const alice = '1'.repeat(64), bob = '2'.repeat(64), carol = '3'.repeat(64);
const item = { id: 'item-v2', ref: `39999:${alice}:sushi`, pubkey: alice, kind: 39999 };
const vote = (voter: string, content: string, created_at: number, tags: string[][], id = `${voter.slice(0, 2)}-${created_at}`): NostrEvent =>
  ({ kind: 7, id, pubkey: voter, created_at, content, tags, sig: '' });

describe('parseVote', () => {
  it('reads +/- and both target forms', () => {
    const v = parseVote(vote(bob, '+', 1, [['e', 'x'], ['a', item.ref], ['a', '39998:' + alice + ':list']]))!;
    expect(v.value).toBe(1);
    expect(v.eventIds).toEqual(['x']);
    expect(v.coords).toEqual([item.ref]); // list coordinate ignored
    expect(parseVote(vote(bob, '🔥', 1, [['e', 'x']]))).toBeNull();
    expect(parseVote(vote(bob, '-', 1, []))).toBeNull();
  });
});

describe('tallyVotes', () => {
  const scores = new Map([[bob, { subject: bob, rank: 80, created_at: 0 }]]);
  it('counts per coordinate, latest per voter, weighted by lens, ignoring self-votes', () => {
    const votes = [
      vote(bob, '+', 10, [['e', 'item-v1']]),                    // old id, still counts via… no: unknown id
      vote(bob, '+', 11, [['a', item.ref]]),                     // by coordinate
      vote(carol, '-', 12, [['e', 'item-v2']]),                  // unscored → total only
      vote(carol, '+', 13, [['e', 'item-v2']]),                  // carol changed her mind
      vote(alice, '+', 14, [['e', 'item-v2']]),                  // self-vote ignored
    ];
    const t = tallyVotes([item], votes, { scores, minRank: 50, viewer: carol }).get(item.ref)!;
    expect(t.up).toBe(2);
    expect(t.down).toBe(0);
    expect(t.upNet).toBe(1);
    expect(t.mine).toBe(1);
    expect(t.voters.sort()).toEqual([bob, carol].sort());
  });
  it('is empty without votes and builds two filters', () => {
    expect(tallyVotes([item], []).size).toBe(0);
    expect(votesFilters([item])).toEqual([{ kinds: [7], '#e': ['item-v2'] }, { kinds: [7], '#a': [item.ref] }]);
  });
});

describe('buildVoteTemplate', () => {
  it('tags e, a, p, k so any DList client attributes it', () => {
    const t = buildVoteTemplate(item, -1, 'wss://r');
    expect(t.content).toBe('-');
    expect(t.tags).toEqual([['e', 'item-v2', 'wss://r'], ['p', alice], ['k', '39999'], ['a', item.ref, 'wss://r']]);
  });
});
