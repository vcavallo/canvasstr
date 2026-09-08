import path from "node:path";

import react from "@vitejs/plugin-react-swc";
import { configDefaults, defineConfig } from "vitest/config";
import type { Plugin } from "vite";

// Dev-server-only CSP relaxation: the production CSP in index.html allows only
// secure `wss:` relays (correct for a deployed app). The local strfry used for
// dev/seed speaks plaintext `ws:`, which that policy blocks. This plugin adds
// `ws:` to `connect-src` ONLY when serving the dev server (`apply: 'serve'`), so
// the production build's CSP is left strict and untouched.
function devAllowWsRelay(): Plugin {
  return {
    name: "dev-allow-ws-relay",
    apply: "serve",
    transformIndexHtml(html: string) {
      return html.replace(
        "connect-src 'self' blob: https: wss:",
        "connect-src 'self' blob: https: wss: ws:",
      );
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig(() => ({
  server: {
    host: "::",
    port: 8080,
    // Dev server only: accept any Host header. Gleaner is meant to be run and
    // forked behind arbitrary hostnames (containers, cloud IDEs, reverse proxies),
    // so we don't hardcode an allowlist. Does not affect the production build.
    allowedHosts: true,
  },
  plugins: [
    react(),
    devAllowWsRelay(),
  ],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    // The Docker/strfry + nak e2e suites run under vitest.e2e.config.ts
    // (`npm run test:e2e`), never in the fast unit gate. Match every *.e2e.test.ts
    // wherever it lives (test/e2e, test/seed, …); plain *.test.ts stay in the gate.
    // Keep the Docker/nak e2e suites and the Playwright browser specs out of the
    // fast unit gate; they run under `npm run test:e2e` / `npm run test:browser`.
    exclude: [...configDefaults.exclude, 'test/**/*.e2e.test.ts', 'test/browser/**', '.direnv/**'],
    onConsoleLog(log) {
      return !log.includes("React Router Future Flag Warning");
    },
    env: {
      DEBUG_PRINT_LIMIT: '0', // Suppress DOM output that exceeds AI context windows
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));