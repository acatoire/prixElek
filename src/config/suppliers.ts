/**
 * src/config/suppliers.ts
 *
 * Single source of truth for the supplier list shown in the UI.
 * Import this wherever SUPPLIERS is needed (PriceTable, CommandeTab, usePriceScan).
 */

export interface SupplierDef {
  id: string;
  label: string;
  color: string;
}

export const SUPPLIERS: SupplierDef[] = [
  { id: 'materielelectrique', label: 'Matériel Électrique', color: '#e65c00' },
  { id: 'rexel',              label: 'Rexel',               color: '#c8001e' },
];

