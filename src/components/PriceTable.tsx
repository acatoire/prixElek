/**
 * src/components/PriceTable.tsx
 *
 * Main catalogue comparison table.
 * Shows one row per material, one column per configured supplier.
 * Prices start empty (idle) and fill in after the scan is launched.
 */
import React from 'react';
import type { Material } from '@/types/material';
import type { PriceMatrix } from '@/types/price';
import { PriceCellDisplay } from './PriceCellDisplay';
import { SUPPLIERS } from '@/config/suppliers';

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
  const lastUpdated = Object.values(prices)
    .flatMap((row) => Object.values(row))
    .filter((c) => c.status === 'success' && c.data?.fetchedAt)
    .map((c) => c.data!.fetchedAt)
    .sort()
    .at(-1);

  const allSelected = materials.length > 0 && materials.every((m) => selectedIds.has(m.id));
  const someSelected = !allSelected && materials.some((m) => selectedIds.has(m.id));
  const selectedCount = materials.filter((m) => selectedIds.has(m.id)).length;

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* ── Toolbar ── */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-wrap gap-3">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">
            Catalogue — {materials.length} article{materials.length > 1 ? 's' : ''}
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
              {new Date(lastUpdated).toLocaleTimeString('fr-FR', {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Catalogue management buttons (import/export/add) */}
          {toolbar}

          {/* Scan buttons */}
          {scanning && (
            <button
              onClick={onStop}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium
                bg-red-100 hover:bg-red-200 text-red-700 cursor-pointer
                transition-colors focus:outline-none focus:ring-2 focus:ring-red-400"
            >
              <span>⏹</span>
              Arrêter
            </button>
          )}
          <button
            onClick={onScan}
            disabled={scanning}
            className={[
              'inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium',
              'transition-colors focus:outline-none focus:ring-2 focus:ring-orange-400',
              scanning
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'bg-orange-500 hover:bg-orange-600 text-white cursor-pointer',
            ].join(' ')}
          >
            {scanning ? (
              <>
                <span className="animate-spin inline-block w-3.5 h-3.5 border-2 border-gray-400 border-t-transparent rounded-full" />
                Scan en cours…
              </>
            ) : selectedCount > 0 ? (
              <><span>🔍</span> Actualiser les prix ({selectedCount})</>
            ) : (
              <><span>🔍</span> Actualiser les prix</>
            )}
          </button>
        </div>
      </div>

      {/* ── Table ── */}
      {materials.length === 0 ? (
        <div className="py-16 text-center text-gray-400 text-sm">
          Aucun article dans le catalogue.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                {/* Select-all checkbox */}
                <th className="px-4 py-3 w-10">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    ref={(el) => { if (el) el.indeterminate = someSelected; }}
                    onChange={(e) => onToggleSelectAll(materials.map((m) => m.id), e.target.checked)}
                    className="w-4 h-4 rounded accent-orange-500 cursor-pointer"
                    title="Tout sélectionner"
                    aria-label="Tout sélectionner"
                  />
                </th>
                <th className="text-left px-5 py-3 font-medium text-gray-500 w-1/2">
                  Matériel
                </th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">
                  Marque
                </th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">
                  Catégorie
                </th>
                {SUPPLIERS.map((s) => (
                  <th
                    key={s.id}
                    className="text-right px-5 py-3 font-medium text-gray-500 min-w-[140px]"
                    style={{ borderTop: `3px solid ${s.color}` }}
                  >
                    {s.label}
                    <span className="ml-1 text-xs font-normal text-gray-400">HT</span>
                  </th>
                ))}
                {/* Edit column */}
                <th className="px-3 py-3 w-10" />
              </tr>
            </thead>
            <tbody>
              {materials.map((material, idx) => {
                const isSelected = selectedIds.has(material.id);
                return (
                  <tr
                    key={material.id}
                    className={[
                      'border-b border-gray-50 transition-colors group',
                      isSelected
                        ? 'bg-orange-50/60'
                        : idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/40',
                      'hover:bg-orange-50/40',
                    ].join(' ')}
                  >
                    {/* Checkbox */}
                    <td className="px-4 py-3.5">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => onToggleSelect(material.id)}
                        className="w-4 h-4 rounded accent-orange-500 cursor-pointer"
                        aria-label={`Sélectionner ${material.nom}`}
                      />
                    </td>
                    <td className="px-5 py-3.5 font-medium text-gray-800">{material.nom}</td>
                    <td className="px-4 py-3.5 text-gray-500">{material.marque}</td>
                    <td className="px-4 py-3.5">
                      <span className="inline-block bg-gray-100 text-gray-600 text-xs px-2 py-0.5 rounded-full">
                        {material.categorie}
                      </span>
                    </td>
                    {SUPPLIERS.map((s) => (
                      <td key={s.id} className="px-5 py-3.5 text-right">
                        <PriceCellDisplay cell={prices[material.id]?.[s.id]} />
                      </td>
                    ))}
                    {/* Edit button */}
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
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

