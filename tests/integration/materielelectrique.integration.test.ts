/**
 * tests/integration/materielelectrique.integration.test.ts
 *
 * Integration test — makes ONE real HTTP request to materielelectrique.com.
 * Uses the first item from the real catalogue so the reference is always valid.
 *
 * ⚠  DO NOT run this in the unit-test suite.
 *    Run with:  npm run test:integration
 *    Or via the dedicated GitHub Action: .github/workflows/integration.yml
 *
 * What is validated:
 *   - The adapter can reach materielelectrique.com
 *   - The JSON-LD parsing returns a real price (number > 0)
 *   - The availability field is mapped to a known value
 *   - The fetchedAt timestamp is a valid ISO string
 */

import { describe, it, expect } from 'vitest';
import { MaterielElectriqueAdapter } from '../../src/adapters/materielelectrique';

// Reference taken from catalogue/catalogue.prises.legrand.json
// Légrand Céliane 4x2P+T — a stable, long-lived product
const KNOWN_REFERENCE = 'LEG067128';

describe('[INTEGRATION] MaterielElectriqueAdapter — real network', () => {
  it('fetches a real price for LEG067128 from materielelectrique.com', async () => {
    // Use a short delay for integration test (still polite but not 3s)
    const adapter = new MaterielElectriqueAdapter({
      delayBetweenRequestsMs: 1_000,
      requestTimeoutMs: 20_000,
    });

    const result = await adapter.getPrice(KNOWN_REFERENCE);

    // Price must be a positive number
    expect(typeof result.prix_ht).toBe('number');
    expect(result.prix_ht).toBeGreaterThan(0);

    // Stock is a number (0 = out of stock, 1 = in stock)
    expect(typeof result.stock).toBe('number');
    expect([0, 1]).toContain(result.stock);

    // Unit label
    expect(result.unite).toBe('pièce');

    // Timestamp is valid ISO
    expect(() => new Date(result.fetchedAt)).not.toThrow();
    expect(new Date(result.fetchedAt).getFullYear()).toBeGreaterThanOrEqual(2026);

    console.log(`✅  LEG067128 → ${result.prix_ht} € (stock: ${result.stock === 1 ? 'En stock' : 'Sur commande'})`);
  });
});

