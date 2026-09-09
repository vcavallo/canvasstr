import { nip19 } from 'nostr-tools';
import { CATALLAX_KINDS } from './catallax';
import type { Campaign } from './canvasstr';

export function campaignNaddr(c: Pick<Campaign, 'patronPubkey' | 'd'>): string {
  return nip19.naddrEncode({ kind: CATALLAX_KINDS.TASK_PROPOSAL, pubkey: c.patronPubkey, identifier: c.d });
}

export function decodeCampaignNaddr(s: string | undefined): { pubkey: string; identifier: string } | null {
  if (!s) return null;
  try {
    const d = nip19.decode(s);
    if (d.type === 'naddr' && d.data.kind === CATALLAX_KINDS.TASK_PROPOSAL) return d.data;
  } catch { /* invalid */ }
  return null;
}
