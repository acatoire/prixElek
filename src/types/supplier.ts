/**
 * src/types/supplier.ts
 *
 * TypeScript types for supplier configuration.
 * Mirrors the structure of config/fournisseurs.json.
 */

export type AuthType = 'bearer' | 'api_key' | 'cookie';

export interface SupplierApi {
  type: 'rest';
  base_url: string;
  auth: AuthType;
  /** Runtime token — populated from localStorage, never stored in fournisseurs.json */
  token?: string;
}

export interface Supplier {
  /** Unique slug, e.g. 'rexel' */
  id: string;
  /** Display name, e.g. 'Rexel' */
  nom: string;
  /** Brand color used in the UI, hex format */
  couleur: string;
  api: SupplierApi;
}

export interface SupplierConfig {
  fournisseurs: Supplier[];
}
