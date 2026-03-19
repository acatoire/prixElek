/**
 * src/types/material.ts
 *
 * TypeScript types for the material catalog.
 * Mirrors the structure of catalogue/catalogue.*.json.
 */

/** Key = supplierId (e.g. 'rexel'), value = supplier reference or null if unlisted */
export type SupplierReferences = Record<string, string | null>;

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
}

export type Catalog = Material[];

