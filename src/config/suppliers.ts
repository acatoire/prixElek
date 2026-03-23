/**
 * src/config/suppliers.ts
 *
 * Single source of truth for supplier definitions and VAT rates.
 * Import this wherever SUPPLIERS is needed.
 */

export interface SupplierDef {
  id: string;
  label: string;
  color: string;
  /** Standard French VAT rate for this supplier (e.g. 0.2 = 20 %) */
  vatRate: number;
}

export const SUPPLIERS: SupplierDef[] = [
  { id: 'materielelectrique', label: 'Matériel Électrique', color: '#e65c00', vatRate: 0.2 },
  { id: 'rexel', label: 'Rexel', color: '#c8001e', vatRate: 0.2 },
  { id: 'bricodepot', label: 'Brico Dépôt', color: '#007dc5', vatRate: 0.2 },
];
