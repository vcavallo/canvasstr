import { Link } from 'react-router-dom';
import { LoginArea } from '@/components/auth/LoginArea';
import { LensBar } from './LensBar';

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
          <div>
            <Link to="/" className="text-xl font-semibold tracking-tight">Canvasstr</Link>
            <p className="text-sm text-muted-foreground">Get paid to build the <span title="lexiconomy.world — coming soon">lexiconomy</span>.</p>
          </div>
          <nav className="ml-auto mr-4 text-sm"><Link to="/about" className="underline">About</Link></nav>
          <LoginArea className="max-w-60" />
        </div>
        <div className="mx-auto max-w-5xl px-4 pb-3">
          <LensBar />
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
    </div>
  );
}
