/**
 * Seed a local strfry with a reproducible Gleaner world so the board can be exercised
 * without touching public relays. Run: `npm run seed` (relay from `npm run relay:up`).
 *
 * Keys are fixed, throwaway dev keys — never use them for anything real.
 */
import { finalizeEvent, getPublicKey, type EventTemplate, type VerifiedEvent } from 'nostr-tools/pure';
import { Relay } from 'nostr-tools/relay';
import { nip19 } from 'nostr-tools';
import { buildArbiterAnnouncementTemplate } from '../../src/lib/catallax';
import { buildAcceptanceTemplate, buildCampaignTemplate, parseCampaign, type Campaign } from '../../src/lib/gleaner';

const RELAY = process.env.SEED_RELAY_URL ?? 'ws://127.0.0.1:7787';

function key(seed: string): Uint8Array {
  const b = new Uint8Array(32);
  for (let i = 0; i < 32; i++) b[i] = (seed.charCodeAt(i % seed.length) * (i + 7)) % 256;
  b[0] = 1; // keep it a valid scalar
  return b;
}
const ACCOUNTS = {
  patron: key('gleaner-dev-patron'),
  arbiter: key('gleaner-dev-arbiter'),
  alice: key('gleaner-dev-alice'),
  bob: key('gleaner-dev-bob'),
  carol: key('gleaner-dev-carol'),
};
type Who = keyof typeof ACCOUNTS;
const pk = (w: Who) => getPublicKey(ACCOUNTS[w]);

const GITHUB_LIST = '39998:b83a28b7e4e5d20bd960c5faeb6625f95529166b8bdb045d42634a2f35919450:github-accounts';
const LOCAL_LIST_D = 'toronto-restaurants';

let clock = Math.floor(Date.now() / 1000) - 3600;
const tick = () => (clock += 60);

async function main() {
  const relay = await Relay.connect(RELAY);
  const published: VerifiedEvent[] = [];
  const pub = async (who: Who, t: EventTemplate | { kind: number; content: string; tags: string[][] }) => {
    const ev = finalizeEvent({ created_at: tick(), ...t }, ACCOUNTS[who]);
    await relay.publish(ev);
    published.push(ev);
    return ev;
  };

  for (const [who, name] of [['patron', 'Pat the Patron'], ['arbiter', 'Arbie'], ['alice', 'alice'], ['bob', 'bob'], ['carol', 'carol']] as [Who, string][]) {
    await pub(who, { kind: 0, content: JSON.stringify({ name, about: `Gleaner dev seed (${name})`, lud16: `${who}@example.invalid` }), tags: [] });
  }

  const svc = await pub('arbiter', buildArbiterAnnouncementTemplate({ d: 'gleaner-arbiter', pubkey: pk('arbiter'), name: 'Arbie judges lists', feeType: 'flat', feeAmount: '0' }));
  const arbiterService = `33400:${pk('arbiter')}:gleaner-arbiter`;
  void svc;

  // Campaign 1: targets a REAL list on tags.brainstorm.world; contributions stream from there.
  const c1 = await pub('patron', buildCampaignTemplate({
    d: 'github-accounts-bounty', patronPubkey: pk('patron'), arbiterPubkey: pk('arbiter'), arbiterService,
    title: 'Map nostr devs to their GitHub accounts',
    description: 'Add items to the github-accounts DList: one nostr pubkey → one GitHub username.',
    requirements: 'The GitHub account must actually belong to the nostr pubkey.',
    amount: '5000', rate: 250, maxPerPubkey: 5, payout: 'streaming', status: 'open',
    targets: [{ z: GITHUB_LIST, relay: 'wss://tags.brainstorm.world/relay', hint: 'item' }],
    since: 1_780_000_000,
  }));

  // Campaign 2: a local list with local contributions, showing every row state.
  await pub('patron', { kind: 39998, content: '', tags: [['d', LOCAL_LIST_D], ['names', 'restaurant', 'restaurants'], ['description', 'Restaurants in Toronto'], ['required', 'name']] });
  const localTarget = `39998:${pk('patron')}:${LOCAL_LIST_D}`;
  const c2ev = await pub('patron', buildCampaignTemplate({
    d: 'toronto-restaurants-bounty', patronPubkey: pk('patron'), arbiterPubkey: pk('arbiter'), arbiterService,
    title: 'Restaurants in Toronto', description: 'Add restaurants you have actually eaten at.', requirements: 'Real places. One per item.',
    amount: '2000', rate: 500, maxPerPubkey: 2, payout: 'streaming', status: 'open',
    targets: [{ z: localTarget, relay: RELAY, hint: 'item' }], since: clock,
  }));
  const c2 = parseCampaign(c2ev) as Campaign;

  const item = (who: Who, name: string) => pub(who, { kind: 39999, content: '', tags: [['d', name.toLowerCase().replace(/\W+/g, '-')], ['z', localTarget], ['name', name]] });
  const a1 = await item('alice', 'Sushi Kaji');
  const b1 = await item('bob', 'Pizzeria Libretto');
  const b2 = await item('bob', 'Not A Real Place');
  await item('carol', 'Bar Isabel');
  await item('alice', 'Alo');

  // alice paid: arbiter-signed zap request inside a receipt, then a 3402.
  const zapReq = finalizeEvent({ kind: 9734, created_at: tick(), content: '', tags: [['p', pk('alice')], ['e', a1.id], ['a', `33401:${pk('patron')}:${c2.d}`], ['a', localTarget], ['amount', '500000'], ['relays', RELAY]] }, ACCOUNTS.arbiter);
  const receipt = await pub('carol' /* stands in for the LNURL zapper key */, { kind: 9735, content: '', tags: [['p', pk('alice')], ['e', a1.id], ['a', `33401:${pk('patron')}:${c2.d}`], ['description', JSON.stringify(zapReq)], ['bolt11', 'lnbc5u1fake']] });
  await pub('arbiter', buildAcceptanceTemplate({ campaign: c2, contribution: a1, payoutReceiptId: receipt.id, resolution: 'successful', details: 'Great sushi.' }));
  // bob: one accepted-with-receipt-pending is not allowed by protocol (needs receipt); instead show a receipt-only "paid" row and a rejection.
  const zapReq2 = finalizeEvent({ kind: 9734, created_at: tick(), content: '', tags: [['p', pk('bob')], ['e', b1.id], ['a', `33401:${pk('patron')}:${c2.d}`], ['amount', '500000']] }, ACCOUNTS.arbiter);
  await pub('carol', { kind: 9735, content: '', tags: [['p', pk('bob')], ['e', b1.id], ['a', `33401:${pk('patron')}:${c2.d}`], ['description', JSON.stringify(zapReq2)]] });
  await pub('arbiter', buildAcceptanceTemplate({ campaign: c2, contribution: b2, resolution: 'rejected', details: 'Could not find it.' }));

  relay.close();
  console.log(`Seeded ${published.length} events → ${RELAY}`);
  console.log(`campaign 1: /campaign/${nip19.naddrEncode({ kind: 33401, pubkey: pk('patron'), identifier: 'github-accounts-bounty' })}`);
  console.log(`campaign 2: /campaign/${nip19.naddrEncode({ kind: 33401, pubkey: pk('patron'), identifier: c2.d })}`);
  console.log(`c1 id ${c1.id.slice(0, 8)}`);
  for (const w of Object.keys(ACCOUNTS) as Who[]) console.log(`${w.padEnd(8)} ${nip19.npubEncode(pk(w))}  nsec ${nip19.nsecEncode(ACCOUNTS[w])}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
