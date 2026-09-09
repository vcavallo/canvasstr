import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';

/** localStorage key the query-cache persister writes to (see src/App.tsx). */
const QUERY_CACHE_KEY = 'canvasstr:query-cache';

interface Props {
  children: ReactNode;
}
interface State {
  hasError: boolean;
}

/**
 * Catches render-time crashes so the app degrades to a "reload" prompt instead of a
 * blank white screen. The most likely trigger is a corrupt/incompatible persisted
 * query cache (e.g. a restored value whose shape no longer matches), so we clear that
 * cache on catch — a reload then self-heals. Clearing is harmless if the error was
 * unrelated (just a cold next load).
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    try {
      localStorage.removeItem(QUERY_CACHE_KEY);
    } catch {
      // localStorage may be unavailable (e.g. private mode) — nothing to clear.
    }
    console.error('App crashed (cleared persisted cache):', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center">
          <p className="text-lg font-medium">Something went wrong.</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            The local cache was cleared. Reload to continue.
          </p>
          <Button onClick={() => window.location.reload()}>Reload</Button>
        </div>
      );
    }
    return this.props.children;
  }
}
