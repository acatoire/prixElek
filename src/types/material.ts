/**
 * src/types/material.ts
 *
 * TypeScript types for the material catalog.
 * Mirrors the structure of catalogue/catalogue.*.json.
 */

/** Key = supplierId (e.g. 'rexel'), value = supplier reference or null if unlisted */
export type SupplierReferences = Record<string, string | null>;

/**
 * Packaging config for one supplier for a cable sold by the linear metre.
 *
 * - `lot_metres`: fixed reel/coil size in metres (e.g. 25 → sold in 25 m reels).
 *   null means the supplier sells to the exact metre (sur mesure).
 * - `prix_base`: 'metre' → the supplier price is per metre (adapt multiplies by lot_metres
 *   to get the per-reel cost). 'lot' → the supplier price already represents the whole reel.
 */
export interface CableSupplierPackaging {
  /** Fixed reel size in metres, or null for sur-mesure (exact length) */
  lot_metres: number | null;
  /** Whether the API unit price is per metre or per lot */
  prix_base: 'metre' | 'lot';
}

/**
 * Special configuration for cables sold by the linear metre.
 * Present only on materials with categorie === 'cables'.
 */
export interface CableConfig {
  /** Unit of measure — always 'ml' for linear metres */
  unite_base: 'ml';
  /** Per-supplier packaging configuration */
  packaging: Record<string, CableSupplierPackaging>;
}

export interface Material {
  /** Unique internal slug, e.g. 'prise-2p-t-legrand' */
  id: string;
  /** Human-readable name, e.g. 'Prise 2P+T' */
  nom: string;
  /** Brand name, e.g. 'Legrand' */
  marque: string;
  /** Free-form category used for filtering, e.g. 'Appareillage' */
  categorie: string;
  /** Supplier-specific product references */
  references_fournisseurs: SupplierReferences;
  /** Present only for cables — describes linear-metre packaging per supplier */
  cable?: CableConfig;
}

export type Catalog = Material[];

/** Type guard — true when a material is a cable with linear-metre pricing */
export function isCableMaterial(m: Material): m is Material & { cable: CableConfig } {
  return m.cable?.unite_base === 'ml';
}
