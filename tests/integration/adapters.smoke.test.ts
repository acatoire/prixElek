// @vitest-environment node
/**
 * tests/integration/adapters.smoke.test.ts
 *
 * Non-regression smoke tests — one real HTTP request per supplier adapter.
 * Verifies that scraping / API calls still work against live endpoints.
 *
 * ⚠  NOT part of the unit-test suite (no MSW, real network).
 *    Run with:  npm run test:integration
 *
 * Prerequisites:
 *   Copy tests/integration/test-config.sample.json
 *     to tests/integration/test-config.json
 *   and fill in real credentials.
 *   See README-SCRAPING.md for details on obtaining each credential.
 *
 * Each supplier block is skipped silently when its key is absent from
 * test-config.json, so running with partial credentials is safe.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { RexelAdapter } from '../../src/adapters/rexel';
import { BricodepotAdapter } from '../../src/adapters/bricodepot';
import { MaterielElectriqueAdapter } from '../../src/adapters/materielelectrique';

// ── Config types ──────────────────────────────────────────────────────────────

interface RexelSmokeConfig {
  token: string;
  branchId: string;
  zipcode: string;
  city: string;
  sku: string;
  expectedPriceMin: number;
  expectedPriceMax: number;
}

interface BricodepotSmokeConfig {
  cookies: string;
  pageSlug: string;
  expectedPriceMin: number;
  expectedPriceMax: number;
}

interface MaterielElectriqueSmokeConfig {
  pageSlug: string;
  reference: string;
  expectedPriceMin: number;
  expectedPriceMax: number;
}

interface SmokeTestConfig {
  rexel?: RexelSmokeConfig;
  bricodepot?: BricodepotSmokeConfig;
  materielelectrique?: MaterielElectriqueSmokeConfig;
}

// ── Load config ───────────────────────────────────────────────────────────────

const CONFIG_PATH = path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'test-config.json');

function loadConfig(): SmokeTestConfig {
  try {
    const raw = fs.readFileSync(CONFIG_PATH, 'utf-8');
    return JSON.parse(raw) as SmokeTestConfig;
  } catch {
    console.warn(
      '\n⚠  tests/integration/test-config.json not found — all smoke tests will be skipped.\n' +
        '   Copy test-config.sample.json → test-config.json and fill in credentials.\n' +
        '   See README-SCRAPING.md for instructions.\n'
    );
    return {};
  }
}

const cfg = loadConfig();

// ── Helper ────────────────────────────────────────────────────────────────────

function assertSupplierPrice(
  result: { prix_ht: number | null; stock: number | null; unite: string; fetchedAt: string },
  min: number,
  max: number,
  label: string
): void {
  expect(result.prix_ht, `${label}: prix_ht must not be null`).not.toBeNull();
  expect(result.prix_ht!, `${label}: prix_ht should be >= ${min}`).toBeGreaterThanOrEqual(min);
  expect(result.prix_ht!, `${label}: prix_ht should be <= ${max}`).toBeLessThanOrEqual(max);
  expect([0, 1, null], `${label}: stock must be 0, 1 or null`).toContain(result.stock);
  expect(result.unite, `${label}: unite should be "pièce"`).toBe('pièce');
  expect(
    new Date(result.fetchedAt).getFullYear(),
    `${label}: fetchedAt should be a valid recent ISO date`
  ).toBeGreaterThanOrEqual(2026);
}

// ── Rexel ─────────────────────────────────────────────────────────────────────

describe('[SMOKE] RexelAdapter — real network', () => {
  it.skipIf(!cfg.rexel)(
    `fetches a real price for SKU ${cfg.rexel?.sku ?? '?'} from Rexel API`,
    async () => {
      const { token, branchId, zipcode, city, sku, expectedPriceMin, expectedPriceMax } =
        cfg.rexel!;

      const adapter = new RexelAdapter({ token, branchId, zipcode, city });
      const result = await adapter.getPrice(sku);

      assertSupplierPrice(result, expectedPriceMin, expectedPriceMax, `Rexel SKU:${sku}`);

      console.log(
        `✅  Rexel  SKU:${sku}  →  ${result.prix_ht} € HT` +
          `  (stock: ${result.stock === 1 ? 'En stock' : 'Sur commande'})`
      );
    }
  );
});

// ── Bricodepot ────────────────────────────────────────────────────────────────

describe('[SMOKE] BricodepotAdapter — real network', () => {
  beforeAll(() => {
    if (!cfg.bricodepot) return;
    console.warn(
      '\n⚠  Bricodepot cookies expire after a few hours.\n' +
        '   If this test fails with RATE_LIMIT or AUTH_ERROR, refresh your cookies:\n' +
        '     1. Open prixElek in the browser and click the 🍪 button.\n' +
        '     2. Copy the new Cookie: header value into test-config.json → bricodepot.cookies.\n' +
        '   See README-SCRAPING.md §Bricodepot for step-by-step instructions.\n'
    );
  });

  it.skipIf(!cfg.bricodepot)(
    `fetches a real price for "${cfg.bricodepot?.pageSlug ?? '?'}" from Bricodepot`,
    async () => {
      const { cookies, pageSlug, expectedPriceMin, expectedPriceMax } = cfg.bricodepot!;

      const adapter = new BricodepotAdapter({
        cookies,
        delayBetweenRequestsMs: 0,
        requestTimeoutMs: 20_000,
      });
      const result = await adapter.getPrice(pageSlug);

      assertSupplierPrice(result, expectedPriceMin, expectedPriceMax, `Bricodepot:${pageSlug}`);

      console.log(
        `✅  Bricodepot  "${pageSlug}"` +
          `  →  ${result.prix_ht} € HT  /  ${result.prix_ttc ?? '?'} € TTC` +
          `  (stock: ${result.stock === 1 ? 'En stock' : 'Sur commande'})`
      );
    }
  );
});

// ── MaterielElectrique ────────────────────────────────────────────────────────

describe('[SMOKE] MaterielElectriqueAdapter — real network', () => {
  it.skipIf(!cfg.materielelectrique)(
    `fetches a real price for "${cfg.materielelectrique?.reference ?? '?'}" from materielelectrique.com`,
    async () => {
      const { pageSlug, reference, expectedPriceMin, expectedPriceMax } = cfg.materielelectrique!;

      const adapter = new MaterielElectriqueAdapter({
        delayBetweenRequestsMs: 1_000,
        requestTimeoutMs: 20_000,
      });
      const result = await adapter.getPrice(reference, pageSlug);

      assertSupplierPrice(
        result,
        expectedPriceMin,
        expectedPriceMax,
        `MaterielElectrique:${reference}`
      );

      console.log(
        `✅  MaterielElectrique  ${reference}  →  ${result.prix_ht} € HT` +
          `  /  ${result.prix_ttc ?? '?'} € TTC` +
          `  (stock: ${result.stock === 1 ? 'En stock' : 'Sur commande'})`
      );
    }
  );
});
