import { useEffect } from 'react';
import { useAppContext } from '@/hooks/useAppContext';

/**
 * Dev convenience: when `VITE_RELAY_URL` is set, make it authoritative — point the
 * app at that relay on load, even if a previous session persisted a different relay
 * to localStorage (which would otherwise win over the default config).
 *
 * No-op when the env var is unset: the persisted/default config is used and the
 * RelaySelector drives the relay normally. This keeps `VITE_RELAY_URL` a plain,
 * overridable convenience with no elevated status — unset it (or change it) to pick
 * the relay from the UI instead. (Tradeoff: while it's set, a relay chosen manually
 * in the UI resets to the env relay on the next reload.)
 */
export function RelayEnvOverride() {
  const { config, updateConfig } = useAppContext();
  const envRelay: string | undefined = import.meta.env.VITE_RELAY_URL?.trim() || undefined;

  useEffect(() => {
    if (!envRelay) return;
    // Already pointed there — nothing to do (avoids a needless config write/loop).
    if (config.relayMode === 'custom' && config.customRelay === envRelay) return;
    updateConfig((current) => ({
      ...current,
      relayUrl: envRelay,
      relayMode: 'custom',
      customRelay: envRelay,
    }));
  }, [envRelay, config.relayMode, config.customRelay, updateConfig]);

  return null;
}
