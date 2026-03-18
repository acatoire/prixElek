/**
 * src/hooks/usePriceScan.ts
 *
 * React hook that manages the price scan lifecycle:
 *   idle → loading (per row) → success | error
 *
 * Calls the MaterielElectriqueAdapter for each material sequentially
 * (respecting the configured delay to avoid being banned).
 */

import { useState, useCallback } from 'react';
import { MaterielElectriqueAdapter } from '@/adapters/materielelectrique';
import type { Material } from '@/types/material';
import type { PriceCell, PriceMatrix } from '@/types/price';

const SUPPLIER_ID = 'materielelectrique';

/** Build an initial idle PriceMatrix for a list of materials */
export function buildIdleMatrix(materials: Material[]): PriceMatrix {
  const matrix: PriceMatrix = {};
  for (const m of materials) {
    matrix[m.id] = {
      [SUPPLIER_ID]: { status: 'idle', data: null, errorMessage: null },
    };
  }
  return matrix;
}

interface UsePriceScanReturn {
  prices: PriceMatrix;
  scanning: boolean;
  startScan: (materials: Material[]) => Promise<void>;
}

export function usePriceScan(): UsePriceScanReturn {
  const [prices, setPrices] = useState<PriceMatrix>({});
  const [scanning, setScanning] = useState(false);

  const setCell = useCallback((materialId: string, cell: PriceCell) => {
    setPrices((prev) => ({
      ...prev,
      [materialId]: {
        ...prev[materialId],
        [SUPPLIER_ID]: cell,
      },
    }));
  }, []);

  const startScan = useCallback(
    async (materials: Material[]) => {
      if (scanning) return;
      setScanning(true);

      // Reset all to loading
      const initial = buildIdleMatrix(materials);
      for (const m of materials) {
        initial[m.id][SUPPLIER_ID] = { status: 'loading', data: null, errorMessage: null };
      }
      setPrices(initial);

      // Use delay=0 is wrong in production — read from window.__SCRAPING_CONFIG if available,
      // otherwise fall back to the safe 3s default baked into the adapter default.
      const adapter = new MaterielElectriqueAdapter();

      for (const material of materials) {
        const ref = material.references_fournisseurs[SUPPLIER_ID];
        if (!ref) {
          setCell(material.id, {
            status: 'error',
            data: null,
            errorMessage: 'Référence non renseignée',
          });
          continue;
        }

        try {
          const price = await adapter.getPrice(ref);
          setCell(material.id, { status: 'success', data: price, errorMessage: null });
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          setCell(material.id, { status: 'error', data: null, errorMessage: msg });
        }
      }

      setScanning(false);
    },
    [scanning, setCell]
  );

  return { prices, scanning, startScan };
}

