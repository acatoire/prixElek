/**
 * src/hooks/useCommande.ts
 *
 * Manages the order state:
 *  - selectedIds: Set of material ids checked in the Catalogue tab
 *  - quantities:  map of materialId → quantity (default 1)
 *  - import / export of the order as JSON
 */

import { useState, useCallback } from 'react';
import type { CommandeSnapshot } from '@/types/commande';

export interface UseCommandeReturn {
  selectedIds: Set<string>;
  quantities: Record<string, number>;
  /** Toggle a single material id in/out of the selection */
  toggleSelected: (id: string) => void;
  /** Select / deselect all at once */
  setAllSelected: (ids: string[], selected: boolean) => void;
  /** Update quantity for one item (min 1) */
  setQuantity: (id: string, qty: number) => void;
  /** Remove an item from the order entirely */
  removeItem: (id: string) => void;
  /** Download the current order as JSON */
  exportOrder: () => void;
  /** Load a previously exported order JSON (merges into current selection) */
  importOrder: (json: string) => void;
}

export function useCommande(): UseCommandeReturn {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [quantities, setQuantities] = useState<Record<string, number>>({});

  const toggleSelected = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
        // Ensure a default quantity
        setQuantities((q) => (q[id] !== undefined ? q : { ...q, [id]: 1 }));
      }
      return next;
    });
  }, []);

  const setAllSelected = useCallback((ids: string[], selected: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (selected) {
        ids.forEach((id) => next.add(id));
        setQuantities((q) => {
          const updated = { ...q };
          ids.forEach((id) => { if (updated[id] === undefined) updated[id] = 1; });
          return updated;
        });
      } else {
        ids.forEach((id) => next.delete(id));
      }
      return next;
    });
  }, []);

  const setQuantity = useCallback((id: string, qty: number) => {
    setQuantities((prev) => ({ ...prev, [id]: Math.max(1, qty) }));
  }, []);

  const removeItem = useCallback((id: string) => {
    setSelectedIds((prev) => { const n = new Set(prev); n.delete(id); return n; });
    setQuantities((prev) => { const n = { ...prev }; delete n[id]; return n; });
  }, []);

  const exportOrder = useCallback(() => {
    const snapshot: CommandeSnapshot = {
      exportedAt: new Date().toISOString(),
      lines: [...selectedIds].map((id) => ({ materialId: id, quantity: quantities[id] ?? 1 })),
    };
    const json = JSON.stringify(snapshot, null, 2) + '\n';
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `commande-prixelek-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [selectedIds, quantities]);

  const importOrder = useCallback((json: string) => {
    const snapshot = JSON.parse(json) as CommandeSnapshot;
    if (!Array.isArray(snapshot.lines)) throw new Error('Format de commande invalide.');
    setSelectedIds(new Set(snapshot.lines.map((l) => l.materialId)));
    setQuantities(
      Object.fromEntries(snapshot.lines.map((l) => [l.materialId, Math.max(1, l.quantity)]))
    );
  }, []);

  return { selectedIds, quantities, toggleSelected, setAllSelected, setQuantity, removeItem, exportOrder, importOrder };
}

