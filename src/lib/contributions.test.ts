import { describe, expect, it } from 'vitest';
import { classifyTarget, collectContributions, parseContribution, targetsToFilter } from './contributions';
import { loadFixture } from '@/test/fixtures';

const TA = 'a68dbf561cfe3da1b76f1e65c7d4d9cc116f79921b38a815fd75cb5460b4b599';
const LEGACY = '82b75e474dda005e912bcbb910391c60c2b89cc7faf5d3c30b7c59a324973833';
const GITHUB = '39998:b83a28b7e4e5d20bd960c5faeb6625f95529166b8bdb045d42634a2f35919450:github-accounts';

describe('targetsToFilter', () => {
  it('is one #z filter over item kinds', () => {
    expect(targetsToFilter([{ z: GITHUB }, { z: `39998:${TA}:tag` }], 5)).toEqual({
      kinds: [39999, 9999], '#z': [GITHUB, `39998:${TA}:tag`], since: 5,
    });
  });
});

describe('classifyTarget', () => {
  it('reads the target shape', () => {
    expect(classifyTarget(GITHUB)).toBe('item');
    expect(classifyTarget(`39998:${TA}:tag`)).toBe('item');
    expect(classifyTarget(`39998:${LEGACY}:nostr-user-tag`)).toBe('profile-tag');
    expect(classifyTarget(`39998:${TA}:nostr-event-tag`)).toBe('event-tag');
    expect(classifyTarget(`39999:${TA}:tagging:awesome-tagging`)).toBe('event-tag');
  });
});

describe('real DList items (github-accounts)', () => {
  const items = loadFixture('list-items.jsonl');
  it('parse as item contributions keyed by coordinate', () => {
    const cs = collectContributions(items, [{ z: GITHUB }]);
    expect(cs.length).toBeGreaterThan(0);
    for (const c of cs) {
      expect(c.kindOfContribution).toBe('item');
      expect(c.ref).toMatch(/^39999:[0-9a-f]{64}:.+/);
      expect(c.label).toBeTruthy();
    }
  });
  it('ignore events for other targets', () => {
    expect(collectContributions(items, [{ z: `39998:${TA}:tag` }])).toHaveLength(0);
  });
});

describe('real tag-elements (lexicon entries)', () => {
  const els = loadFixture('tag-elements.jsonl');
  it('label from content JSON', () => {
    const cs = collectContributions(els, [{ z: `39998:${LEGACY}:tag` }]);
    expect(cs.length).toBeGreaterThan(0);
    expect(cs.every((c) => c.label && c.label !== c.id.slice(0, 8))).toBe(true);
  });
});

describe('real event taggings', () => {
  const ev = loadFixture('event-taggings.jsonl');
  it('match on either z namespace and expose the tagged thing and tag slug', () => {
    const viaLocal = collectContributions(ev, [{ z: `39998:${TA}:nostr-event-tag` }]);
    const viaLegacy = collectContributions(ev, [{ z: `39998:${LEGACY}:nostr-event-tag` }]);
    expect(viaLocal.length).toBeGreaterThan(0);
    expect(viaLegacy.length).toBeGreaterThan(0);
    for (const c of viaLocal) {
      expect(c.kindOfContribution).toBe('event-tag');
      expect(c.taggedRef).toBeTruthy();
      expect(c.tagCoord).toMatch(/:tagging:.+-tagging$/);
    }
  });
  it('a per-tag tagging header works as a narrower target', () => {
    const header = ev[0].tags.find(([n, v]) => n === 'z' && /-tagging$/.test(v))![1];
    const cs = collectContributions(ev, [{ z: header }]);
    expect(cs.length).toBeGreaterThan(0);
    expect(cs[0].target).toBe(header);
  });
});

describe('real profile taggings', () => {
  const ev = loadFixture('profile-taggings.jsonl');
  it('expose the tagged pubkey and drop disputes by default', () => {
    const all = collectContributions(ev, [{ z: `39998:${LEGACY}:nostr-user-tag` }], { includeDisputes: true });
    const applied = collectContributions(ev, [{ z: `39998:${LEGACY}:nostr-user-tag` }]);
    expect(all.length).toBeGreaterThan(0);
    expect(applied.length).toBeLessThanOrEqual(all.length);
    for (const c of all) {
      expect(c.kindOfContribution).toBe('profile-tag');
      expect(c.taggedRef).toMatch(/^[0-9a-f]{64}$/);
    }
    const disputed = { ...ev[0], id: 'x', tags: ev[0].tags.map((t) => (t[0] === 'polarity' ? ['polarity', '-1'] : t)) };
    expect(parseContribution(disputed, [{ z: `39998:${LEGACY}:nostr-user-tag` }])?.polarity).toBe(-1);
  });
});

describe('collectContributions dedupe and since', () => {
  const items = loadFixture('list-items.jsonl');
  it('keeps the latest version of an addressable contribution', () => {
    const older = { ...items[0], id: 'older', created_at: items[0].created_at - 10 };
    const cs = collectContributions([older, ...items], [{ z: GITHUB }]);
    expect(cs.filter((c) => c.ref === cs[0].ref)).toHaveLength(1);
    expect(cs.find((c) => c.id === 'older')).toBeUndefined();
  });
  it('drops anything before since and sorts by time', () => {
    const max = Math.max(...items.map((e) => e.created_at));
    expect(collectContributions(items, [{ z: GITHUB }], { since: max + 1 })).toHaveLength(0);
    const cs = collectContributions(items, [{ z: GITHUB }]);
    for (let i = 1; i < cs.length; i++) expect(cs[i].created_at).toBeGreaterThanOrEqual(cs[i - 1].created_at);
  });
});
