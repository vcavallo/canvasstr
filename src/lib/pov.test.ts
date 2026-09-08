import { describe, expect, it } from 'vitest';
import { indexScores, parseScore, parseTreasureMap, passesLens, rankFilters, resolveLens } from './pov';
import { loadFixture } from '@/test/fixtures';

describe('parseTreasureMap on real 10040s', () => {
  const maps = loadFixture('treasure-maps.jsonl');
  it('finds a 30382:rank provider on each', () => {
    for (const m of maps) {
      const p = parseTreasureMap(m);
      expect(p.rank?.pubkey).toMatch(/^[0-9a-f]{64}$/);
      expect(p.rank?.relay).toMatch(/^wss:\/\//);
    }
  });
  it('accepts the bare 30392 row and ignores metric-parameterised or invalid ones', () => {
    const m = { ...maps[0], tags: [['30392:foo', 'a'.repeat(64), 'wss://x'], ['30392', 'nothex', 'wss://x'], ['30392', 'b'.repeat(64), 'wss://tl'], ['30392', 'c'.repeat(64), '']] };
    expect(parseTreasureMap(m).trustedLists).toEqual({ pubkey: 'b'.repeat(64), relay: 'wss://tl' });
  });
});

describe('scores on real 30382s', () => {
  const scores = loadFixture('scores.jsonl');
  it('parse subject and integer rank; a 30382 from another client with no rank tag is null', () => {
    const parsed = scores.map((s) => parseScore(s));
    expect(parsed.filter(Boolean).length).toBeGreaterThan(0);
    expect(parsed.some((p) => p === null)).toBe(true); // fixture includes an Amethyst 30382 with only a client tag
    for (const p of parsed) {
      if (!p) continue;
      expect(p.subject).toMatch(/^[0-9a-f]{64}$/);
      expect(Number.isInteger(p.rank)).toBe(true);
    }
  });
  it('index by subject and filter by provider', () => {
    const provider = scores[0].pubkey;
    const idx = indexScores(scores, provider);
    expect(idx.size).toBeGreaterThan(0);
    expect(indexScores(scores, 'f'.repeat(64)).size).toBe(0);
    const [subject, s] = [...idx.entries()][0];
    expect(passesLens(idx, subject, s.rank)).toBe(true);
    expect(passesLens(idx, subject, s.rank + 1)).toBe(false);
    expect(passesLens(idx, 'unknown', 1)).toBe(false);
    expect(passesLens(idx, 'unknown', 0)).toBe(true);
  });
});

describe('rankFilters', () => {
  it('chunks, dedupes and drops junk', () => {
    const subjects = Array.from({ length: 650 }, (_, i) => i.toString(16).padStart(64, '0'));
    const fs = rankFilters({ pubkey: 'p'.repeat(64) }, [...subjects, subjects[0], 'junk']);
    expect(fs).toHaveLength(3);
    expect(fs[0]['#d']).toHaveLength(300);
    expect(fs[2]['#d']).toHaveLength(50);
    expect(fs[0].authors).toEqual(['p'.repeat(64)]);
  });
});

describe('resolveLens order', () => {
  const prov = { pubkey: 'p'.repeat(64) };
  it('author beats everything, then url, self, default, house', () => {
    expect(resolveLens({ author: 'x', urlPov: { observer: 'u', provider: prov } }).source).toBe('author');
    expect(resolveLens({ urlPov: { observer: 'u', provider: prov }, self: { observer: 's', provider: prov } }).source).toBe('url');
    expect(resolveLens({ urlPov: { observer: 'u' }, self: { observer: 's', provider: prov } }).source).toBe('self');
    expect(resolveLens({ self: { observer: 's' }, defaultPov: { observer: 'd', provider: prov } }).source).toBe('default');
    expect(resolveLens({ houseProvider: prov })).toEqual({ source: 'house', provider: prov });
  });
});
