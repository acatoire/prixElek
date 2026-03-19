/**
 * src/components/PriceTable.test.tsx
 */
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PriceTable } from './PriceTable';
import type { Material } from '@/types/material';
import type { PriceMatrix } from '@/types/price';

const MATERIALS: Material[] = [
  {
    id: 'mat-1',
    nom: 'Prise Céliane 4x2P+T',
    marque: 'Legrand',
    categorie: 'Prise de courant',
    references_fournisseurs: { materielelectrique: 'LEG067128' },
  },
];

const EMPTY_PRICES: PriceMatrix = {};

const SUCCESS_PRICES: PriceMatrix = {
  'mat-1': {
    materielelectrique: {
      status: 'success',
      data: { prix_ht: 18.64, stock: 1, unite: 'pièce', fetchedAt: '2026-01-01T10:30:00Z' },
      errorMessage: null,
    },
  },
};

describe('PriceTable', () => {
  it('renders material name, brand and category', () => {
    render(

      <PriceTable materials={MATERIALS} prices={EMPTY_PRICES} scanning={false} onScan={vi.fn()} onStop={vi.fn()} onEdit={vi.fn()} />
    );
    expect(screen.getByText('Prise Céliane 4x2P+T')).toBeInTheDocument();
    expect(screen.getByText('Legrand')).toBeInTheDocument();
    expect(screen.getByText('Prise de courant')).toBeInTheDocument();
  });

  it('shows the scan button when not scanning', () => {
    render(
      <PriceTable materials={MATERIALS} prices={EMPTY_PRICES} scanning={false} onScan={vi.fn()} onStop={vi.fn()} onEdit={vi.fn()} />
    );
    expect(screen.getByText(/Actualiser les prix/)).toBeInTheDocument();
  });

  it('shows scanning state and disables button during scan', () => {
    render(
      <PriceTable materials={MATERIALS} prices={EMPTY_PRICES} scanning={true} onScan={vi.fn()} onStop={vi.fn()} onEdit={vi.fn()} />
    );
    // During scan there are two buttons: "Arrêter" (enabled) and "Scan en cours…" (disabled)
    const scanBtn = screen.getByText(/Scan en cours/).closest('button') as HTMLButtonElement;
    expect(scanBtn).toBeDisabled();
    expect(screen.getByText(/Arrêter/)).toBeInTheDocument();
  });

  it('calls onScan when button is clicked', () => {
    const onScan = vi.fn();
    render(
      <PriceTable materials={MATERIALS} prices={EMPTY_PRICES} scanning={false} onScan={onScan} onStop={vi.fn()} onEdit={vi.fn()} />
    );
    fireEvent.click(screen.getByText(/Actualiser les prix/).closest('button')!);
    expect(onScan).toHaveBeenCalledOnce();
  });

  it('calls onStop when stop button is clicked during scan', () => {
    const onStop = vi.fn();
    render(
      <PriceTable materials={MATERIALS} prices={EMPTY_PRICES} scanning={true} onScan={vi.fn()} onStop={onStop} onEdit={vi.fn()} />
    );
    fireEvent.click(screen.getByText(/Arrêter/).closest('button')!);
    expect(onStop).toHaveBeenCalledOnce();
  });

  it('calls onEdit when edit button is clicked', () => {
    const onEdit = vi.fn();
    render(
      <PriceTable materials={MATERIALS} prices={EMPTY_PRICES} scanning={false} onScan={vi.fn()} onStop={vi.fn()} onEdit={onEdit} />
    );
    fireEvent.click(screen.getByRole('button', { name: /Modifier Prise/ }));
    expect(onEdit).toHaveBeenCalledWith(MATERIALS[0]);
  });

  it('shows article count in header', () => {
    render(
      <PriceTable materials={MATERIALS} prices={EMPTY_PRICES} scanning={false} onScan={vi.fn()} onStop={vi.fn()} onEdit={vi.fn()} />
    );
    expect(screen.getByText(/1 article/)).toBeInTheDocument();
  });

  it('shows plural articles for multiple materials', () => {
    const twoMaterials = [
      ...MATERIALS,
      { ...MATERIALS[0], id: 'mat-2', nom: 'Item 2' },
    ];
    render(
      <PriceTable materials={twoMaterials} prices={EMPTY_PRICES} scanning={false} onScan={vi.fn()} onStop={vi.fn()} onEdit={vi.fn()} />
    );
    expect(screen.getByText(/2 articles/)).toBeInTheDocument();
  });

  it('shows empty state when no materials', () => {
    render(
      <PriceTable materials={[]} prices={EMPTY_PRICES} scanning={false} onScan={vi.fn()} onStop={vi.fn()} onEdit={vi.fn()} />
    );
    expect(screen.getByText(/Aucun article/)).toBeInTheDocument();
  });

  it('shows last updated timestamp when prices are loaded', () => {
    render(
      <PriceTable materials={MATERIALS} prices={SUCCESS_PRICES} scanning={false} onScan={vi.fn()} onStop={vi.fn()} onEdit={vi.fn()} />
    );
    expect(screen.getByText(/Prix mis à jour/)).toBeInTheDocument();
  });

  it('does not show timestamp when no prices fetched yet', () => {
    render(
      <PriceTable materials={MATERIALS} prices={EMPTY_PRICES} scanning={false} onScan={vi.fn()} onStop={vi.fn()} onEdit={vi.fn()} />
    );
    expect(screen.queryByText(/Prix mis à jour/)).not.toBeInTheDocument();
  });
});

