/**
 * Brainstorm (api.brainstorm.world) integration, pure parts. Verified live 2026-09-08:
 * - CORS `*`, header auth, no cookies.
 * - Login: GET /authChallenge/{pk} → sign an event with tags [t brainstorm_login][challenge …]
 *   → POST /authChallenge/{pk}/verify {signed_event} → {data:{token}}. Creates the observer's
 *   assistant key server-side (this IS signup).
 * - POST /user/graperank (Bearer) queues a personalised calculation; GET /user/history reports
 *   ta_pubkey and last_time_calculated_graperank. Poll every 60 s; per-IP limit 3 / 30 min.
 * - GET /setup/{pk} → 10040 tag rows (after signup). POST /rank/pubkeys {pubkeys,pov} → ranks
 *   as 0–1 floats, no auth; 202 = computing, 422 = POV not provisioned.
 */
export const BRAINSTORM_API = 'https://api.brainstorm.world';
export const BRAINSTORM_LOGIN_KIND = 22242;
export const POLL_SECONDS = 60;

export function buildLoginTemplate(challenge: string): { kind: number; content: string; tags: string[][] } {
  return { kind: BRAINSTORM_LOGIN_KIND, content: '', tags: [['t', 'brainstorm_login'], ['challenge', challenge]] };
}

export interface BrainstormHistory {
  pubkey: string;
  taPubkey: string;
  lastCalculated?: string;
  lastTriggered?: string;
}

export function parseHistory(body: unknown): BrainstormHistory | null {
  const d = (body as { data?: Record<string, string | null> })?.data;
  if (!d?.pubkey || !d.ta_pubkey) return null;
  return { pubkey: d.pubkey, taPubkey: d.ta_pubkey, lastCalculated: d.last_time_calculated_graperank ?? undefined, lastTriggered: d.last_time_triggered_graperank ?? undefined };
}

export type PovState = 'unknown' | 'none' | 'computing' | 'ready' | 'failed';

/** Status of the latest calculation from GET /user/graperankResult. */
export function parseResultStatus(body: unknown): 'waiting' | 'running' | 'success' | 'failure' | undefined {
  const s = (body as { data?: { status?: string } })?.data?.status;
  return s === 'waiting' || s === 'running' || s === 'success' || s === 'failure' ? s : undefined;
}

/** A POV is usable once a calculation has completed at least once. */
export function povState(h: BrainstormHistory | null, lastResult?: ReturnType<typeof parseResultStatus>): PovState {
  if (!h) return 'none';
  if (h.lastCalculated) return 'ready';
  if (h.lastTriggered) return lastResult === 'failure' ? 'failed' : 'computing';
  return 'none';
}

/** 0–1 float from the HTTP API → the 0–100 integer used on kind 30382. */
export function httpRankToScore(rank: number): number {
  return Math.round(Math.max(0, Math.min(1, rank)) * 100);
}

export interface RankResult { pubkey: string; rank: number }
export function parseRankResults(body: unknown): RankResult[] {
  const r = (body as { results?: { pubkey: string; rank: number }[] })?.results ?? [];
  return r.filter((x) => typeof x.pubkey === 'string' && typeof x.rank === 'number');
}

/** Only the metric rows a 10040 reader needs; keeps whatever the server sends (bare 30392 too). */
export function isTreasureMapRow(row: string[]): boolean {
  return row.length >= 2 && /^[0-9a-f]{64}$/.test(row[1]) && /^(30382:[a-z_]+|3039\d)$/.test(row[0]);
}
