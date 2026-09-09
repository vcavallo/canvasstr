import { describe, expect, it } from 'vitest';
import { buildLoginTemplate, httpRankToScore, isTreasureMapRow, parseHistory, parseRankResults, parseResultStatus, povState } from './brainstorm';

describe('brainstorm', () => {
  it('login event carries the two required tags', () => {
    expect(buildLoginTemplate('abc').tags).toEqual([['t', 'brainstorm_login'], ['challenge', 'abc']]);
  });
  it('parses the live /user/history shape and derives POV state', () => {
    const body = { code: 200, data: { pubkey: 'a'.repeat(64), ta_pubkey: 'b'.repeat(64), last_time_calculated_graperank: null, last_time_triggered_graperank: '2026-09-09T03:38:14Z' } };
    const h = parseHistory(body)!;
    expect(h.taPubkey).toBe('b'.repeat(64));
    expect(povState(h)).toBe('computing');
    expect(povState({ ...h, lastCalculated: 'x' })).toBe('ready');
    expect(povState({ ...h, lastTriggered: undefined })).toBe('none');
    expect(povState(null)).toBe('none');
    expect(povState(h, 'failure')).toBe('failed');
    expect(parseResultStatus({ data: { status: 'failure' } })).toBe('failure');
    expect(parseResultStatus({ data: null })).toBeUndefined();
  });
  it('scales HTTP ranks to 0–100 and parses results', () => {
    expect(httpRankToScore(0.8727)).toBe(87);
    expect(httpRankToScore(2)).toBe(100);
    expect(parseRankResults({ results: [{ pubkey: 'x', rank: 0.5 }, { pubkey: 1 }] })).toEqual([{ pubkey: 'x', rank: 0.5 }]);
  });
  it('accepts 30382:metric and bare 3039x rows only', () => {
    expect(isTreasureMapRow(['30382:rank', 'f'.repeat(64), 'wss://x'])).toBe(true);
    expect(isTreasureMapRow(['30392', 'f'.repeat(64), 'wss://x'])).toBe(true);
    expect(isTreasureMapRow(['30392:tag', 'f'.repeat(64), 'wss://x'])).toBe(false);
    expect(isTreasureMapRow(['30382:rank', 'nothex'])).toBe(false);
  });
});
