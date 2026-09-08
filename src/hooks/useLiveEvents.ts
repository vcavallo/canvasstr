import { useEffect, useMemo, useRef, useState } from 'react';
import { useNostr } from '@nostrify/react';
import type { NostrEvent, NostrFilter } from '@nostrify/nostrify';

export interface LiveEvents {
  events: NostrEvent[];
  /** True once every relay has sent EOSE for the initial backfill. */
  eose: boolean;
  error?: string;
}

/**
 * Backfill + live subscription over the active relay set (or explicit `relays`).
 * Events accumulate in a Map keyed by id so relay duplicates collapse; callers do
 * replaceable-event dedupe themselves (they know the semantics). The subscription is
 * re-opened whenever the filters (by value) or relays change, and aborted on unmount.
 */
export function useLiveEvents(filters: NostrFilter[] | null, relays?: string[]): LiveEvents {
  const { nostr } = useNostr();
  const key = useMemo(() => JSON.stringify([filters, relays]), [filters, relays]);
  const [state, setState] = useState<LiveEvents>({ events: [], eose: false });
  const seen = useRef(new Map<string, NostrEvent>());
  const latest = useRef({ filters, relays });
  latest.current = { filters, relays };

  useEffect(() => {
    const { filters, relays } = latest.current;
    if (!filters || filters.length === 0) {
      seen.current = new Map();
      setState({ events: [], eose: true });
      return;
    }
    const controller = new AbortController();
    seen.current = new Map();
    setState({ events: [], eose: false });
    let pending: NostrEvent[] = [];
    let flushTimer: ReturnType<typeof setTimeout> | undefined;
    const flush = (eose?: boolean) => {
      flushTimer = undefined;
      const batch = pending;
      pending = [];
      let changed = false;
      for (const e of batch) {
        if (!seen.current.has(e.id)) { seen.current.set(e.id, e); changed = true; }
      }
      if (changed || eose !== undefined) {
        setState((s) => ({ events: changed ? [...seen.current.values()] : s.events, eose: eose ?? s.eose }));
      }
    };
    (async () => {
      try {
        for await (const msg of nostr.req(filters, { signal: controller.signal, relays })) {
          if (msg[0] === 'EVENT') {
            pending.push(msg[2]);
            if (!flushTimer) flushTimer = setTimeout(() => flush(), 80);
          } else if (msg[0] === 'EOSE') {
            if (flushTimer) clearTimeout(flushTimer);
            flush(true);
          } else if (msg[0] === 'CLOSED') {
            break;
          }
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          setState((s) => ({ ...s, eose: true, error: err instanceof Error ? err.message : String(err) }));
        }
      }
    })();
    return () => {
      controller.abort();
      if (flushTimer) clearTimeout(flushTimer);
    };
  }, [key, nostr]);

  return state;
}
