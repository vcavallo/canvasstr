import { nip19 } from 'nostr-tools';

const HEX64 = /^[0-9a-f]{64}$/;

/** Accept npub or hex; undefined for anything else. */
export function toHexPubkey(v: string | undefined | null): string | undefined {
  const s = v?.trim();
  if (!s) return undefined;
  if (HEX64.test(s)) return s;
  try {
    const d = nip19.decode(s);
    if (d.type === 'npub') return d.data;
    if (d.type === 'nprofile') return d.data.pubkey;
  } catch { /* fallthrough */ }
  return undefined;
}

export interface LensEnv {
  defaultPov?: string;
  houseProvider?: string;
  nip85Relay: string;
  brainstormSignup: string;
}

export function readLensEnv(env: Record<string, string | undefined> = import.meta.env as Record<string, string | undefined>): LensEnv {
  return {
    defaultPov: toHexPubkey(env.VITE_DEFAULT_POV) ?? '393198c60caafe80129194150570e11f5b3b5edb1876179aa652d88557c1ab44',
    houseProvider: toHexPubkey(env.VITE_HOUSE_POV_PROVIDER) ?? '919ba08af7786892093b8264332d817379662a0ba0ba1f5c791ed7b62a7ee2ff',
    nip85Relay: env.VITE_NIP85_RELAY?.trim() || 'wss://nip85.brainstorm.world',
    brainstormSignup: env.VITE_BRAINSTORM_SIGNUP?.trim() || 'https://tapestry.brainstorm.world/pages/customers/sign-up.html',
  };
}
