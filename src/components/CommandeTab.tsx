/**
 * src/components/CommandeTab.tsx
 *
 * Order (Commande) tab.
 * - Shows only the catalogue items checked in the Catalogue tab
 * - Quantity input per item
 * - Per-supplier subtotal + grand total columns
 * - Export-as-email button per supplier column
 * - Save order / load order buttons
 */
import React, { useRef, useCallback } from 'react';
import type { Material } from '@/types/material';
import type { PriceMatrix } from '@/types/price';
import type { UseCommandeReturn } from '@/hooks/useCommande';

// ── Constants ─────────────────────────────────────────────────────────────────

const SUPPLIERS = [
  { id: 'materielelectrique', label: 'Matériel Électrique', color: '#e65c00' },
  // Future suppliers added here
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(value: number): string {
  return value.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' });
}

function buildEmailBody(
  supplierId: string,
  supplierLabel: string,
  items: Array<{ material: Material; quantity: number; prix_ht: number | null }>
): string {
  const date = new Date().toLocaleDateString('fr-FR');
  const lines = items
    .map((item) => {
      const ref = item.material.references_fournisseurs[supplierId] ?? '—';
      const price = item.prix_ht !== null ? fmt(item.prix_ht) : 'prix inconnu';
      const total = item.prix_ht !== null ? fmt(item.prix_ht * item.quantity) : '—';
      return `  - ${item.material.nom} (réf. ${ref})  ×${item.quantity}  ${price}/u  =  ${total}`;
    })
    .join('\n');

  const total = items.reduce(
    (acc, i) => (i.prix_ht !== null ? acc + i.prix_ht * i.quantity : acc),
    0
  );

  return (
    `Commande prixElek — ${date}\n` +
    `Fournisseur : ${supplierLabel}\n` +
    `${'─'.repeat(60)}\n` +
    `${lines}\n` +
    `${'─'.repeat(60)}\n` +
    `Total HT estimé : ${fmt(total)}\n\n` +
    `Généré par prixElek`
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

interface CommandeTabProps {
  materials: Material[];
  prices: PriceMatrix;
  commande: UseCommandeReturn;
}

export function CommandeTab({ materials, prices, commande }: CommandeTabProps): React.ReactElement {
  const { selectedIds, quantities, setQuantity, removeItem, exportOrder, importOrder } = commande;
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Only materials that are selected
  const selectedMaterials = materials.filter((m) => selectedIds.has(m.id));

  // ── Per-supplier totals ──────────────────────────────────────────────────────
  const supplierTotals = Object.fromEntries(
    SUPPLIERS.map((s) => {
      const total = selectedMaterials.reduce((acc, m) => {
        const cell = prices[m.id]?.[s.id];
        const price = cell?.status === 'success' ? (cell.data?.prix_ht ?? null) : null;
        const qty = quantities[m.id] ?? 1;
        return price !== null ? acc + price * qty : acc;
      }, 0);
      const hasAllPrices = selectedMaterials.every(
        (m) => prices[m.id]?.[s.id]?.status === 'success'
      );
      return [s.id, { total, hasAllPrices }];
    })
  );

  // ── Export email per supplier ────────────────────────────────────────────────
  const handleExportEmail = useCallback(
    (supplierId: string, supplierLabel: string) => {
      const items = selectedMaterials.map((m) => ({
        material: m,
        quantity: quantities[m.id] ?? 1,
        prix_ht: prices[m.id]?.[supplierId]?.data?.prix_ht ?? null,
      }));
      const body = buildEmailBody(supplierId, supplierLabel, items);
      const blob = new Blob([body], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `commande-${supplierId}-${new Date().toISOString().slice(0, 10)}.txt`;
      a.click();
      URL.revokeObjectURL(url);
    },
    [selectedMaterials, quantities, prices]
  );

  // ── Import order from JSON ───────────────────────────────────────────────────
  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (evt) => {
        try {
          importOrder(evt.target?.result as string);
        } catch (err: unknown) {
          alert(`Import échoué : ${err instanceof Error ? err.message : String(err)}`);
        }
        e.target.value = '';
      };
      reader.readAsText(file);
    },
    [importOrder]
  );

  // ── Empty state ──────────────────────────────────────────────────────────────
  if (selectedMaterials.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 py-20 text-center">
        <p className="text-4xl mb-4">🛒</p>
        <p className="text-gray-500 text-sm font-medium">Aucun article sélectionné</p>
        <p className="text-gray-400 text-xs mt-1">
          Cochez des articles dans l'onglet <strong>Catalogue</strong> pour les ajouter ici.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* ── Toolbar ── */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-wrap gap-3">
        <h2 className="text-sm font-semibold text-gray-900">
          Commande — {selectedMaterials.length} article{selectedMaterials.length > 1 ? 's' : ''}
        </h2>
        <div className="flex items-center gap-2 flex-wrap">
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={handleFileChange}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium
              bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors
              focus:outline-none focus:ring-2 focus:ring-gray-400"
            title="Charger une commande sauvegardée"
          >
            📂 Charger commande
          </button>
          <button
            onClick={exportOrder}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium
              bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors
              focus:outline-none focus:ring-2 focus:ring-gray-400"
            title="Sauvegarder la commande pour la réimporter plus tard"
          >
            💾 Sauvegarder commande
          </button>
        </div>
      </div>

      {/* ── Table ── */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              <th className="text-left px-5 py-3 font-medium text-gray-500">Matériel</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500 w-28">Quantité</th>
              {SUPPLIERS.map((s) => (
                <th
                  key={s.id}
                  className="text-right px-5 py-3 font-medium text-gray-500 min-w-[160px]"
                  style={{ borderTop: `3px solid ${s.color}` }}
                >
                  {s.label}
                </th>
              ))}
              <th className="px-3 py-3 w-10" />
            </tr>
          </thead>
          <tbody>
            {selectedMaterials.map((material, idx) => {
              const qty = quantities[material.id] ?? 1;
              return (
                <tr
                  key={material.id}
                  className={[
                    'border-b border-gray-50 transition-colors',
                    idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/40',
                  ].join(' ')}
                >
                  {/* Material name */}
                  <td className="px-5 py-3">
                    <div className="font-medium text-gray-800">{material.nom}</div>
                    <div className="text-xs text-gray-400">{material.marque}</div>
                  </td>

                  {/* Quantity */}
                  <td className="px-4 py-3">
                    <input
                      type="number"
                      min={1}
                      value={qty}
                      onChange={(e) => setQuantity(material.id, parseInt(e.target.value, 10) || 1)}
                      className="w-20 border border-gray-200 rounded-lg px-2 py-1 text-sm text-center
                        focus:outline-none focus:ring-2 focus:ring-orange-400"
                    />
                  </td>

                  {/* Per-supplier price × qty */}
                  {SUPPLIERS.map((s) => {
                    const cell = prices[material.id]?.[s.id];
                    const ref = material.references_fournisseurs[s.id];

                    if (!ref) {
                      return (
                        <td key={s.id} className="px-5 py-3 text-right text-gray-300 text-xs">
                          Non référencé
                        </td>
                      );
                    }
                    if (!cell || cell.status === 'idle') {
                      return (
                        <td key={s.id} className="px-5 py-3 text-right text-gray-300 text-xs">
                          —
                        </td>
                      );
                    }
                    if (cell.status === 'loading') {
                      return (
                        <td key={s.id} className="px-5 py-3 text-right">
                          <span className="text-gray-400 text-xs">…</span>
                        </td>
                      );
                    }
                    if (cell.status === 'error') {
                      return (
                        <td key={s.id} className="px-5 py-3 text-right">
                          <span className="text-red-400 text-xs" title={cell.errorMessage ?? ''}>⚠ Erreur</span>
                        </td>
                      );
                    }
                    const unitPrice = cell.data?.prix_ht ?? null;
                    const lineTotal = unitPrice !== null ? unitPrice * qty : null;
                    return (
                      <td key={s.id} className="px-5 py-3 text-right">
                        <div className="font-semibold text-gray-900 tabular-nums">
                          {lineTotal !== null ? fmt(lineTotal) : '—'}
                        </div>
                        <div className="text-xs text-gray-400 tabular-nums">
                          {unitPrice !== null ? `${fmt(unitPrice)} × ${qty}` : ''}
                        </div>
                      </td>
                    );
                  })}

                  {/* Remove */}
                  <td className="px-3 py-3 text-right">
                    <button
                      onClick={() => removeItem(material.id)}
                      className="text-gray-300 hover:text-red-400 transition-colors p-1 rounded"
                      title="Retirer de la commande"
                      aria-label={`Retirer ${material.nom}`}
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>

          {/* ── Totals row ── */}
          <tfoot>
            <tr className="bg-gray-50 border-t-2 border-gray-200">
              <td className="px-5 py-3 text-sm font-semibold text-gray-700">Total HT estimé</td>
              <td />
              {SUPPLIERS.map((s) => {
                const { total, hasAllPrices } = supplierTotals[s.id];
                return (
                  <td key={s.id} className="px-5 py-3 text-right">
                    <div className="font-bold text-gray-900 tabular-nums text-base">
                      {total > 0 ? fmt(total) : '—'}
                    </div>
                    {!hasAllPrices && total > 0 && (
                      <div className="text-xs text-amber-500">⚠ prix partiels</div>
                    )}
                    {/* Export email button */}
                    {selectedMaterials.length > 0 && (
                      <button
                        onClick={() => handleExportEmail(s.id, s.label)}
                        className="mt-1.5 inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium
                          bg-orange-50 hover:bg-orange-100 text-orange-700 border border-orange-200
                          transition-colors focus:outline-none focus:ring-2 focus:ring-orange-400"
                        title={`Exporter la commande ${s.label} (format e-mail)`}
                      >
                        ✉ Exporter pour {s.label}
                      </button>
                    )}
                  </td>
                );
              })}
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

