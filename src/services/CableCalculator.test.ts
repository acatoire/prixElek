/**
 * src/services/CableCalculator.test.ts
 */

import { describe, it, expect } from 'vitest';
import { calcCablePurchase, compareCableSuppliers } from './CableCalculator';
import type { CableCalcResult } from './CableCalculator';

// ── calcCablePurchase ─────────────────────────────────────────────────────────

describe('calcCablePurchase', () => {
  // Supplier A: 25 m reels, priced per metre (e.g. 1.02 €/m)
  const packA = { lot_metres: 25, prix_base: 'metre' as const };
  // Supplier B: 50 m reels, priced per reel (e.g. 48.00 €/reel)
  const packB = { lot_metres: 50, prix_base: 'lot' as const };
  // Supplier C: sur-mesure (exact metres), priced per metre
  const packC = { lot_metres: null, prix_base: 'metre' as const };

  it('rounds up to the next reel (25 m lot, prix/metre)', () => {
    const r = calcCablePurchase({ neededMetres: 37, packaging: packA, unitPrice: 1.02 });
    expect(r.surMesure).toBe(false);
    expect(r.lotsNeeded).toBe(2);           // ceil(37/25) = 2
    expect(r.metresBought).toBe(50);         // 2 × 25
    expect(r.totalPrice).toBeCloseTo(51.0);  // 1.02 × 25 × 2
    expect(r.pricePerMetre).toBeCloseTo(1.02);
  });

  it('exact multiple — no waste', () => {
    const r = calcCablePurchase({ neededMetres: 50, packaging: packA, unitPrice: 1.02 });
    expect(r.lotsNeeded).toBe(2);
    expect(r.metresBought).toBe(50);
  });

  it('50 m reel, priced per lot', () => {
    const r = calcCablePurchase({ neededMetres: 37, packaging: packB, unitPrice: 48.0 });
    expect(r.lotsNeeded).toBe(1);           // ceil(37/50) = 1
    expect(r.metresBought).toBe(50);
    expect(r.totalPrice).toBeCloseTo(48.0); // 1 reel × 48 €
    expect(r.pricePerMetre).toBeCloseTo(48 / 50);
  });

  it('sur-mesure — exact metres, no rounding', () => {
    const r = calcCablePurchase({ neededMetres: 37, packaging: packC, unitPrice: 1.10 });
    expect(r.surMesure).toBe(true);
    expect(r.lotsNeeded).toBe(1);
    expect(r.metresBought).toBe(37);
    expect(r.totalPrice).toBeCloseTo(37 * 1.10);
    expect(r.pricePerMetre).toBeCloseTo(1.10);
  });

  it('returns null prices when unitPrice is null', () => {
    const r = calcCablePurchase({ neededMetres: 37, packaging: packA, unitPrice: null });
    expect(r.totalPrice).toBeNull();
    expect(r.pricePerMetre).toBeNull();
  });

  it('1 m needed, 25 m lot → 1 reel', () => {
    const r = calcCablePurchase({ neededMetres: 1, packaging: packA, unitPrice: 1.0 });
    expect(r.lotsNeeded).toBe(1);
    expect(r.metresBought).toBe(25);
  });
});

// ── compareCableSuppliers ─────────────────────────────────────────────────────

describe('compareCableSuppliers', () => {
  const base = (supplierId: string, totalPrice: number | null): { supplierId: string } & CableCalcResult => ({
    supplierId,
    lotsNeeded: 1,
    metresBought: 50,
    totalPrice,
    pricePerMetre: totalPrice !== null ? totalPrice / 50 : null,
    surMesure: false,
  });

  it('marks the cheapest supplier as best', () => {
    const results = compareCableSuppliers([base('A', 51.0), base('B', 48.0), base('C', 40.7)]);
    const c = results.find((r) => r.supplierId === 'C')!;
    const a = results.find((r) => r.supplierId === 'A')!;
    expect(c.isBest).toBe(true);
    expect(c.diffFromBest).toBeUndefined();
    expect(a.isBest).toBe(false);
    expect(a.diffFromBest).toBeCloseTo(51.0 - 40.7);
  });

  it('no comparison when fewer than 2 prices', () => {
    const results = compareCableSuppliers([base('A', 51.0), base('B', null)]);
    expect(results.every((r) => !r.isBest)).toBe(true);
  });

  it('handles all null prices gracefully', () => {
    const results = compareCableSuppliers([base('A', null), base('B', null)]);
    expect(results.every((r) => r.totalPrice === null)).toBe(true);
  });
});

