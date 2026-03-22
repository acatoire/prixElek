/**
 * src/services/CableCalculator.ts
 *
 * Pure functions for cable pricing when the product is sold by the linear metre
 * but in fixed packaging lots (reels / coils) or sur-mesure (exact length).
 *
 * Vocabulary
 * ----------
 * neededMetres   : what the user typed, e.g. 37 m
 * lotMetres      : reel size for this supplier, e.g. 25 m  (null = sur-mesure)
 * unitPrice      : price returned by the adapter (prix_ht)
 * prixBase       : 'metre' → unitPrice is per metre; 'lot' → unitPrice is per whole reel
 *
 * Results
 * -------
 * lotsNeeded     : number of reels to buy (Math.ceil)  — 1 for sur-mesure
 * metresBought   : lotsNeeded × lotMetres (= neededMetres for sur-mesure)
 * totalPrice     : what you actually pay
 * pricePerMetre  : totalPrice / metresBought  (for cross-supplier comparison)
 */

import type { CableSupplierPackaging } from '@/types/material';

export interface CableCalcInput {
  neededMetres: number;
  packaging: CableSupplierPackaging;
  /** Prix HT returned by the supplier adapter (null = unknown) */
  unitPrice: number | null;
}

export interface CableCalcResult {
  /** Number of reels/lots to purchase. Always 1 for sur-mesure suppliers. */
  lotsNeeded: number;
  /** Total metres that will be delivered (≥ neededMetres) */
  metresBought: number;
  /** Total price HT to pay. null when unitPrice is null. */
  totalPrice: number | null;
  /** Effective price per metre (totalPrice / metresBought). null when totalPrice is null. */
  pricePerMetre: number | null;
  /** True when the supplier sells in exact metres */
  surMesure: boolean;
}

/**
 * Compute the purchase details for a cable material at a given supplier.
 */
export function calcCablePurchase(input: CableCalcInput): CableCalcResult {
  const { neededMetres, packaging, unitPrice } = input;
  const { lot_metres, prix_base } = packaging;

  const surMesure = lot_metres === null;

  const lotsNeeded = surMesure ? 1 : Math.ceil(neededMetres / lot_metres!);
  const metresBought = surMesure ? neededMetres : lotsNeeded * lot_metres!;

  let totalPrice: number | null = null;
  if (unitPrice !== null) {
    if (surMesure) {
      // sur-mesure: always priced per metre
      totalPrice = unitPrice * neededMetres;
    } else if (prix_base === 'metre') {
      // priced per metre → multiply by actual lot size
      totalPrice = unitPrice * lot_metres! * lotsNeeded;
    } else {
      // priced per lot (reel)
      totalPrice = unitPrice * lotsNeeded;
    }
  }

  const pricePerMetre =
    totalPrice !== null && metresBought > 0
      ? Math.round((totalPrice / metresBought) * 10000) / 10000
      : null;

  return { lotsNeeded, metresBought, totalPrice, pricePerMetre, surMesure };
}

/**
 * Given results across all suppliers, find the minimum totalPrice and
 * annotate each entry with isBest / diffFromBest (euros).
 */
export interface CableSupplierResult extends CableCalcResult {
  supplierId: string;
  isBest: boolean;
  diffFromBest: number | undefined;
}

export function compareCableSuppliers(
  results: Array<{ supplierId: string } & CableCalcResult>
): CableSupplierResult[] {
  const prices = results.map((r) => r.totalPrice).filter((p): p is number => p !== null);

  if (prices.length < 2) {
    return results.map((r) => ({ ...r, isBest: false, diffFromBest: undefined }));
  }

  const best = Math.min(...prices);
  return results.map((r) => {
    if (r.totalPrice === null) return { ...r, isBest: false, diffFromBest: undefined };
    const isBest = r.totalPrice === best;
    return {
      ...r,
      isBest,
      diffFromBest: isBest ? undefined : Math.round((r.totalPrice - best) * 100) / 100,
    };
  });
}
