import { describe, expect, it } from 'vitest';
import { buildDlistItemTemplate, slugify } from './dlist';
import { parseContribution } from './contributions';

const LIST = '39998:' + 'a'.repeat(64) + ':places';

describe('buildDlistItemTemplate', () => {
  it('produces an item the contribution parser matches to its target', () => {
    const t = buildDlistItemTemplate({ target: LIST, name: 'Sushi Kaji', description: 'omakase' });
    expect(t.kind).toBe(39999);
    expect(t.tags).toContainEqual(['d', 'sushi-kaji']);
    expect(t.tags).toContainEqual(['z', LIST]);
    const c = parseContribution({ ...t, id: 'x', pubkey: 'b'.repeat(64), created_at: 1, sig: '' }, [{ z: LIST }]);
    expect(c?.label).toBe('Sushi Kaji');
    expect(c?.kindOfContribution).toBe('item');
  });
  it('slugifies like Tapestry (NFD strip, lowercase, dashes)', () => {
    expect(slugify('Café Été!')).toBe('cafe-ete');
    expect(slugify('   ')).toBe('item');
  });
  it('rejects empty names and attaches a payload', () => {
    expect(() => buildDlistItemTemplate({ target: LIST, name: ' ' })).toThrow();
    const t = buildDlistItemTemplate({ target: LIST, name: 'x', payload: { tag: 'p', value: 'c'.repeat(64) } });
    expect(t.tags).toContainEqual(['p', 'c'.repeat(64)]);
  });
});
