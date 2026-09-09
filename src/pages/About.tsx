import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import { Layout } from '@/components/canvasstr/Layout';

const REPO = 'https://github.com/vcavallo/canvasstr';

function H({ children }: { children: React.ReactNode }) { return <h2 className="mt-8 text-xl font-semibold">{children}</h2>; }
function P({ children }: { children: React.ReactNode }) { return <p className="mt-3 leading-relaxed">{children}</p>; }
const A = ({ href, children }: { href: string; children: React.ReactNode }) => <a className="underline" href={href} target="_blank" rel="noreferrer">{children}</a>;

export default function About() {
  return (
    <Layout>
      <Helmet><title>About — Canvasstr</title></Helmet>
      <article className="prose-sm max-w-3xl text-base">
        <h1 className="text-3xl font-bold">Get paid to build the lexiconomy.</h1>
        <P>Canvasstr is a bounty board for curation. Someone puts up sats for a list they want built, people go out and fill it, a judge pays the entries that are good. The lists are public, permissionless and live on Nostr. Nobody owns them, and nobody has to ask permission to add to one.</P>

        <H>What this is</H>
        <P>Most of what makes the internet useful is a list somebody curated: the restaurants worth eating at, the developers behind a project, who actually hosts a podcast. On Nostr these lists are <A href="https://nostrhub.io/naddr1qvzqqqrcvypzpef89h53f0fsza2ugwdc3e54nfpun5nxfqclpy79r6w8nxsk5yp0qythwumn8ghj7erpwe5kgtnwdaehgu339e3k7mf0qqfkgetrv4h8gunpd35h5ety94kxjum5wv4px7v6">decentralized lists</A>: anyone can declare one, anyone can add to it, and every entry is a signed event that belongs to the person who wrote it. Tags work the same way. "Podcaster" is a tag, and the podcasters are whoever people have tagged.</P>
        <P>The catch with permissionless lists is that nobody is paid to fill them. Canvasstr fixes that. A <strong>campaign</strong> puts a price on each good entry, and the board shows every contribution as it arrives, who added it, whether your network vouches for it, and whether it has been paid.</P>

        <H>Three roles</H>
        <P><strong>Patrons</strong> want a list built and pay for it. You name the list or tag, the rate per accepted entry, and a budget. Fund it yourself or crowdfund it.</P>
        <P><strong>Canvassers</strong> fill the list. Add an item, tag a profile, from here or from any Nostr app that speaks decentralized lists. You do not need to know a campaign exists to be paid by one; if your entry is good, the purser finds it.</P>
        <P><strong>Pursers</strong> judge and pay. (In Catallax terms the purser is the arbiter; the wire format keeps that word.) They hold the escrow, look at each entry, and pay the canvasser directly over Lightning. Their judgement is public: every acceptance is a signed event, and every payment has a receipt. Patrons often arbitrate their own campaigns. Anyone can announce themselves as a purser.</P>

        <H>How it works</H>
        <P>Canvasstr is a client for <A href="https://catallax.network">Catallax</A>, an open protocol for contract work on Nostr with three parties: a patron who wants work done, a free agent who does it, and a purser who holds the money and settles. Canvasstr narrows that to one kind of work, curation, and stretches one task to many workers: a campaign is a Catallax task with no fixed worker, and every accepted entry gets its own conclusion and its own payment. The wire format is documented in the repository; there are no new event kinds, only a few extra tags.</P>
        <P>Payments are real Lightning payments from the purser's wallet to the canvasser's Lightning address, made as zaps so the receipt lands on the relays. The board flips an entry to "paid" the moment the receipt appears. Nothing here custodies your money except the purser you chose.</P>

        <H>There is no central curator</H>
        <P>Everything you see here is filtered through a <strong>point of view</strong>: a web-of-trust score computed from one person's follows, mutes and reports, extended out through their network. Campaigns from people your network does not trust are collapsed. Votes from people your network trusts count more. Canvassers who game the system lose trust and fade. That is the whole moderation model.</P>
        <P>The point of view is yours to choose. Log in and press "Create my point of view" and Canvasstr asks <A href="https://brainstorm.world">Brainstorm</A> to compute one from your key; after that every board is ranked by your own network. Until you do, the site uses a default point of view, currently the person who runs this deployment, and says so in the lens bar. That default is not a gatekeeper. It cannot stop anyone from publishing a campaign or an entry; it only decides what a visitor without a point of view sees first. Anyone can run their own Canvasstr with a different default, and any visitor can switch to any point of view, or to "view as author" to see everything one person has published, ranked by nobody.</P>
        <P>If you want the long version of why trust should be personal rather than platform-wide, read <A href="https://brainstorm.world/what-is-wot">What is a web of trust?</A></P>

        <H>Purser fees</H>
        <P>Canvasstr does not compute purser fees. The patron and the purser agree on one out of band, if any, and the patron pays it on top of the escrow when funding: there is a field for it. The campaign's amount, the sats per entry and the number of slots are unaffected; the fee is a tip to the judge, not part of the pot.</P>

        <H>Why bother</H>
        <P><strong>As a patron</strong>, because a list you need does not exist yet, and a few thousand sats will get it built by people who actually know the territory. <strong>As a canvasser</strong>, because you already know things, and being paid for them is better than posting them into the void. <strong>As a purser</strong>, because good judgement is worth a fee, and a public record of fair judgement is a reputation.</P>

        <H>Open source, open protocol</H>
        <P>Canvasstr is free software: <A href={REPO}>source on GitHub</A>. Its sibling <A href="https://grantless.org">Grantless</A> applies the same protocol to crowdfunded grants for open-source work. The lists and tags are plain Nostr events any app can read or write. Points of view are <strong>Trusted Assertions</strong> (<A href="https://nips.nostr.com/85">NIP-85</A>) published by a provider you delegate to; <A href="https://brainstorm.world">Brainstorm</A> is one provider that computes them (GrapeRank, per point of view) and publishes them, and any user or deployment can choose another. The lexiconomy is bigger than any one app; when the site for it is ready it will be at lexiconomy.world.</P>

        <p className="mt-10 text-sm text-muted-foreground"><Link to="/" className="underline">Back to campaigns</Link></p>
      </article>
    </Layout>
  );
}
