/**
 * src/App.tsx
 */
import React, { useCallback, useState } from 'react';
import { usePriceScan } from '@/hooks/usePriceScan';
import { useCatalogue } from '@/hooks/useCatalogue';
import { useCommande } from '@/hooks/useCommande';
import { useRexelAuth } from '@/hooks/useRexelAuth';
import { useBricodepotAuth } from '@/hooks/useBricodepotAuth';
import { useExportReminder } from '@/hooks/useExportReminder';
import { PriceTable } from '@/components/PriceTable';
import { CatalogueToolbar } from '@/components/CatalogueToolbar';
import { CommandeTab } from '@/components/CommandeTab';
import { EditMaterialModal } from '@/components/EditMaterialModal';
import { AddFromUrlModal } from '@/components/AddFromUrlModal';
import { RexelLoginModal } from '@/components/RexelLoginModal';
import { BricodepotLoginModal } from '@/components/BricodepotLoginModal';
import type { Material, Catalog } from '@/types/material';

type Tab = 'catalogue' | 'commande';

export function App(): React.ReactElement {
  const {
    materials,
    lastModifiedAt,
    lastExportedAt,
    catalogueFiles,
    fileCategories,
    importCatalogue,
    addMaterial,
    updateMaterial,
    removeMaterial,
    exportCatalogue,
  } = useCatalogue();
  const { prices, scanning, startScan, stopScan } = usePriceScan();
  const rexelAuth = useRexelAuth();
  const bricodepotAuth = useBricodepotAuth();
  const commande = useCommande();
  const { selectedIds, toggleSelected, setAllSelected } = commande;
  const { showReminder, dismissReminder } = useExportReminder(lastModifiedAt, lastExportedAt);

  // Tabs
  const [activeTab, setActiveTab] = useState<Tab>('catalogue');

  // Collapsed categories — lifted here so state survives tab switches.
  // Lazy initialiser runs once on mount and collapses all categories that exist at that point.
  // Categories added later (via Add-from-URL) will appear expanded.
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(
    () => new Set(materials.map((m) => m.categorie || 'Autre'))
  );

  const toggleCategory = useCallback((categorie: string) => {
    setCollapsedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(categorie)) next.delete(categorie);
      else next.add(categorie);
      return next;
    });
  }, []);

  const toggleAllCategories = useCallback((categoryKeys: string[], collapseAll: boolean) => {
    setCollapsedCategories(collapseAll ? new Set(categoryKeys) : new Set());
  }, []);

  const handleScan = useCallback(
    () =>
      startScan(
        materials,
        rexelAuth.isConnected
          ? {
              token: rexelAuth.token,
              branchId: rexelAuth.branchId,
              zipcode: rexelAuth.zipcode,
              city: rexelAuth.city,
            }
          : undefined,
        selectedIds.size > 0 ? selectedIds : undefined,
        bricodepotAuth.cookies || undefined
      ),
    [startScan, materials, rexelAuth, selectedIds, bricodepotAuth.cookies]
  );

  // Edit modal
  const [editingMaterial, setEditingMaterial] = useState<Material | null>(null);

  // Add-from-URL modal
  const [showAddModal, setShowAddModal] = useState(false);

  // Rexel login modal
  const [showRexelModal, setShowRexelModal] = useState(false);
  // Bricodepot session modal
  const [showBricodepotModal, setShowBricodepotModal] = useState(false);

  const toolbar = (
    <CatalogueToolbar
      onImport={(items: Catalog) => importCatalogue(items)}
      onExport={exportCatalogue}
      onAddFromUrl={() => setShowAddModal(true)}
    />
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ── Header — pale green in dev to distinguish from production ── */}
      <header
        className={`${import.meta.env.DEV ? 'bg-green-50 border-green-200' : 'bg-white border-gray-200'} border-b px-6 py-4`}
      >
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">⚡</span>
            <div>
              <h1 className="text-xl font-semibold text-gray-900">prixElek</h1>
              <p
                className={`text-sm ${import.meta.env.DEV ? 'text-green-700 font-medium' : 'text-gray-500'}`}
              >
                {import.meta.env.DEV ? '⚠ DEV — localhost' : 'Comparateur de prix fournisseurs'}
              </p>
            </div>
          </div>

          {/* Supplier connection status */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowRexelModal(true)}
              className={[
                'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors',
                rexelAuth.isConnected
                  ? 'bg-green-50 border-green-200 text-green-700 hover:bg-green-100'
                  : 'bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100',
              ].join(' ')}
            >
              {rexelAuth.isConnected ? '🟢' : '🔴'}
              Rexel
            </button>
            <button
              onClick={() => setShowBricodepotModal(true)}
              className={[
                'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors',
                bricodepotAuth.isConnected
                  ? 'bg-green-50 border-green-200 text-green-700 hover:bg-green-100'
                  : 'bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100',
              ].join(' ')}
            >
              {bricodepotAuth.isConnected ? '🟢' : '🔴'}
              Brico Dépôt
            </button>
          </div>
        </div>
      </header>

      {/* ── Tabs ── */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6">
          <nav className="flex gap-1 -mb-px" aria-label="Onglets">
            <button
              onClick={() => setActiveTab('catalogue')}
              className={[
                'px-5 py-3 text-sm font-medium border-b-2 transition-colors',
                activeTab === 'catalogue'
                  ? 'border-orange-500 text-orange-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300',
              ].join(' ')}
            >
              📋 Catalogue
            </button>
            <button
              onClick={() => setActiveTab('commande')}
              className={[
                'px-5 py-3 text-sm font-medium border-b-2 transition-colors inline-flex items-center gap-2',
                activeTab === 'commande'
                  ? 'border-orange-500 text-orange-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300',
              ].join(' ')}
            >
              🛒 Commande
              {selectedIds.size > 0 && (
                <span className="inline-flex items-center justify-center w-5 h-5 rounded-full text-xs font-bold bg-orange-500 text-white">
                  {selectedIds.size}
                </span>
              )}
            </button>
          </nav>
        </div>
      </div>

      {/* ── Export reminder toast ── */}
      {showReminder && (
        <div className="bg-amber-50 border-b border-amber-200 px-6 py-2.5">
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
            <span className="text-sm text-amber-800">
              💾 Le catalogue a été modifié — pensez à l'exporter pour ne pas perdre vos
              changements.
            </span>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={exportCatalogue}
                className="px-3 py-1 text-xs font-medium bg-amber-500 hover:bg-amber-600
                  text-white rounded-lg transition-colors"
              >
                Exporter maintenant
              </button>
              <button
                onClick={dismissReminder}
                className="px-3 py-1 text-xs text-amber-700 hover:bg-amber-100 rounded-lg transition-colors"
              >
                Plus tard
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Main content ── */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {activeTab === 'catalogue' && (
          <PriceTable
            materials={materials}
            prices={prices}
            scanning={scanning}
            onScan={handleScan}
            onStop={stopScan}
            onEdit={(m) => setEditingMaterial(m)}
            toolbar={toolbar}
            selectedIds={selectedIds}
            onToggleSelect={toggleSelected}
            onToggleSelectAll={setAllSelected}
            collapsedCategories={collapsedCategories}
            onToggleCategory={toggleCategory}
            onToggleAllCategories={toggleAllCategories}
          />
        )}
        {activeTab === 'commande' && (
          <CommandeTab
            materials={materials}
            prices={prices}
            commande={commande}
            scanning={scanning}
            onScan={handleScan}
            onStop={stopScan}
          />
        )}
      </main>

      {/* ── Modals ── */}
      {editingMaterial && (
        <EditMaterialModal
          material={editingMaterial}
          onSave={updateMaterial}
          onDelete={removeMaterial}
          onClose={() => setEditingMaterial(null)}
        />
      )}
      {showAddModal && (
        <AddFromUrlModal
          catalogueFiles={catalogueFiles}
          fileCategories={fileCategories}
          onAdd={addMaterial}
          onClose={() => setShowAddModal(false)}
        />
      )}
      {showBricodepotModal && (
        <BricodepotLoginModal
          currentCookies={bricodepotAuth.cookies}
          onSave={bricodepotAuth.saveCookies}
          onClear={bricodepotAuth.clearCookies}
          onClose={() => setShowBricodepotModal(false)}
        />
      )}
      {showRexelModal && (
        <RexelLoginModal
          currentToken={rexelAuth.token}
          currentBranchId={rexelAuth.branchId}
          currentZipcode={rexelAuth.zipcode}
          currentCity={rexelAuth.city}
          onSave={rexelAuth.saveCredentials}
          onClear={rexelAuth.clearToken}
          onClose={() => setShowRexelModal(false)}
        />
      )}
    </div>
  );
}
