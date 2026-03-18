/**
 * src/components/PriceCellDisplay.test.tsx
 */
import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PriceCellDisplay } from './PriceCellDisplay';
import type { PriceCell } from '@/types/price';

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
      <PriceCellDisplay
        cell={{ status: 'error', data: null, errorMessage: 'Network fail' }}
      />
    );
    expect(screen.getByText(/Indisponible/)).toBeInTheDocument();
  });

  it('renders price and En stock when in stock', () => {
    render(<PriceCellDisplay cell={SUCCESS_CELL} />);
    expect(screen.getByText(/18/)).toBeInTheDocument();
    expect(screen.getByText('En stock')).toBeInTheDocument();
  });

  it('renders Sur commande when stock is 0', () => {
    render(<PriceCellDisplay cell={OUT_OF_STOCK_CELL} />);
    expect(screen.getByText('Sur commande')).toBeInTheDocument();
  });

  it('renders — when price is null in a success cell', () => {
    render(<PriceCellDisplay cell={NULL_PRICE_CELL} />);
    expect(screen.getByText('—')).toBeInTheDocument();
  });
});

