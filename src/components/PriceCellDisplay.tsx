/**
 * src/components/PriceCellDisplay.tsx
 *
 * Renders a single price cell in the comparison table.
 * Handles: idle, loading, success, error states.
 * For cable materials (isCableMaterial), shows the per-lot price + lot size.
 */
import React from 'react';
import type { PriceCell } from '@/types/price';
import type { Material } from '@/types/material';
import { isCableMaterial } from '@/types/material';

interface PriceCellDisplayProps {
  cell: PriceCell | undefined;
  /** True when this cell has the lowest price among all suppliers for this row */
  isBest?: boolean;
  /** Difference vs the best price (positive = more expensive). Undefined when this cell IS the best or only one price available. */
  diffFromBest?: number;
  /** When provided, enables cable-specific lot price display */
  material?: Material;
  /** Supplier id — needed to look up cable packaging */
  supplierId?: string;
}

/** Formats a euro price: 18.64 → "18,64 €" */
function formatPrice(value: number): string {
  return value.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' });
}

/** Formats a positive diff: 1.3 → "+1,30 €" */
function formatDiff(value: number): string {
  return '+' + value.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' });
}

export function PriceCellDisplay({ cell, isBest, diffFromBest, material, supplierId }: PriceCellDisplayProps): React.ReactElement {
  if (!cell || cell.status === 'idle') {
    return <span className="text-gray-300 select-none">—</span>;
  }

  if (cell.status === 'loading') {
    return (
      <span className="inline-flex items-center gap-1 text-gray-400 text-sm">
        <span className="animate-spin inline-block w-3 h-3 border border-gray-400 border-t-transparent rounded-full" />
        <span>…</span>
      </span>
    );
  }

  if (cell.status === 'error') {
    const msg = cell.errorMessage ?? 'Indisponible';
    // Shorten long technical messages for display
    const shortMsg = msg.length > 60 ? msg.slice(0, 57) + '…' : msg;
    return (
      <span
        className="flex flex-col items-end gap-0.5"
        title={msg}
      >
        <span className="text-red-500 text-xs font-medium">⚠ Erreur</span>
        <span className="text-red-400 text-xs leading-tight max-w-[180px] text-right">
          {shortMsg}
        </span>
      </span>
    );
  }

  // success
  const price = cell.data?.prix_ht;
  if (price === null || price === undefined) {
    return <span className="text-gray-400 text-sm">—</span>;
  }

  const inStock = (cell.data?.stock ?? 0) > 0;

  // Show cache age when price is older than 1 minute (i.e. served from cache)
  const fetchedAt = cell.data?.fetchedAt;
  const ageMs = fetchedAt ? Date.now() - new Date(fetchedAt).getTime() : 0;
  const isCached = ageMs > 60_000;
  const ageLabel = isCached
    ? ageMs < 3_600_000
      ? `il y a ${Math.floor(ageMs / 60_000)} min`
      : ageMs < 86_400_000
        ? `il y a ${Math.floor(ageMs / 3_600_000)} h`
        : `il y a ${Math.floor(ageMs / 86_400_000)} j`
    : null;

  // ── Cable: compute lot price ───────────────────────────────────────────────
  let lotInfo: { lotPrice: number; lotMetres: number; pricePerMetre: number } | null = null;
  if (material && supplierId && isCableMaterial(material)) {
    const packaging = material.cable!.packaging[supplierId];
    if (packaging && packaging.lot_metres !== null) {
      const lotMetres = packaging.lot_metres;
      const lotPrice =
        packaging.prix_base === 'metre'
          ? Math.round(price * lotMetres * 100) / 100   // HT/m × lot size
          : price;                                       // already per lot
      const pricePerMetre =
        packaging.prix_base === 'metre'
          ? price
          : Math.round((price / lotMetres) * 10000) / 10000;
      lotInfo = { lotPrice, lotMetres, pricePerMetre };
    }
  }

  // The "headline" price shown large:
  //   - cable with lot packaging → lot price (what you actually pay for 1 reel)
  //   - everything else          → unit HT price as-is
  const displayPrice = lotInfo ? lotInfo.lotPrice : price;

  return (
    <span className="flex flex-col items-end gap-0.5">
      {/* Main price + diff */}
      <span className="inline-flex items-baseline gap-1.5">
        <span className={`font-semibold tabular-nums ${isBest ? 'text-green-600' : 'text-gray-900'}`}>
          {formatPrice(displayPrice)}
        </span>
        {diffFromBest !== undefined && diffFromBest > 0 && (
          <span className="text-xs tabular-nums text-red-300 font-medium">
            {formatDiff(diffFromBest)}
          </span>
        )}
      </span>

      {/* Cable lot details */}
      {lotInfo && (
        <span className="text-xs text-gray-400 tabular-nums">
          {formatPrice(lotInfo.pricePerMetre)}/m · lot {lotInfo.lotMetres} m
        </span>
      )}

      {/* Stock */}
      <span className={`text-xs ${inStock ? 'text-green-600' : 'text-orange-500'}`}>
        {inStock ? 'En stock' : 'Sur commande'}
      </span>

      {ageLabel && (
        <span className="text-xs text-gray-300" title={fetchedAt ? new Date(fetchedAt).toLocaleString('fr-FR') : ''}>
          ⏱ {ageLabel}
        </span>
      )}
    </span>
  );
}
