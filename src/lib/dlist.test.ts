import { describe, expect, it } from 'vitest';
import { buildDlistItemTemplate, parseHeaderSchema, slugify } from './dlist';
import { parseContribution } from './contributions';
import { loadFixture } from '@/test/fixtures';

const LIST = '39998:' + 'a'.repeat(64) + ':places';
const github = loadFixture('headers.jsonl').find((e) => e.tags.some(([n, v]) => n === 'd' && v === 'github-accounts'))!;

describe('parseHeaderSchema', () => {
  it('reads the real github-accounts header', () => {
    const s = parseHeaderSchema(github);
    expect(s.singular).toBe('GitHub Account');
    expect(s.fields).toEqual([{ name: 'github-username', level: 'required', description: undefined, type: 'text' }]);
  });
  it('defaults to a required name when the header declares nothing', () => {
    expect(parseHeaderSchema(null).fields).toEqual([{ name: 'name', level: 'required', type: 'text' }]);
  });
});

describe('buildDlistItemTemplate', () => {
  const schema = parseHeaderSchema(github);
  it('emits the header-declared tag and the parser labels by it', () => {
    const t = buildDlistItemTemplate({ target: LIST, fields: { 'github-username': 'wds4', description: 'David' }, schema, suffix: 'abc123' });
    expect(t.tags).toContainEqual(['github-username', 'wds4']);
    expect(t.tags).toContainEqual(['description', 'David']);
    expect(t.tags).toContainEqual(['d', 'wds4-abc123']);
    const c = parseContribution({ ...t, id: 'x', pubkey: 'b'.repeat(64), created_at: 1, sig: '' }, [{ z: LIST }]);
    expect(c?.label).toBe('wds4');
    expect(c?.fields).toEqual([['github-username', 'wds4'], ['description', 'David']]);
  });
  it('enforces required and disallowed', () => {
    expect(() => buildDlistItemTemplate({ target: LIST, fields: { description: 'x' }, schema })).toThrow(/required/);
    const strict = { ...schema, disallowed: ['description'] };
    expect(() => buildDlistItemTemplate({ target: LIST, fields: { 'github-username': 'a', description: 'x' }, schema: strict })).toThrow(/not allowed/);
  });
  it('slugifies like Tapestry', () => {
    expect(slugify('Café Été!')).toBe('cafe-ete');
    expect(slugify('   ')).toBe('item');
  });
});
