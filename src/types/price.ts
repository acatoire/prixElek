/**
 * src/types/price.ts
 *
 * TypeScript types for price data returned by adapters and stored in state.
 */

/** Raw price returned by a single supplier adapter */
export interface SupplierPrice {
  /** Price excluding tax (HT), in euros */
  prix_ht: number | null;
  /**
   * Raw price as published by the supplier, before any VAT conversion.
   * Set only when the supplier publishes TTC prices (e.g. materielelectrique.com).
   * Undefined for suppliers that already publish HT prices (e.g. Rexel).
   */
  prix_ttc?: number;
  /** Available stock quantity, null if not provided by the supplier */
  stock: number | null;
  /** Sales unit label, e.g. 'pièce', 'lot de 10' */
  unite: string;
  /** ISO timestamp of when the price was fetched */
  fetchedAt: string;
}

/** Loading state for one supplier column on one material row */
export type PriceFetchStatus = 'idle' | 'loading' | 'success' | 'error';

export interface PriceCell {
  status: PriceFetchStatus;
  data: SupplierPrice | null;
  /** Error message shown in the cell when status === 'error' */
  errorMessage: string | null;
}

/**
 * Full price matrix: one entry per material.
 * Key = materialId, Value = map of supplierId → PriceCell
 */
export type PriceMatrix = Record<string, Record<string, PriceCell>>;

