/**
 * src/hooks/usePriceScan.ts
 *
 * Multi-supplier price scan hook.
 *
 * Only fetches prices for materials that are selected in the order (selectedIds).
 * Skips cells that already have a fresh price (< 24 h old) — they stay as-is.
 * Both adapters run concurrently per material (Promise.all), then the hook
 * moves to the next material.
 */

import { useState, useCallback, useRef } from 'react';
import { MaterielElectriqueAdapter } from '@/adapters/materielelectrique';
import { RexelAdapter, type RexelCredentials } from '@/adapters/rexel';
import { BricodepotAdapter } from '@/adapters/bricodepot';
import { SUPPLIERS } from '@/config/suppliers';
import type { Material } from '@/types/material';
import type { PriceCell, PriceMatrix } from '@/types/price';

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Returns true when the cell has a fresh price fetched less than 24 h ago.
 * A materielelectrique cell where tiers===undefined was fetched before the
 * tiered-pricing feature existed — treat it as stale so it gets re-fetched
 * and the discount schedule is picked up.
 */
function isFresh(cell: PriceCell | undefined, supplierId?: string): boolean {
  if (cell?.status !== 'success' || !cell.data?.fetchedAt) return false;
  if (supplierId === 'materielelectrique' && cell.data.tiers === undefined) return false;
  return Date.now() - new Date(cell.data.fetchedAt).getTime() < CACHE_TTL_MS;
}

/** Build an initial idle PriceMatrix for a list of materials */
export function buildIdleMatrix(materials: Material[]): PriceMatrix {
  const matrix: PriceMatrix = {};
  for (const m of materials) {
    matrix[m.id] = {};
    for (const s of SUPPLIERS) {
      matrix[m.id][s.id] = { status: 'idle', data: null, errorMessage: null };
    }
  }
  return matrix;
}

interface UsePriceScanReturn {
  prices: PriceMatrix;
  scanning: boolean;
  /**
   * @param materials         Full catalogue
   * @param rexelCreds        Optional Rexel credentials
   * @param selectedIds       Only fetch these material ids; omit to scan all
   * @param bricodepotCookies Cookie: header value for Bricodepot session
   */
  startScan: (
    materials: Material[],
    rexelCreds?: RexelCredentials,
    selectedIds?: Set<string>,
    bricodepotCookies?: string
  ) => Promise<void>;
  stopScan: () => void;
}

export function usePriceScan(): UsePriceScanReturn {
  const [prices, setPrices] = useState<PriceMatrix>({});
  const [scanning, setScanning] = useState(false);
  const abortRef = useRef(false);
  // Always holds the latest prices so callbacks can read without stale closure
  const pricesRef = useRef<PriceMatrix>({});

  const setCell = useCallback((materialId: string, supplierId: string, cell: PriceCell) => {
    setPrices((prev) => {
      const next = { ...prev, [materialId]: { ...prev[materialId], [supplierId]: cell } };
      pricesRef.current = next;
      return next;
    });
  }, []);

  const stopScan = useCallback(() => {
    abortRef.current = true;
  }, []);

  const startScan = useCallback(
    async (
      materials: Material[],
      rexelCreds?: RexelCredentials,
      selectedIds?: Set<string>,
      bricodepotCookies?: string
    ) => {
      if (scanning) return;
      abortRef.current = false;
      setScanning(true);

      // Only scan selected items; if nothing selected, scan all
      const targets =
        selectedIds && selectedIds.size > 0
          ? materials.filter((m) => selectedIds.has(m.id))
          : materials;

      // Snapshot prices at scan-start to evaluate freshness
      const snapshot = pricesRef.current;

      // Mark stale cells as loading; leave fresh cells untouched
      setPrices((prev) => {
        const next = { ...prev };
        for (const m of targets) {
          next[m.id] = { ...next[m.id] };
          for (const s of SUPPLIERS) {
            if (!isFresh(snapshot[m.id]?.[s.id], s.id)) {
              next[m.id][s.id] = { status: 'loading', data: null, errorMessage: null };
            }
          }
        }
        pricesRef.current = next;
        return next;
      });

      const meAdapter = new MaterielElectriqueAdapter();
      const rexelAdapter = rexelCreds ? new RexelAdapter(rexelCreds) : null;
      const bricodepotAdapter = new BricodepotAdapter({ cookies: bricodepotCookies });

      for (const material of targets) {
        if (abortRef.current) {
          // Cancel remaining loading cells back to idle
          setPrices((prev) => {
            const next = { ...prev };
            for (const m of targets) {
              for (const s of SUPPLIERS) {
                if (next[m.id]?.[s.id]?.status === 'loading') {
                  next[m.id] = {
                    ...next[m.id],
                    [s.id]: { status: 'idle', data: null, errorMessage: null },
                  };
                }
              }
            }
            pricesRef.current = next;
            return next;
          });
          break;
        }

        // Run all suppliers concurrently for this material
        const tasks = SUPPLIERS.map(async (s) => {
          // Use the pre-scan snapshot to decide freshness — avoids races
          if (isFresh(snapshot[material.id]?.[s.id], s.id)) return;

          const ref = material.references_fournisseurs[s.id];
          if (!ref) {
            setCell(material.id, s.id, {
              status: 'error',
              data: null,
              errorMessage: 'Référence non renseignée',
            });
            return;
          }

          try {
            let price;

            if (s.id === 'materielelectrique') {
              price = await meAdapter.getPrice(material.id, ref);
            } else if (s.id === 'rexel') {
              if (!rexelAdapter) {
                setCell(material.id, s.id, {
                  status: 'error',
                  data: null,
                  errorMessage: 'Non connecté à Rexel',
                });
                return;
              }
              price = await rexelAdapter.getPrice(ref);
            } else if (s.id === 'bricodepot') {
              price = await bricodepotAdapter.getPrice(ref);
            } else {
              return;
            }

            setCell(material.id, s.id, { status: 'success', data: price, errorMessage: null });
          } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            setCell(material.id, s.id, { status: 'error', data: null, errorMessage: msg });
          }
        });

        await Promise.all(tasks);
      }

      setScanning(false);
    },
    [scanning, setCell]
  );

  return { prices, scanning, startScan, stopScan };
}
