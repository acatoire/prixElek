/**
 * src/App.tsx
 *
 * Root application component — Phase 1: catalogue + price scan.
 */
import React, { useMemo, useCallback } from 'react';
import { loadAllMaterials } from '@/services/CatalogService';
import { usePriceScan } from '@/hooks/usePriceScan';
import { PriceTable } from '@/components/PriceTable';

export function App(): React.ReactElement {
  const materials = useMemo(() => loadAllMaterials(), []);
  const { prices, scanning, startScan, stopScan } = usePriceScan();
  const handleScan = useCallback(() => startScan(materials), [startScan, materials]);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ── Header ── */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center gap-3">
          <span className="text-2xl">⚡</span>
          <div>
            <h1 className="text-xl font-semibold text-gray-900">prixElek</h1>
            <p className="text-sm text-gray-500">Comparateur de prix fournisseurs</p>
          </div>
        </div>
      </header>

      {/* ── Main content ── */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        <PriceTable
          materials={materials}
          prices={prices}
          scanning={scanning}
          onScan={handleScan}
          onStop={stopScan}
        />
      </main>
    </div>
  );
}
