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
import React, {useRef, useCallback, useState, useMemo} from 'react';
import type {Material} from '@/types/material';
import {isCableMaterial} from '@/types/material';
import type {PriceMatrix} from '@/types/price';
import type {UseCommandeReturn} from '@/hooks/useCommande';
import {SUPPLIERS} from '@/config/suppliers';
import {calcCablePurchase, compareCableSuppliers} from '@/services/CableCalculator';
import {bestTierForQty} from '@/services/extractProduct';

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(value: number): string {
  return value.toLocaleString('fr-FR', {style: 'currency', currency: 'EUR'});
}

/** Formats a positive diff for totals: 3.5 → "+3,50 €" */
function fmtDiff(value: number): string {
  return '+' + value.toLocaleString('fr-FR', {style: 'currency', currency: 'EUR'});
}

/**
 * Given a map of supplierId → price, returns comparison info per supplier.
 * Returns empty map when fewer than 2 prices are available.
 */
function computeComparison(
  supplierPrices: Map<string, number>
): Map<string, { isBest: boolean; diffFromBest: number | undefined }> {
  const result = new Map<string, { isBest: boolean; diffFromBest: number | undefined }>();
  if (supplierPrices.size < 2) return result;
  const best = Math.min(...supplierPrices.values());
  for (const [id, price] of supplierPrices) {
    const isBest = price === best;
    result.set(id, {isBest, diffFromBest: isBest ? undefined : Math.round((price - best) * 100) / 100});
  }
  return result;
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
      const cable = isCableMaterial(item.material);
      if (cable) {
        const packaging = item.material.cable!.packaging[supplierId];
        if (packaging && item.prix_ht !== null) {
          const { lotsNeeded, metresBought, totalPrice, surMesure } = calcCablePurchase({
            neededMetres: item.quantity,
            packaging,
            unitPrice: item.prix_ht,
          });
          const lotDesc = surMesure
            ? `${item.quantity} m sur mesure`
            : `${lotsNeeded} × ${packaging.lot_metres} m = ${metresBought} m`;
          return `  - ${item.material.nom} (réf. ${ref})  ${lotDesc}  =  ${totalPrice !== null ? fmt(totalPrice) : '—'}`;
        }
        return `  - ${item.material.nom} (réf. ${ref})  ${item.quantity} m  prix inconnu`;
      }
      const price = item.prix_ht !== null ? fmt(item.prix_ht) : 'prix inconnu';
      const total = item.prix_ht !== null ? fmt(item.prix_ht * item.quantity) : '—';
      return `  - ${item.material.nom} (réf. ${ref})  ×${item.quantity}  ${price}/u  =  ${total}`;
    })
    .join('\n');

  const total = items.reduce((acc, i) => {
    if (i.prix_ht === null) return acc;
    if (isCableMaterial(i.material)) {
      const packaging = i.material.cable!.packaging[supplierId];
      if (!packaging) return acc;
      const { totalPrice } = calcCablePurchase({ neededMetres: i.quantity, packaging, unitPrice: i.prix_ht });
      return totalPrice !== null ? acc + totalPrice : acc;
    }
    return acc + i.prix_ht * i.quantity;
  }, 0);

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
  scanning: boolean;
  onScan: () => void;
  onStop: () => void;
}

export function CommandeTab({
                              materials,
                              prices,
                              commande,
                              scanning,
                              onScan,
                              onStop
                            }: CommandeTabProps): React.ReactElement {
  const {selectedIds, quantities, setQuantity, removeItem, exportOrder, importOrder} = commande;
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Set of collapsed category names (all expanded by default)
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());

  const toggleCategory = (categorie: string) => {
    setCollapsedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(categorie)) next.delete(categorie);
      else next.add(categorie);
      return next;
    });
  };

  // Only materials that are selected
  const selectedMaterials = materials.filter((m) => selectedIds.has(m.id));

  // Group selected materials by categorie, preserving insertion order
  const groups = useMemo(() => {
    const map = new Map<string, Material[]>();
    for (const m of selectedMaterials) {
      const cat = m.categorie || 'Autre';
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(m);
    }
    return map;
  }, [selectedMaterials]);

  const allCollapsed = groups.size > 0 && collapsedCategories.size === groups.size;

  const toggleAll = () => {
    if (allCollapsed) {
      setCollapsedCategories(new Set());
    } else {
      setCollapsedCategories(new Set(groups.keys()));
    }
  };

  // Total number of columns (nom + qty + suppliers + remove)
  const colSpan = 2 + SUPPLIERS.length + 1;

  // ── Per-supplier totals ──────────────────────────────────────────────────────
  const supplierTotals = Object.fromEntries(
    SUPPLIERS.map((s) => {
      const total = selectedMaterials.reduce((acc, m) => {
        const cell = prices[m.id]?.[s.id];
        const basePrice = cell?.status === 'success' ? (cell.data?.prix_ht ?? null) : null;
        if (basePrice === null) return acc;
        if (isCableMaterial(m)) {
          const packaging = m.cable!.packaging[s.id];
          if (!packaging) return acc;
          const qty = Math.max(1, quantities[m.id] ?? 1);
          const { totalPrice } = calcCablePurchase({ neededMetres: qty, packaging, unitPrice: basePrice });
          return totalPrice !== null ? acc + totalPrice : acc;
        }
        const qty = quantities[m.id] ?? 1;
        // Apply best tier for this quantity if tiers exist and are non-empty
        const tiers = cell?.data?.tiers;
        const unitPrice = (tiers && tiers.length > 0) ? bestTierForQty(tiers, qty).prix_ht : basePrice;
        return acc + unitPrice * qty;
      }, 0);
      const hasAllPrices = selectedMaterials.every(
        (m) => prices[m.id]?.[s.id]?.status === 'success'
      );
      return [s.id, {total, hasAllPrices}];
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
      const blob = new Blob([body], {type: 'text/plain;charset=utf-8'});
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

  // ── Shared file input (needed in both empty state and full toolbar) ──────────
  const loadButton = (
    <>
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
      > 📂
      </button>
    </>
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
        <div className="mt-6 flex justify-center">{loadButton}</div>
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
          {loadButton}
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
          <button
            onClick={exportOrder}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium
              bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors
              focus:outline-none focus:ring-2 focus:ring-gray-400"
            title="Sauvegarder la commande pour la réimporter plus tard"
          > 💾
          </button>
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
            disabled={scanning}
            aria-label={scanning ? 'Scan en cours' : 'Actualiser les prix'}
            className={[
              'inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium',
              'transition-colors focus:outline-none focus:ring-2 focus:ring-orange-400',
              scanning
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'bg-orange-500 hover:bg-orange-600 text-white cursor-pointer',
            ].join(' ')}
          >
            {scanning ? (
              <span className="animate-spin inline-block w-3.5 h-3.5 border-2 border-gray-400 border-t-transparent rounded-full" />
            ) : (
              <span>🔍</span>
            )}
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
                style={{borderTop: `3px solid ${s.color}`}}
              >
                {s.label}
              </th>
            ))}
            <th className="px-3 py-3 w-10"/>
          </tr>
          </thead>
          <tbody>
          {Array.from(groups.entries()).map(([categorie, items]) => {
            const isCollapsed = collapsedCategories.has(categorie);
            return (
              <React.Fragment key={categorie}>
                {/* ── Category header row ── */}
                <tr className="bg-gray-100 border-y border-gray-200">
                  <td
                    colSpan={colSpan}
                    className="py-2 px-5 cursor-pointer select-none"
                    onClick={() => toggleCategory(categorie)}
                    aria-label={`${isCollapsed ? 'Déplier' : 'Replier'} la catégorie ${categorie}`}
                  >
                    <div className="flex items-center gap-2">
                        <span
                          className="text-xs text-gray-400 transition-transform duration-150"
                          style={{display: 'inline-block', transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)'}}
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

                {/* ── Material rows (hidden when collapsed) ── */}
                {!isCollapsed && items.map((material, idx) => {
                  const qty = quantities[material.id] ?? 1;
                  const isCable = isCableMaterial(material);

                  // ── Cable row ──────────────────────────────────────────────
                  if (isCable) {
                    const neededMetres = Math.max(1, qty);
                    // Compute per-supplier cable purchase results
                    const cableResults = SUPPLIERS.map((s) => {
                      const unitPrice = prices[material.id]?.[s.id]?.data?.prix_ht ?? null;
                      const packaging = material.cable!.packaging[s.id];
                      if (!packaging) {
                        return { supplierId: s.id, lotsNeeded: 0, metresBought: 0, totalPrice: null, pricePerMetre: null, surMesure: false };
                      }
                      return { supplierId: s.id, ...calcCablePurchase({ neededMetres, packaging, unitPrice }) };
                    });
                    const compared = compareCableSuppliers(cableResults);

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
                          <div className="text-xs text-blue-500 font-medium mt-0.5">🔌 Câble (prix au mètre)</div>
                        </td>

                        {/* Metres needed */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              min={1}
                              value={neededMetres}
                              onChange={(e) => setQuantity(material.id, parseInt(e.target.value, 10) || 1)}
                              className="w-16 border border-gray-200 rounded-lg px-2 py-1 text-sm text-center
                                focus:outline-none focus:ring-2 focus:ring-blue-400"
                            />
                            <span className="text-xs text-gray-500">m</span>
                          </div>
                        </td>

                        {/* Per-supplier cable cost */}
                        {SUPPLIERS.map((s) => {
                          const cell = prices[material.id]?.[s.id];
                          const ref = material.references_fournisseurs[s.id];
                          const result = compared.find((r) => r.supplierId === s.id);
                          const packaging = material.cable!.packaging[s.id];

                          if (!ref) {
                            return (
                              <td key={s.id} className="px-5 py-3 text-right text-gray-300 text-xs">
                                Non référencé
                              </td>
                            );
                          }
                          if (!cell || cell.status === 'idle') {
                            return (
                              <td key={s.id} className="px-5 py-3 text-right text-gray-300 text-xs">—</td>
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
                          if (!result || !packaging) {
                            return <td key={s.id} className="px-5 py-3 text-right text-gray-300 text-xs">—</td>;
                          }

                          const lotSize = packaging.lot_metres;
                          return (
                            <td key={s.id} className="px-5 py-3 text-right">
                              {/* Total price */}
                              <div className={`font-semibold tabular-nums ${result.isBest ? 'text-green-600' : 'text-gray-900'}`}>
                                {result.totalPrice !== null ? fmt(result.totalPrice) : '—'}
                              </div>
                              {/* Diff vs best */}
                              {result.diffFromBest !== undefined && (
                                <div className="text-xs tabular-nums text-red-300 font-medium">
                                  {fmtDiff(result.diffFromBest)}
                                </div>
                              )}
                              {/* Lot breakdown */}
                              <div className="text-xs text-gray-400 mt-0.5">
                                {result.surMesure
                                  ? `Sur mesure — ${neededMetres} m`
                                  : `${result.lotsNeeded} × ${lotSize} m = ${result.metresBought} m livrés`
                                }
                              </div>
                              {/* Price per metre */}
                              {result.pricePerMetre !== null && (
                                <div className="text-xs text-gray-400 tabular-nums">
                                  {result.pricePerMetre.toLocaleString('fr-FR', {style: 'currency', currency: 'EUR'})}/m
                                </div>
                              )}
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
                  }

                  // ── Regular (non-cable) row ────────────────────────────────

                  // Compute per-row price comparison using tier-aware unit prices
                  const rowPrices = new Map<string, number>();
                  for (const s of SUPPLIERS) {
                    const cell = prices[material.id]?.[s.id];
                    const baseP = cell?.data?.prix_ht;
                    if (baseP === null || baseP === undefined) continue;
                    const tiers = cell?.data?.tiers;
                    const unitP = (tiers && tiers.length > 0) ? bestTierForQty(tiers, qty).prix_ht : baseP;
                    rowPrices.set(s.id, unitP * qty);
                  }
                  const rowComparison = computeComparison(rowPrices);
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
                          return <td key={s.id} className="px-5 py-3 text-right text-gray-300 text-xs">—</td>;
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
                        const basePrice = cell.data?.prix_ht ?? null;
                        const tiers = cell.data?.tiers;
                        const activeTier = (tiers && tiers.length > 0) ? bestTierForQty(tiers, qty) : null;
                        const unitPrice = activeTier ? activeTier.prix_ht : basePrice;
                        const lineTotal = unitPrice !== null ? unitPrice * qty : null;
                        const cmp = rowComparison.get(s.id);
                        return (
                          <td key={s.id} className="px-5 py-3 text-right">
                            <div className={`font-semibold tabular-nums ${cmp?.isBest ? 'text-green-600' : 'text-gray-900'}`}>
                              {lineTotal !== null ? fmt(lineTotal) : '—'}
                            </div>
                            {cmp?.diffFromBest !== undefined && (
                              <div className="text-xs tabular-nums text-red-300 font-medium">
                                {fmtDiff(cmp.diffFromBest)}
                              </div>
                            )}
                            <div className="text-xs text-gray-400 tabular-nums">
                              {unitPrice !== null ? `${fmt(unitPrice)} × ${qty}` : ''}
                              {activeTier && activeTier.discountPct > 0 && (
                                <span className="ml-1 text-orange-500">🧮 -{activeTier.discountPct}%</span>
                              )}
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
              </React.Fragment>
            );
          })}
          </tbody>

          {/* ── Totals row ── */}
          <tfoot>
          <tr className="bg-gray-50 border-t-2 border-gray-200">
            <td className="px-5 py-3 text-sm font-semibold text-gray-700">Total HT estimé</td>
            <td/>
            {(() => {
              // Compute totals comparison across suppliers
              const totalPrices = new Map<string, number>();
              for (const s of SUPPLIERS) {
                const t = supplierTotals[s.id].total;
                if (t > 0) totalPrices.set(s.id, t);
              }
              const totalComparison = computeComparison(totalPrices);
              return SUPPLIERS.map((s) => {
                const {total, hasAllPrices} = supplierTotals[s.id];
                const cmp = totalComparison.get(s.id);
                return (
                  <td key={s.id} className="px-5 py-3 text-right">
                    <div
                      className={`font-bold tabular-nums text-base ${cmp?.isBest ? 'text-green-600' : 'text-gray-900'}`}>
                      {total > 0 ? fmt(total) : '—'}
                    </div>
                    {cmp?.diffFromBest !== undefined && (
                      <div className="text-sm tabular-nums text-red-300 font-medium">
                        {fmtDiff(cmp.diffFromBest)}
                      </div>
                    )}
                    {!hasAllPrices && total > 0 && (
                      <div className="text-xs text-amber-500">⚠ prix partiels</div>
                    )}
                    {selectedMaterials.length > 0 && (
                      <button
                        onClick={() => handleExportEmail(s.id, s.label)}
                        className="mt-1.5 inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium
                            bg-orange-50 hover:bg-orange-100 text-orange-700 border border-orange-200
                            transition-colors focus:outline-none focus:ring-2 focus:ring-orange-400"
                        title={`Exporter la commande ${s.label} (format e-mail)`}
                      >
                        ✉ {s.label}
                      </button>
                    )}
                  </td>
                );
              });
            })()}
            <td/>
          </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

