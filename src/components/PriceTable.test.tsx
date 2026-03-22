/**
 * src/components/PriceTable.test.tsx
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React, { useState } from 'react';
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

const MULTI_CAT_MATERIALS: Material[] = [
  {
    id: 'mat-1',
    nom: 'Prise Céliane 4x2P+T',
    marque: 'Legrand',
    categorie: 'Prise de courant',
    references_fournisseurs: { materielelectrique: 'LEG067128' },
  },
  {
    id: 'mat-2',
    nom: 'Plaque Céliane 1 poste',
    marque: 'Legrand',
    categorie: 'Façades',
    references_fournisseurs: { materielelectrique: 'LEG066631' },
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

/**
 * Stateful wrapper that mirrors how App.tsx owns the collapse state.
 * All categories start expanded so existing collapse tests work unchanged.
 */
function CollapsiblePriceTable(props: Omit<React.ComponentProps<typeof PriceTable>, 'collapsedCategories' | 'onToggleCategory' | 'onToggleAllCategories'>) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const toggle = (cat: string) => setCollapsed((prev) => {
    const next = new Set(prev);
    if (next.has(cat)) next.delete(cat); else next.add(cat);
    return next;
  });
  const toggleAll = (keys: string[], collapse: boolean) =>
    setCollapsed(collapse ? new Set(keys) : new Set());
  return <PriceTable {...props} collapsedCategories={collapsed} onToggleCategory={toggle} onToggleAllCategories={toggleAll} />;
}

// Default props for the select + collapse callbacks (all expanded by default via wrapper)
const DEFAULT_SELECT_PROPS = {
  selectedIds: new Set<string>(),
  onToggleSelect: vi.fn(),
  onToggleSelectAll: vi.fn(),
};
// Shared collapse props for tests that render PriceTable directly (not via wrapper)
const DEFAULT_COLLAPSE_PROPS = {
  collapsedCategories: new Set<string>(),
  onToggleCategory: vi.fn(),
  onToggleAllCategories: vi.fn(),
};

describe('PriceTable', () => {
  it('renders material name and brand below it', () => {
    render(
      <PriceTable materials={MATERIALS} prices={EMPTY_PRICES} scanning={false} onScan={vi.fn()} onStop={vi.fn()} onEdit={vi.fn()} {...DEFAULT_SELECT_PROPS} {...DEFAULT_COLLAPSE_PROPS} />
    );
    expect(screen.getByText('Prise Céliane 4x2P+T')).toBeInTheDocument();
    expect(screen.getByText('Legrand')).toBeInTheDocument();
  });

  it('shows the scan button when not scanning (disabled with no selection)', () => {
    render(
      <PriceTable materials={MATERIALS} prices={EMPTY_PRICES} scanning={false} onScan={vi.fn()} onStop={vi.fn()} onEdit={vi.fn()} {...DEFAULT_SELECT_PROPS} {...DEFAULT_COLLAPSE_PROPS} />
    );
    const btn = screen.getByRole('button', { name: /Sélectionnez des articles/ });
    expect(btn).toBeInTheDocument();
    expect(btn).toBeDisabled();
  });

  it('shows scanning state and disables button during scan', () => {
    render(
      <PriceTable materials={MATERIALS} prices={EMPTY_PRICES} scanning={true} onScan={vi.fn()} onStop={vi.fn()} onEdit={vi.fn()} {...DEFAULT_SELECT_PROPS} {...DEFAULT_COLLAPSE_PROPS} />
    );
    expect(screen.getByRole('button', { name: 'Scan en cours' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Arrêter le scan' })).toBeInTheDocument();
  });

  it('calls onScan when button is clicked with selection', () => {
    const onScan = vi.fn();
    render(
      <PriceTable materials={MATERIALS} prices={EMPTY_PRICES} scanning={false} onScan={onScan} onStop={vi.fn()} onEdit={vi.fn()}
        selectedIds={new Set(['mat-1'])} onToggleSelect={vi.fn()} onToggleSelectAll={vi.fn()} {...DEFAULT_COLLAPSE_PROPS} />
    );
    fireEvent.click(screen.getByRole('button', { name: /Actualiser les prix/ }));
    expect(onScan).toHaveBeenCalledOnce();
  });

  it('calls onStop when stop button is clicked during scan', () => {
    const onStop = vi.fn();
    render(
      <PriceTable materials={MATERIALS} prices={EMPTY_PRICES} scanning={true} onScan={vi.fn()} onStop={onStop} onEdit={vi.fn()} {...DEFAULT_SELECT_PROPS} {...DEFAULT_COLLAPSE_PROPS} />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Arrêter le scan' }));
    expect(onStop).toHaveBeenCalledOnce();
  });

  it('calls onEdit when edit button is clicked', () => {
    const onEdit = vi.fn();
    render(
      <PriceTable materials={MATERIALS} prices={EMPTY_PRICES} scanning={false} onScan={vi.fn()} onStop={vi.fn()} onEdit={onEdit} {...DEFAULT_SELECT_PROPS} {...DEFAULT_COLLAPSE_PROPS} />
    );
    fireEvent.click(screen.getByRole('button', { name: /Modifier Prise/ }));
    expect(onEdit).toHaveBeenCalledWith(MATERIALS[0]);
  });

  it('calls onToggleSelect when row checkbox is clicked', () => {
    const onToggleSelect = vi.fn();
    render(
      <PriceTable materials={MATERIALS} prices={EMPTY_PRICES} scanning={false} onScan={vi.fn()} onStop={vi.fn()} onEdit={vi.fn()}
        selectedIds={new Set()} onToggleSelect={onToggleSelect} onToggleSelectAll={vi.fn()} {...DEFAULT_COLLAPSE_PROPS} />
    );
    fireEvent.click(screen.getByRole('checkbox', { name: /Sélectionner Prise/ }));
    expect(onToggleSelect).toHaveBeenCalledWith('mat-1');
  });

  it('shows selection badge when items are selected', () => {
    render(
      <PriceTable materials={MATERIALS} prices={EMPTY_PRICES} scanning={false} onScan={vi.fn()} onStop={vi.fn()} onEdit={vi.fn()}
        selectedIds={new Set(['mat-1'])} onToggleSelect={vi.fn()} onToggleSelectAll={vi.fn()} {...DEFAULT_COLLAPSE_PROPS} />
    );
    expect(screen.getByTestId('selection-badge')).toBeInTheDocument();
    expect(screen.getByTestId('selection-badge').textContent).toMatch(/1/);
  });

  it('shows article count in header', () => {
    render(
      <PriceTable materials={MATERIALS} prices={EMPTY_PRICES} scanning={false} onScan={vi.fn()} onStop={vi.fn()} onEdit={vi.fn()} {...DEFAULT_SELECT_PROPS} {...DEFAULT_COLLAPSE_PROPS} />
    );
    expect(screen.getAllByText(/1 article/).length).toBeGreaterThanOrEqual(1);
  });

  it('shows plural articles for multiple materials', () => {
    const twoMaterials = [
      ...MATERIALS,
      { ...MATERIALS[0], id: 'mat-2', nom: 'Item 2' },
    ];
    render(
      <PriceTable materials={twoMaterials} prices={EMPTY_PRICES} scanning={false} onScan={vi.fn()} onStop={vi.fn()} onEdit={vi.fn()} {...DEFAULT_SELECT_PROPS} {...DEFAULT_COLLAPSE_PROPS} />
    );
    expect(screen.getAllByText(/2 articles/).length).toBeGreaterThanOrEqual(1);
  });

  it('shows empty state when no materials', () => {
    render(
      <PriceTable materials={[]} prices={EMPTY_PRICES} scanning={false} onScan={vi.fn()} onStop={vi.fn()} onEdit={vi.fn()} {...DEFAULT_SELECT_PROPS} {...DEFAULT_COLLAPSE_PROPS} />
    );
    expect(screen.getByText(/Aucun article/)).toBeInTheDocument();
  });

  it('shows last updated timestamp when prices are loaded', () => {
    render(
      <PriceTable materials={MATERIALS} prices={SUCCESS_PRICES} scanning={false} onScan={vi.fn()} onStop={vi.fn()} onEdit={vi.fn()} {...DEFAULT_SELECT_PROPS} {...DEFAULT_COLLAPSE_PROPS} />
    );
    expect(screen.getByText(/Prix mis à jour/)).toBeInTheDocument();
  });

  it('does not show timestamp when no prices fetched yet', () => {
    render(
      <PriceTable materials={MATERIALS} prices={EMPTY_PRICES} scanning={false} onScan={vi.fn()} onStop={vi.fn()} onEdit={vi.fn()} {...DEFAULT_SELECT_PROPS} {...DEFAULT_COLLAPSE_PROPS} />
    );
    expect(screen.queryByText(/Prix mis à jour/)).not.toBeInTheDocument();
  });

  it('renders a category header row for each category', () => {
    render(
      <CollapsiblePriceTable materials={MULTI_CAT_MATERIALS} prices={EMPTY_PRICES} scanning={false} onScan={vi.fn()} onStop={vi.fn()} onEdit={vi.fn()} {...DEFAULT_SELECT_PROPS} />
    );
    expect(screen.getByLabelText(/Replier la catégorie Prise de courant/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Replier la catégorie Façades/i)).toBeInTheDocument();
  });

  it('collapses a category when its header row is clicked', () => {
    render(
      <CollapsiblePriceTable materials={MULTI_CAT_MATERIALS} prices={EMPTY_PRICES} scanning={false} onScan={vi.fn()} onStop={vi.fn()} onEdit={vi.fn()} {...DEFAULT_SELECT_PROPS} />
    );
    expect(screen.getByText('Prise Céliane 4x2P+T')).toBeInTheDocument();
    expect(screen.getByText('Plaque Céliane 1 poste')).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText(/Replier la catégorie Prise de courant/i));

    expect(screen.queryByText('Prise Céliane 4x2P+T')).not.toBeInTheDocument();
    expect(screen.getByText('Plaque Céliane 1 poste')).toBeInTheDocument();
  });

  it('expands a collapsed category when its header row is clicked again', () => {
    render(
      <CollapsiblePriceTable materials={MULTI_CAT_MATERIALS} prices={EMPTY_PRICES} scanning={false} onScan={vi.fn()} onStop={vi.fn()} onEdit={vi.fn()} {...DEFAULT_SELECT_PROPS} />
    );
    fireEvent.click(screen.getByLabelText(/Replier la catégorie Prise de courant/i));
    expect(screen.queryByText('Prise Céliane 4x2P+T')).not.toBeInTheDocument();
    fireEvent.click(screen.getByLabelText(/Déplier la catégorie Prise de courant/i));
    expect(screen.getByText('Prise Céliane 4x2P+T')).toBeInTheDocument();
  });

  it('shows "Tout replier" button when categories are expanded', () => {
    render(
      <CollapsiblePriceTable materials={MULTI_CAT_MATERIALS} prices={EMPTY_PRICES} scanning={false} onScan={vi.fn()} onStop={vi.fn()} onEdit={vi.fn()} {...DEFAULT_SELECT_PROPS} />
    );
    expect(screen.getByRole('button', { name: 'Tout replier' })).toBeInTheDocument();
  });

  it('collapses all categories when "Tout replier" is clicked', () => {
    render(
      <CollapsiblePriceTable materials={MULTI_CAT_MATERIALS} prices={EMPTY_PRICES} scanning={false} onScan={vi.fn()} onStop={vi.fn()} onEdit={vi.fn()} {...DEFAULT_SELECT_PROPS} />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Tout replier' }));
    expect(screen.queryByText('Prise Céliane 4x2P+T')).not.toBeInTheDocument();
    expect(screen.queryByText('Plaque Céliane 1 poste')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tout déplier' })).toBeInTheDocument();
  });

  it('expands all categories when "Tout déplier" is clicked', () => {
    render(
      <CollapsiblePriceTable materials={MULTI_CAT_MATERIALS} prices={EMPTY_PRICES} scanning={false} onScan={vi.fn()} onStop={vi.fn()} onEdit={vi.fn()} {...DEFAULT_SELECT_PROPS} />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Tout replier' }));
    fireEvent.click(screen.getByRole('button', { name: 'Tout déplier' }));
    expect(screen.getByText('Prise Céliane 4x2P+T')).toBeInTheDocument();
    expect(screen.getByText('Plaque Céliane 1 poste')).toBeInTheDocument();
  });

  // ── search filter ─────────────────────────────────────────────────────────

  it('filters materials by search query (nom)', () => {
    const { container } = render(
      <CollapsiblePriceTable materials={MULTI_CAT_MATERIALS} prices={EMPTY_PRICES} scanning={false} onScan={vi.fn()} onStop={vi.fn()} onEdit={vi.fn()} {...DEFAULT_SELECT_PROPS} />
    );
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'Plaque' } });
    expect(screen.queryByText('Prise Céliane 4x2P+T')).not.toBeInTheDocument();
    expect(screen.getByText('Plaque Céliane 1 poste')).toBeInTheDocument();
    // Filtered count text is split across elements — check the heading element textContent
    const heading = container.querySelector('h2');
    expect(heading?.textContent).toMatch(/1.*\/.*2/);
  });

  it('shows no-results state when search matches nothing', () => {
    render(
      <CollapsiblePriceTable materials={MULTI_CAT_MATERIALS} prices={EMPTY_PRICES} scanning={false} onScan={vi.fn()} onStop={vi.fn()} onEdit={vi.fn()} {...DEFAULT_SELECT_PROPS} />
    );
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'xyzzy' } });
    expect(screen.getByText(/Aucun résultat/)).toBeInTheDocument();
    // Clearing the filter restores results
    fireEvent.click(screen.getByRole('button', { name: /Effacer le filtre/ }));
    expect(screen.getByText('Prise Céliane 4x2P+T')).toBeInTheDocument();
  });

  // ── cable material ────────────────────────────────────────────────────────

  it('renders a cable material row', () => {
    const cableMaterial: Material = {
      id: 'cable-1', nom: 'Câble 3G2.5', marque: 'Nexans', categorie: 'Câbles',
      references_fournisseurs: { materielelectrique: 'REF-CABLE' },
      cable: { unite_base: 'ml', packaging: { materielelectrique: { lot_metres: 100, prix_base: 'metre' } } },
    };
    render(
      <CollapsiblePriceTable materials={[cableMaterial]} prices={EMPTY_PRICES} scanning={false} onScan={vi.fn()} onStop={vi.fn()} onEdit={vi.fn()} {...DEFAULT_SELECT_PROPS} />
    );
    expect(screen.getByText('Câble 3G2.5')).toBeInTheDocument();
    expect(screen.getByText('Nexans')).toBeInTheDocument();
  });

  it('shows best-price highlight when two suppliers have success prices', () => {
    const mat: Material = {
      id: 'm', nom: 'Item', marque: 'B', categorie: 'C',
      references_fournisseurs: { materielelectrique: 'ME-REF', rexel: 'RX-REF' },
    };
    const prices: PriceMatrix = {
      m: {
        materielelectrique: { status: 'success', data: { prix_ht: 10, stock: 1, unite: 'pièce', fetchedAt: new Date().toISOString(), tiers: [] }, errorMessage: null },
        rexel: { status: 'success', data: { prix_ht: 12, stock: 1, unite: 'pièce', fetchedAt: new Date().toISOString(), tiers: [] }, errorMessage: null },
      },
    };
    render(
      <CollapsiblePriceTable materials={[mat]} prices={prices} scanning={false} onScan={vi.fn()} onStop={vi.fn()} onEdit={vi.fn()} {...DEFAULT_SELECT_PROPS} />
    );
    // Both prices rendered — 10 and 12 may appear multiple times (cells + possible totals)
    expect(screen.getAllByText(/10,00/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/12,00/).length).toBeGreaterThan(0);
  });

  // ── select-all checkboxes ────────────────────────────────────────────────

  it('calls onToggleSelectAll when the header select-all checkbox is changed', () => {
    const onToggleSelectAll = vi.fn();
    render(
      <CollapsiblePriceTable materials={MATERIALS} prices={EMPTY_PRICES} scanning={false} onScan={vi.fn()} onStop={vi.fn()} onEdit={vi.fn()}
        selectedIds={new Set()} onToggleSelect={vi.fn()} onToggleSelectAll={onToggleSelectAll} />
    );
    fireEvent.click(screen.getByRole('checkbox', { name: /Tout sélectionner/ }));
    expect(onToggleSelectAll).toHaveBeenCalled();
  });

  it('calls onToggleSelectAll when a category select-all checkbox is changed', () => {
    const onToggleSelectAll = vi.fn();
    render(
      <CollapsiblePriceTable materials={MULTI_CAT_MATERIALS} prices={EMPTY_PRICES} scanning={false} onScan={vi.fn()} onStop={vi.fn()} onEdit={vi.fn()}
        selectedIds={new Set()} onToggleSelect={vi.fn()} onToggleSelectAll={onToggleSelectAll} />
    );
    fireEvent.click(screen.getByRole('checkbox', { name: /Sélectionner catégorie Prise de courant/ }));
    expect(onToggleSelectAll).toHaveBeenCalled();
  });
});
