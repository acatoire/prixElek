/**
 * src/App.tsx
 */
import React, { useCallback, useState } from 'react';
import { usePriceScan } from '@/hooks/usePriceScan';
import { useCatalogue } from '@/hooks/useCatalogue';
import { PriceTable } from '@/components/PriceTable';
import { CatalogueToolbar } from '@/components/CatalogueToolbar';
import { EditMaterialModal } from '@/components/EditMaterialModal';
import { AddFromUrlModal } from '@/components/AddFromUrlModal';
import type { Material, Catalog } from '@/types/material';

export function App(): React.ReactElement {
  const {
    materials,
    importCatalogue,
    addMaterial,
    updateMaterial,
    removeMaterial,
    exportCatalogue,
  } = useCatalogue();

  const { prices, scanning, startScan, stopScan } = usePriceScan();
  const handleScan = useCallback(() => startScan(materials), [startScan, materials]);

  // Edit modal
  const [editingMaterial, setEditingMaterial] = useState<Material | null>(null);
  const handleEdit = useCallback((m: Material) => setEditingMaterial(m), []);
  const handleEditClose = useCallback(() => setEditingMaterial(null), []);

  // Add-from-URL modal
  const [showAddModal, setShowAddModal] = useState(false);

  const toolbar = (
    <CatalogueToolbar
      onImport={(items: Catalog) => importCatalogue(items)}
      onExport={exportCatalogue}
      onAddFromUrl={() => setShowAddModal(true)}
    />
  );

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
          onEdit={handleEdit}
          toolbar={toolbar}
        />
      </main>

      {/* ── Edit modal ── */}
      {editingMaterial && (
        <EditMaterialModal
          material={editingMaterial}
          onSave={updateMaterial}
          onDelete={removeMaterial}
          onClose={handleEditClose}
        />
      )}

      {/* ── Add from URL modal ── */}
      {showAddModal && (
        <AddFromUrlModal
          onAdd={addMaterial}
          onClose={() => setShowAddModal(false)}
        />
      )}
    </div>
  );
}
