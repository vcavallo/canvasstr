import { LoginArea } from '@/components/auth/LoginArea';

export default function Home() {
  return (
    <main className="mx-auto max-w-4xl p-6 space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Gleaner</h1>
        <LoginArea className="max-w-60" />
      </header>
      <p className="text-muted-foreground">
        Bounties for building up decentralized lists, on Catallax. Scaffold only; see PLAN.md.
      </p>
    </main>
  );
}
