// NOTE: This file should normally not be modified unless you are adding a new provider.
// To add new routes, edit the AppRouter.tsx file.

import { QueryClient } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import { HelmetProvider } from 'react-helmet-async';
import { Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import superjson from 'superjson';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import NostrProvider from '@/components/NostrProvider';
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { NostrLoginProvider } from '@nostrify/react/login';
import { AppProvider } from '@/components/AppProvider';
import { RelayEnvOverride } from '@/components/RelayEnvOverride';
import { AppConfig } from '@/contexts/AppContext';
import AppRouter from './AppRouter';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 60000, // 1 minute
      gcTime: Infinity,
    },
  },
});

// Persist the query cache to localStorage so a hard reload paints last-seen content
// immediately (then revalidates) instead of starting cold. Local, per-browser, public
// Nostr events only — no privilege, fork-safe. Relay/account context lives in the query
// keys (so a relay/account switch never reuses another context's cache); `buster` is a
// schema version — bump it to discard all persisted data on a breaking cache change.
const persister = createSyncStoragePersister({
  storage: typeof window !== 'undefined' ? window.localStorage : undefined,
  key: 'canvasstr:query-cache',
  // superjson (not plain JSON) so query data containing Maps/Sets/Dates round-trips
  // correctly — several hooks return Map data (e.g. useGoalsProgress, useNomineeProfiles),
  // and JSON would silently turn a Map into {} and crash consumers on restore.
  serialize: (client) => superjson.stringify(client),
  deserialize: (cached) => superjson.parse(cached),
});
const persistOptions = {
  persister,
  maxAge: 1000 * 60 * 60 * 24, // 24h
  buster: 'v2', // schema version — bumped to v2 to discard v1 (plain-JSON) caches after the superjson switch
};

// Default relay + read set. Campaigns (Catallax kinds) live on relay.grantless.org;
// DList headers, items and taggings live on the Brainstorm relays. None is privileged.
//   VITE_RELAY_URL     — point the WHOLE app at one relay (e.g. a local strfry for dev).
//   VITE_DEFAULT_RELAY — swap the default relay without code edits.
const defaultRelay: string = import.meta.env.VITE_DEFAULT_RELAY?.trim() || 'wss://relay.grantless.org';
const envRelay: string | undefined = import.meta.env.VITE_RELAY_URL?.trim() || undefined;

const defaultConfig: AppConfig = envRelay
  ? { theme: "light", relayUrl: envRelay, relayMode: "custom", customRelay: envRelay }
  : { theme: "light", relayUrl: defaultRelay, relayMode: "default" };

const presetRelays = [
  { url: defaultRelay, name: 'Grantless (Catallax)' },
  { url: 'wss://tags.brainstorm.world/relay', name: 'Brainstorm tags' },
  { url: 'wss://dcosl.brainstorm.world/relay', name: 'Brainstorm DCoSL' },
  { url: 'wss://relay.nostr.band', name: 'Nostr.Band' },
  { url: 'wss://relay.primal.net', name: 'Primal' },
];

/** Minimal fallback while a route's lazy chunk loads. */
function RouteFallback() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );
}

export function App() {
  return (
    <ErrorBoundary>
    <HelmetProvider>
      <AppProvider storageKey="nostr:app-config" defaultConfig={defaultConfig} presetRelays={presetRelays}>
        <RelayEnvOverride />
        <PersistQueryClientProvider client={queryClient} persistOptions={persistOptions}>
          <NostrLoginProvider storageKey='nostr:login'>
            <NostrProvider>
              <TooltipProvider>
                <Toaster />
                <Sonner />
                <Suspense fallback={<RouteFallback />}>
                  <AppRouter />
                </Suspense>
              </TooltipProvider>
            </NostrProvider>
          </NostrLoginProvider>
        </PersistQueryClientProvider>
      </AppProvider>
    </HelmetProvider>
    </ErrorBoundary>
  );
}

export default App;
