/**
 * src/types/commande.ts
 *
 * Types for the order (commande) feature.
 */

/** One line in an order: material id + quantity */
export interface CommandeLine {
  materialId: string;
  quantity: number;
}

/** Serialisable order snapshot — used for import/export */
export interface CommandeSnapshot {
  /** ISO date of export */
  exportedAt: string;
  lines: CommandeLine[];
}

