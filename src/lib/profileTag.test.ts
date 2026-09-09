import { describe, expect, it } from 'vitest';
import { buildProfileTagTemplate, LEGACY_TAG_NAMESPACE } from './profileTag';
import { parseContribution } from './contributions';
import { loadFixture } from '@/test/fixtures';

const A = 'a'.repeat(64), T = 'b'.repeat(64), ME = 'c'.repeat(64), ID = 'd'.repeat(64);

describe('buildProfileTagTemplate', () => {
  it('matches the live tagging shape and is counted by a tag-element target', () => {
    const t = buildProfileTagTemplate({ taggedPubkey: T, tagCoord: `39999:${A}:podcaster`, tagEventId: ID, asserterPubkey: ME, relay: 'wss://tags.brainstorm.world/relay' });
    expect(t.tags[0]).toEqual(['d', `profile-tag-podcaster-${T.slice(0, 8)}-${ME.slice(0, 8)}`]);
    expect(t.tags).toContainEqual(['p', T]);
    expect(t.tags).toContainEqual(['a', `39999:${A}:podcaster`]);
    expect(t.tags).toContainEqual(['z', `39998:${LEGACY_TAG_NAMESPACE}:nostr-user-tag`]);
    expect(t.tags.filter(([n]) => n === 'z')).toHaveLength(2);
    const c = parseContribution({ ...t, id: 'x', pubkey: ME, created_at: 1, sig: '' }, [{ z: `39999:${A}:podcaster`, hint: 'profile-tag', tagEventId: ID }]);
    expect(c?.kindOfContribution).toBe('profile-tag');
    expect(c?.taggedRef).toBe(T);
  });
  it('carries every tag name a real (legacy) tagging has, plus the a coordinate', () => {
    const real = loadFixture('profile-taggings.jsonl')[0];
    const mine = buildProfileTagTemplate({ taggedPubkey: T, tagCoord: `39999:${A}:x`, tagEventId: ID, asserterPubkey: ME });
    const names = (e: { tags: string[][] }) => [...new Set(e.tags.map(([n]) => n))].sort();
    for (const n of names(real)) expect(names(mine)).toContain(n);
    expect(names(mine)).toContain('a');
  });
});
