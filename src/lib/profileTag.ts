/**
 * Apply a tag to a profile: a Tapestry nostr-user-tag assertion (kind 39999). Shape per
 * tapestry/protocols/drafts/tags.md and the live writer (ui/src/utils/publishProfileTag.js):
 * deterministic d, `p` target, `a` tag coordinate (stable identity), `e` tag event id
 * (provenance), dual `z` (canonical legacy namespace + the deployment's TA), polarity.
 */
import type { EventTemplate } from './canvasstr';

/** ADR 0015: the nostr-user-tag concept is pinned to this literal namespace across deployments. */
export const LEGACY_TAG_NAMESPACE = '82b75e474dda005e912bcbb910391c60c2b89cc7faf5d3c30b7c59a324973833';
/** Runtime Tapestry Assistant per known tag relay (dual-z federation writes). */
export const TA_BY_RELAY: Record<string, string> = {
  'wss://tags.brainstorm.world/relay': 'a68dbf561cfe3da1b76f1e65c7d4d9cc116f79921b38a815fd75cb5460b4b599',
  'wss://tapestry.brainstorm.world/relay': '919ba08af7786892093b8264332d817379662a0ba0ba1f5c791ed7b62a7ee2ff',
};

export interface ProfileTagInput {
  taggedPubkey: string;
  /** `39999:<tagAuthor>:<slug>` */
  tagCoord: string;
  tagEventId: string;
  asserterPubkey: string;
  polarity?: 1 | -1;
  /** Relay the tag lives on, to pick the deployment TA for the second `z`. */
  relay?: string;
}

export function profileTagD(slug: string, taggedPubkey: string, asserterPubkey: string): string {
  return `profile-tag-${slug}-${taggedPubkey.slice(0, 8)}-${asserterPubkey.slice(0, 8)}`;
}

export function buildProfileTagTemplate(i: ProfileTagInput): EventTemplate {
  const HEX = /^[0-9a-f]{64}$/;
  if (!HEX.test(i.taggedPubkey) || !HEX.test(i.asserterPubkey) || !HEX.test(i.tagEventId)) throw new Error('bad pubkey or id');
  const m = i.tagCoord.match(/^39999:([0-9a-f]{64}):(.+)$/);
  if (!m) throw new Error('tagCoord must be 39999:<author>:<slug>');
  const slug = m[2];
  const polarity = i.polarity ?? 1;
  const tags: string[][] = [
    ['d', profileTagD(slug, i.taggedPubkey, i.asserterPubkey)],
    ['p', i.taggedPubkey],
    ['a', i.tagCoord],
    ['e', i.tagEventId],
    ['z', `39998:${LEGACY_TAG_NAMESPACE}:nostr-user-tag`],
  ];
  const ta = i.relay ? TA_BY_RELAY[i.relay] : undefined;
  if (ta && ta !== LEGACY_TAG_NAMESPACE) tags.push(['z', `39998:${ta}:nostr-user-tag`]);
  tags.push(['polarity', String(polarity)]);
  return { kind: 39999, content: JSON.stringify({ nostrUserTag: { taggedPubkey: i.taggedPubkey, tagEventId: i.tagEventId } }), tags };
}
