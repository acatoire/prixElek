/**
 * tests/integration/vitest.config.integration.ts
 *
 * Separate Vitest config for integration tests.
 * - No coverage thresholds (real network calls may be slow/flaky)
 * - No MSW — real HTTP requests against materielelectrique.com
 * - Longer timeouts
 * - Run manually or via the dedicated GitHub Action only
 *
 * Usage:
 *   npm run test:integration
 */

import { defineConfig } from 'vitest/config';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('../../src', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    globals: true,
    include: ['tests/integration/**/*.test.ts'],
    testTimeout: 60_000,    // 60s per test — real network may be slow
    hookTimeout: 30_000,
    reporters: ['verbose'],
    // No coverage — integration tests are about behaviour, not code coverage
  },
});

