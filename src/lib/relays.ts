import type { AppConfig } from '@/contexts/AppContext';

/**
 * Resolve the active relay URLs for the current relay mode. Mirrors the routing
 * in `NostrProvider` so callers can know/display which relays a default query
 * would hit. (NostrProvider keeps its own copy against refs; this is the pure
 * version for read-only callers.)
 */
export function getActiveRelays(
  config: Pick<AppConfig, 'relayMode' | 'customRelay' | 'userRelays'>,
  presetRelays?: { name: string; url: string }[],
): string[] {
  const mode = config.relayMode ?? 'default';
  if (mode === 'custom' && config.customRelay) {
    return [config.customRelay];
  }
  if (mode === 'user' && config.userRelays && config.userRelays.length > 0) {
    return config.userRelays;
  }
  return (presetRelays ?? []).map(({ url }) => url);
}
