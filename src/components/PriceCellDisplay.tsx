/**
 * src/components/PriceCellDisplay.tsx
 *
 * Renders a single price cell in the comparison table.
 * Handles: idle, loading, success, error states.
 */
import React from 'react';
import type { PriceCell } from '@/types/price';

interface PriceCellDisplayProps {
  cell: PriceCell | undefined;
}

/** Formats a euro price HT: 18.64 → "18,64 € HT" */
function formatPrice(value: number): string {
  return value.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' }) + ' HT';
}

/** Formats a euro price TTC: 18.64 → "18,64 € TTC" */
function formatPriceTtc(value: number): string {
  return value.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' }) + ' TTC';
}

export function PriceCellDisplay({ cell }: PriceCellDisplayProps): React.ReactElement {
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
  const priceTtc = cell.data?.prix_ttc;

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

  return (
    <span className="flex flex-col items-end gap-0.5">
      <span className="font-semibold text-gray-900 tabular-nums">{formatPrice(price)}</span>
      {priceTtc !== undefined && (
        <span className="text-xs text-gray-400 tabular-nums">
          ({formatPriceTtc(priceTtc)})
        </span>
      )}
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
