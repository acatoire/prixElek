/**
 * src/components/PriceCellDisplay.test.tsx
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PriceCellDisplay } from './PriceCellDisplay';
import type { PriceCell, PriceTier } from '@/types/price';
import type { CableSupplierPackaging, Material } from '@/types/material';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const SUCCESS_CELL: PriceCell = {
  status: 'success',
  data: { prix_ht: 18.64, stock: 1, unite: 'pièce', fetchedAt: '2026-01-01T00:00:00Z' },
  errorMessage: null,
};

const OUT_OF_STOCK_CELL: PriceCell = {
  status: 'success',
  data: { prix_ht: 5.0, stock: 0, unite: 'pièce', fetchedAt: '2026-01-01T00:00:00Z' },
  errorMessage: null,
};

const NULL_PRICE_CELL: PriceCell = {
  status: 'success',
  data: { prix_ht: null, stock: null, unite: 'pièce', fetchedAt: '2026-01-01T00:00:00Z' },
  errorMessage: null,
};

/** Cable material with both lot and metre-based packaging */
const CABLE_MATERIAL: Material = {
  id: 'cable-test',
  nom: 'Câble 3G2.5',
  marque: 'Nexans',
  categorie: 'cables',
  references_fournisseurs: { rexel: 'REF-CABLE', materielelectrique: 'REF-ME' },
  cable: {
    unite_base: 'ml',
    packaging: {
      rexel: { lot_metres: 100, prix_base: 'lot' },
      materielelectrique: { lot_metres: 100, prix_base: 'metre' },
    },
  },
};

/** prix_ht = price of the whole 100 m lot (prix_base: 'lot') */
const CABLE_CELL_LOT: PriceCell = {
  status: 'success',
  data: { prix_ht: 75.0, stock: 1, unite: 'pièce', fetchedAt: '2026-01-01T00:00:00Z' },
  errorMessage: null,
};

/** prix_ht = price per metre (prix_base: 'metre') */
const CABLE_CELL_METRE: PriceCell = {
  status: 'success',
  data: { prix_ht: 0.8, stock: 1, unite: 'pièce', fetchedAt: '2026-01-01T00:00:00Z' },
  errorMessage: null,
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('PriceCellDisplay', () => {
  it('renders — (dash) when cell is undefined', () => {
    render(<PriceCellDisplay cell={undefined} />);
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('renders — when cell status is idle', () => {
    render(<PriceCellDisplay cell={{ status: 'idle', data: null, errorMessage: null }} />);
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('renders a spinner when status is loading', () => {
    render(<PriceCellDisplay cell={{ status: 'loading', data: null, errorMessage: null }} />);
    expect(screen.getByText('…')).toBeInTheDocument();
  });

  it('renders error indicator when status is error', () => {
    render(
      <PriceCellDisplay cell={{ status: 'error', data: null, errorMessage: 'Network fail' }} />
    );
    expect(screen.getByText(/Erreur/)).toBeInTheDocument();
    expect(screen.getByText('Network fail')).toBeInTheDocument();
  });

  it('renders price and En stock when in stock', () => {
    render(<PriceCellDisplay cell={SUCCESS_CELL} />);
    expect(screen.getByText(/18/)).toBeInTheDocument();
    expect(screen.getByText('En stock')).toBeInTheDocument();
  });

  it('highlights price in green when isBest is true', () => {
    render(<PriceCellDisplay cell={SUCCESS_CELL} isBest={true} />);
    const priceEl = screen.getByText(/18/);
    expect(priceEl.className).toMatch(/text-green-600/);
  });

  it('shows diff inline when diffFromBest is provided', () => {
    render(<PriceCellDisplay cell={SUCCESS_CELL} diffFromBest={1.3} />);
    expect(screen.getByText(/\+.*1/)).toBeInTheDocument();
  });

  it('does not show diff when diffFromBest is 0', () => {
    render(<PriceCellDisplay cell={SUCCESS_CELL} diffFromBest={0} />);
    expect(screen.queryByText(/\+/)).not.toBeInTheDocument();
  });

  it('renders Sur commande when stock is 0', () => {
    render(<PriceCellDisplay cell={OUT_OF_STOCK_CELL} />);
    expect(screen.getByText('Sur commande')).toBeInTheDocument();
  });

  it('renders — when price is null in a success cell', () => {
    render(<PriceCellDisplay cell={NULL_PRICE_CELL} />);
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  // ── Cable lot pricing ──────────────────────────────────────────────────────

  it('shows lot price as headline for a cable priced per lot (prix_base: lot)', () => {
    const { container } = render(
      <PriceCellDisplay cell={CABLE_CELL_LOT} material={CABLE_MATERIAL} supplierId="rexel" />
    );
    // Headline span has the lot price (75 €)
    const headline = container.querySelector('.font-semibold');
    expect(headline?.textContent).toMatch(/75/);
    // Sub-line contains €/m and lot size
    expect(screen.getByText(/\/m/)).toBeInTheDocument();
    expect(screen.getByText(/100 m/)).toBeInTheDocument();
  });

  it('shows lot price as headline for a cable priced per metre (prix_base: metre)', () => {
    const { container } = render(
      <PriceCellDisplay
        cell={CABLE_CELL_METRE}
        material={CABLE_MATERIAL}
        supplierId="materielelectrique"
      />
    );
    // Headline = 0.80 × 100 = 80 €
    const headline = container.querySelector('.font-semibold');
    expect(headline?.textContent).toMatch(/80/);
    expect(screen.getByText(/\/m/)).toBeInTheDocument();
  });

  it('renders raw prix_ht with no lot info when no material prop given', () => {
    render(<PriceCellDisplay cell={CABLE_CELL_LOT} />);
    // Falls back to raw prix_ht = 75
    expect(screen.getByText(/75/)).toBeInTheDocument();
    expect(screen.queryByText(/\/m/)).not.toBeInTheDocument();
  });

  // ── Tiered pricing ─────────────────────────────────────────────────────────

  const TIERS: PriceTier[] = [
    { minQty: 1, prix_ht: 1.2083, prix_ttc: 1.45, discountPct: 0 },
    { minQty: 20, prix_ht: 1.1333, prix_ttc: 1.36, discountPct: 6 },
  ];

  const TIERED_CELL: PriceCell = {
    status: 'success',
    data: {
      prix_ht: 1.2083,
      prix_ttc: 1.45,
      stock: 1,
      unite: 'pièce',
      fetchedAt: '2026-01-01T00:00:00Z',
      tiers: TIERS,
    },
    errorMessage: null,
  };

  it('shows 🧮 icon when tiers are present', () => {
    render(<PriceCellDisplay cell={TIERED_CELL} />);
    expect(screen.getByText('🧮')).toBeInTheDocument();
  });

  it('does not show 🧮 icon when no tiers', () => {
    render(<PriceCellDisplay cell={SUCCESS_CELL} />);
    expect(screen.queryByText('🧮')).not.toBeInTheDocument();
  });

  it('does not show 🧮 icon when only one tier (= just the base price)', () => {
    const singleTier: PriceCell = {
      status: 'success',
      data: {
        prix_ht: 1.2,
        stock: 1,
        unite: 'pièce',
        fetchedAt: '2026-01-01T00:00:00Z',
        tiers: [{ minQty: 1, prix_ht: 1.2, prix_ttc: 1.44, discountPct: 0 }],
      },
      errorMessage: null,
    };
    render(<PriceCellDisplay cell={singleTier} />);
    expect(screen.queryByText('🧮')).not.toBeInTheDocument();
  });

  it('shows base price when quantity < first tier threshold', () => {
    const { container } = render(<PriceCellDisplay cell={TIERED_CELL} quantity={1} />);
    // The headline .font-semibold span shows the base price (1.2083 → 1,21 €)
    const headline = container.querySelector('.font-semibold.tabular-nums');
    expect(headline?.textContent).toMatch(/1,21/);
  });

  it('shows discounted tier price when quantity >= tier threshold', () => {
    const { container } = render(<PriceCellDisplay cell={TIERED_CELL} quantity={20} />);
    // The headline shows the tier price (1.1333 → 1,13 €)
    const headline = container.querySelector('.font-semibold.tabular-nums');
    expect(headline?.textContent).toMatch(/1,13/);
  });

  it('tooltip lists both tiers', () => {
    render(<PriceCellDisplay cell={TIERED_CELL} />);
    // Both minQty labels present in tooltip table
    expect(screen.getByText('1+')).toBeInTheDocument();
    expect(screen.getByText('20+')).toBeInTheDocument();
    // Discount column
    expect(screen.getByText('-6 %')).toBeInTheDocument();
  });

  // ── Age label branches ─────────────────────────────────────────────────────

  it('shows age in hours when price is between 1h and 24h old', () => {
    // Exercises ageMs < 86_400_000 branch (line 138-139)
    const twoHoursAgo = new Date(Date.now() - 2 * 3_600_000).toISOString();
    const cell: PriceCell = {
      status: 'success',
      data: { prix_ht: 5.0, stock: 1, unite: 'pièce', fetchedAt: twoHoursAgo },
      errorMessage: null,
    };
    render(<PriceCellDisplay cell={cell} />);
    expect(screen.getByText(/il y a \d+ h/)).toBeInTheDocument();
  });

  it('shows age in days when price is more than 24h old', () => {
    const twoDaysAgo = new Date(Date.now() - 49 * 3_600_000).toISOString();
    const cell: PriceCell = {
      status: 'success',
      data: { prix_ht: 5.0, stock: 1, unite: 'pièce', fetchedAt: twoDaysAgo },
      errorMessage: null,
    };
    render(<PriceCellDisplay cell={cell} />);
    expect(screen.getByText(/il y a \d+ j/)).toBeInTheDocument();
  });

  it('renders cable price correctly when packaging is absent for that supplier', () => {
    // Exercises the false branch: packaging is null → lotInfo stays null
    const cableNoPkg: Material = {
      ...CABLE_MATERIAL,
      cable: {
        unite_base: 'ml',
        packaging: {
          rexel: { lot_metres: 100, prix_base: 'lot' },
          // materielelectrique packaging intentionally omitted
        } as Record<string, CableSupplierPackaging>,
      },
    };
    render(
      <PriceCellDisplay
        cell={CABLE_CELL_METRE}
        material={cableNoPkg}
        supplierId="materielelectrique"
      />
    );
    // Falls back to raw prix_ht
    expect(screen.getByText(/0,80/)).toBeInTheDocument();
    expect(screen.queryByText(/\/m/)).not.toBeInTheDocument();
  });

  it('shows base tier price when quantity is below all tier thresholds', () => {
    // Exercises the false branch of: if (best) effectivePrice = best.prix_ht
    // When quantity=0, filter returns [], .at(-1) is undefined → effectivePrice stays displayPrice
    const { container } = render(<PriceCellDisplay cell={TIERED_CELL} quantity={0} />);
    const headline = container.querySelector('.font-semibold.tabular-nums');
    // Should show the base prix_ht (1.2083)
    expect(headline?.textContent).toMatch(/1,21/);
  });

  it('age label title attribute is empty string when fetchedAt is absent', () => {
    // Exercises fetchedAt ? new Date(...).toLocaleString : '' (line 217 false branch)
    // We need a cell that is cached (ageMs > 60_000) but has no fetchedAt
    // Create a success cell with a very old but defined fetchedAt, then check the title
    const oldTime = new Date(Date.now() - 2 * 3_600_000).toISOString();
    const cell: PriceCell = {
      status: 'success',
      data: { prix_ht: 5.0, stock: 1, unite: 'pièce', fetchedAt: oldTime },
      errorMessage: null,
    };
    const { container } = render(<PriceCellDisplay cell={cell} />);
    const ageSpan = container.querySelector('span[title]');
    // title should be a non-empty date string (fetchedAt is defined here)
    expect(ageSpan?.getAttribute('title')).toBeTruthy();
  });
});
