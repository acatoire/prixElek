/**
 * src/components/PriceTable.tsx
 *
 * Main catalogue comparison table.
 * Shows one row per material, one column per configured supplier.
 * Prices start empty (idle) and fill in after the scan is launched.
 */
import React, { useState, useMemo } from 'react';
import type { Material } from '@/types/material';
import { isCableMaterial } from '@/types/material';
import type { PriceMatrix } from '@/types/price';
import { PriceCellDisplay } from './PriceCellDisplay';
import { SUPPLIERS } from '@/config/suppliers';
import { calcCablePurchase } from '@/services/CableCalculator';

/**
 * For a given material row, returns a map of supplierId → { isBest, diffFromBest }.
 * For cable materials, comparison is based on the 1-reel lot price (not raw unit price).
 * Only considers suppliers with a successful price. Returns an empty map when
 * fewer than 2 prices are available (no comparison possible).
 */
function computeRowComparison(
  material: Material,
  prices: PriceMatrix
): Map<string, { isBest: boolean; diffFromBest: number | undefined }> {
  const result = new Map<string, { isBest: boolean; diffFromBest: number | undefined }>();
  const available = SUPPLIERS
    .map((s) => {
      const rawPrice = prices[material.id]?.[s.id]?.data?.prix_ht ?? null;
      if (rawPrice === null) return null;
      // For cables: compare 1-reel lot price so €/lot is apples-to-apples
      let comparePrice = rawPrice;
      if (isCableMaterial(material)) {
        const packaging = material.cable!.packaging[s.id];
        if (packaging && packaging.lot_metres !== null) {
          const { totalPrice } = calcCablePurchase({
            neededMetres: packaging.lot_metres,
            packaging,
            unitPrice: rawPrice,
          });
          comparePrice = totalPrice ?? rawPrice;
        }
      }
      return { id: s.id, price: comparePrice };
    })
    .filter((s): s is { id: string; price: number } => s !== null);

  if (available.length < 2) return result;

  const best = Math.min(...available.map((s) => s.price));
  for (const { id, price } of available) {
    const isBest = price === best;
    const diff = isBest ? undefined : Math.round((price - best) * 100) / 100;
    result.set(id, { isBest, diffFromBest: diff });
  }
  return result;
}

interface PriceTableProps {
  materials: Material[];
  prices: PriceMatrix;
  scanning: boolean;
  onScan: () => void;
  onStop: () => void;
  onEdit: (material: Material) => void;
  toolbar?: React.ReactNode;
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onToggleSelectAll: (ids: string[], selected: boolean) => void;
}

export function PriceTable({
  materials,
  prices,
  scanning,
  onScan,
  onStop,
  onEdit,
  toolbar,
  selectedIds,
  onToggleSelect,
  onToggleSelectAll,
}: PriceTableProps): React.ReactElement {
  // Set of collapsed category names (all expanded by default)
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');

  const toggleCategory = (categorie: string) => {
    setCollapsedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(categorie)) next.delete(categorie);
      else next.add(categorie);
      return next;
    });
  };

  // Filter materials by search query (nom, marque, categorie)
  const filteredMaterials = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return materials;
    return materials.filter(
      (m) =>
        m.nom.toLowerCase().includes(q) ||
        m.marque.toLowerCase().includes(q) ||
        m.categorie.toLowerCase().includes(q)
    );
  }, [materials, searchQuery]);

  // Group filtered materials by categorie, preserving insertion order
  const groups = useMemo(() => {
    const map = new Map<string, Material[]>();
    for (const m of filteredMaterials) {
      const cat = m.categorie || 'Autre';
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(m);
    }
    return map;
  }, [filteredMaterials]);

  const allCollapsed = groups.size > 0 && collapsedCategories.size === groups.size;

  const toggleAll = () => {
    if (allCollapsed) {
      setCollapsedCategories(new Set());
    } else {
      setCollapsedCategories(new Set(groups.keys()));
    }
  };

  const lastUpdated = Object.values(prices)
    .flatMap((row) => Object.values(row))
    .filter((c) => c.status === 'success' && c.data?.fetchedAt)
    .map((c) => c.data!.fetchedAt)
    .sort()
    .at(-1);

  const allSelected = filteredMaterials.length > 0 && filteredMaterials.every((m) => selectedIds.has(m.id));
  const someSelected = !allSelected && filteredMaterials.some((m) => selectedIds.has(m.id));
  const selectedCount = materials.filter((m) => selectedIds.has(m.id)).length;

  // Total number of columns (checkbox + nom + suppliers + edit) — no marque column
  const colSpan = 2 + SUPPLIERS.length + 1;

  const isFiltering = searchQuery.trim().length > 0;

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* ── Toolbar ── */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-wrap gap-3">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">
            Catalogue —{' '}
            {isFiltering
              ? <><span className="text-orange-600">{filteredMaterials.length}</span> / {materials.length} article{materials.length > 1 ? 's' : ''}</>
              : <>{materials.length} article{materials.length > 1 ? 's' : ''}</>
            }
            {selectedCount > 0 && (
              <span
                data-testid="selection-badge"
                className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-700"
              >
                {selectedCount} sélectionné{selectedCount > 1 ? 's' : ''}
              </span>
            )}
          </h2>
          {lastUpdated && (
            <p className="text-xs text-gray-400 mt-0.5">
              ⏱ Prix mis à jour à{' '}
              {new Date(lastUpdated).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Search filter */}
          <div className="relative">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs pointer-events-none">🔎</span>
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filtrer…"
              aria-label="Filtrer le catalogue"
              className="pl-7 pr-3 py-1.5 w-40 border border-gray-200 rounded-lg text-sm
                placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-400
                focus:border-transparent transition-colors"
            />
          </div>

          {/* Catalogue management buttons (import/export/add) */}
          {toolbar}

          {/* Collapse / expand all — icon only */}
          {groups.size > 0 && (
            <button
              onClick={toggleAll}
              className="inline-flex items-center justify-center w-8 h-8 rounded-lg
                bg-gray-100 hover:bg-gray-200 text-gray-600 transition-colors
                focus:outline-none focus:ring-2 focus:ring-gray-400"
              title={allCollapsed ? 'Tout déplier' : 'Tout replier'}
              aria-label={allCollapsed ? 'Tout déplier' : 'Tout replier'}
            >
              {allCollapsed ? '▶' : '▼'}
            </button>
          )}

          {/* Scan buttons */}
          {scanning && (
            <button
              onClick={onStop}
              aria-label="Arrêter le scan"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium
                bg-red-100 hover:bg-red-200 text-red-700 cursor-pointer
                transition-colors focus:outline-none focus:ring-2 focus:ring-red-400"
            >
              <span>⏹</span>
            </button>
          )}
          <button
            onClick={onScan}
            disabled={scanning || selectedCount === 0}
            title={selectedCount === 0 ? 'Cochez des articles pour lancer le scan' : undefined}
            aria-label={
              scanning ? 'Scan en cours'
              : selectedCount > 0 ? `Actualiser les prix (${selectedCount} article${selectedCount > 1 ? 's' : ''})`
              : 'Sélectionnez des articles pour scanner'
            }
            className={[
              'inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium',
              'transition-colors focus:outline-none focus:ring-2 focus:ring-orange-400',
              scanning || selectedCount === 0
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'bg-orange-500 hover:bg-orange-600 text-white cursor-pointer',
            ].join(' ')}
          >
            {scanning ? (
              <span className="animate-spin inline-block w-3.5 h-3.5 border-2 border-gray-400 border-t-transparent rounded-full" />
            ) : selectedCount > 0 ? (
              <><span>🔍</span><span>{selectedCount}</span></>
            ) : (
              <span>🔍</span>
            )}
          </button>
        </div>
      </div>

      {/* ── Table ── */}
      {materials.length === 0 ? (
        <div className="py-16 text-center text-gray-400 text-sm">
          Aucun article dans le catalogue.
        </div>
      ) : filteredMaterials.length === 0 ? (
        <div className="py-16 text-center text-gray-400 text-sm">
          <p className="text-2xl mb-3">🔎</p>
          <p>Aucun résultat pour <strong className="text-gray-600">« {searchQuery} »</strong></p>
          <button
            onClick={() => setSearchQuery('')}
            className="mt-3 text-xs text-orange-500 hover:underline"
          >
            Effacer le filtre
          </button>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm table-fixed">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                {/* Select-all checkbox */}
                <th className="px-4 py-3 w-10">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    ref={(el) => { if (el) el.indeterminate = someSelected; }}
                    onChange={(e) => onToggleSelectAll(filteredMaterials.map((m) => m.id), e.target.checked)}
                    className="w-4 h-4 rounded accent-orange-500 cursor-pointer"
                    title="Tout sélectionner"
                    aria-label="Tout sélectionner"
                  />
                </th>
                {/* Material column: takes all remaining width */}
                <th className="text-left px-5 py-3 font-medium text-gray-500">Matériel</th>
                {/* Supplier columns: fixed width sized to fit price + lot info */}
                {SUPPLIERS.map((s) => (
                  <th
                    key={s.id}
                    className="text-right px-4 py-3 font-medium text-gray-500 w-[140px]"
                    style={{ borderTop: `3px solid ${s.color}` }}
                  >
                    {s.label}
                  </th>
                ))}
                {/* Edit column */}
                <th className="px-3 py-3 w-10" />
              </tr>
            </thead>
            <tbody>
              {Array.from(groups.entries()).map(([categorie, items]) => {
                const isCollapsed = collapsedCategories.has(categorie);
                const catIds = items.map((m) => m.id);
                const allCatSelected = catIds.every((id) => selectedIds.has(id));
                const someCatSelected = !allCatSelected && catIds.some((id) => selectedIds.has(id));

                return (
                  <React.Fragment key={categorie}>
                    {/* ── Category header row ── */}
                    <tr className="bg-gray-100 border-y border-gray-200">
                      {/* Category-level select-all checkbox */}
                      <td className="px-4 py-2">
                        <input
                          type="checkbox"
                          checked={allCatSelected}
                          ref={(el) => { if (el) el.indeterminate = someCatSelected; }}
                          onChange={(e) => onToggleSelectAll(catIds, e.target.checked)}
                          className="w-4 h-4 rounded accent-orange-500 cursor-pointer"
                          title={`Sélectionner tous les articles de la catégorie ${categorie}`}
                          aria-label={`Sélectionner catégorie ${categorie}`}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </td>
                      <td
                        colSpan={colSpan - 1}
                        className="py-2 pr-4 cursor-pointer select-none"
                        onClick={() => toggleCategory(categorie)}
                        aria-label={`${isCollapsed ? 'Déplier' : 'Replier'} la catégorie ${categorie}`}
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className="text-xs text-gray-400"
                            style={{ display: 'inline-block', transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)', transition: 'transform 150ms' }}
                          >
                            ▾
                          </span>
                          <span className="font-semibold text-gray-700 text-xs uppercase tracking-wide">
                            {categorie}
                          </span>
                          <span className="text-xs text-gray-400">
                            {items.length} article{items.length > 1 ? 's' : ''}
                          </span>
                        </div>
                      </td>
                    </tr>

                    {/* ── Material rows ── */}
                    {!isCollapsed && items.map((material, idx) => {
                      const isSelected = selectedIds.has(material.id);
                      const comparison = computeRowComparison(material, prices);
                      return (
                        <tr
                          key={material.id}
                          className={[
                            'border-b border-gray-50 transition-colors group',
                            isSelected ? 'bg-orange-50/60' : idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/40',
                            'hover:bg-orange-50/40',
                          ].join(' ')}
                        >
                          <td className="px-4 py-3.5">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => onToggleSelect(material.id)}
                              className="w-4 h-4 rounded accent-orange-500 cursor-pointer"
                              aria-label={`Sélectionner ${material.nom}`}
                            />
                          </td>
                          <td className="px-5 py-3.5">
                            <div className="font-medium text-gray-800">{material.nom}</div>
                            <div className="text-xs text-gray-400 mt-0.5">{material.marque}</div>
                          </td>
                          {SUPPLIERS.map((s) => (
                            <td key={s.id} className="px-4 py-3.5 text-right">
                              <PriceCellDisplay
                                cell={prices[material.id]?.[s.id]}
                                isBest={comparison.get(s.id)?.isBest}
                                diffFromBest={comparison.get(s.id)?.diffFromBest}
                                material={material}
                                supplierId={s.id}
                              />
                            </td>
                          ))}
                          <td className="px-3 py-3.5 text-right">
                            <button
                              onClick={() => onEdit(material)}
                              className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-orange-500 transition-opacity focus:opacity-100 p-1 rounded"
                              title="Modifier cet article"
                              aria-label={`Modifier ${material.nom}`}
                            >
                              ✏️
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

