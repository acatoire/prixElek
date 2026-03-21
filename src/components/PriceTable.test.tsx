/**
 * src/components/PriceTable.test.tsx
 */
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

// Default props for the new checkbox props
const DEFAULT_SELECT_PROPS = {
  selectedIds: new Set<string>(),
  onToggleSelect: vi.fn(),
  onToggleSelectAll: vi.fn(),
};

describe('PriceTable', () => {
  it('renders material name and brand', () => {
    render(
      <PriceTable materials={MATERIALS} prices={EMPTY_PRICES} scanning={false} onScan={vi.fn()} onStop={vi.fn()} onEdit={vi.fn()} {...DEFAULT_SELECT_PROPS} />
    );
    expect(screen.getByText('Prise Céliane 4x2P+T')).toBeInTheDocument();
    expect(screen.getByText('Legrand')).toBeInTheDocument();
  });

  it('shows the scan button when not scanning', () => {
    render(
      <PriceTable materials={MATERIALS} prices={EMPTY_PRICES} scanning={false} onScan={vi.fn()} onStop={vi.fn()} onEdit={vi.fn()} {...DEFAULT_SELECT_PROPS} />
    );
    expect(screen.getByText(/Actualiser les prix/)).toBeInTheDocument();
  });

  it('shows scanning state and disables button during scan', () => {
    render(
      <PriceTable materials={MATERIALS} prices={EMPTY_PRICES} scanning={true} onScan={vi.fn()} onStop={vi.fn()} onEdit={vi.fn()} {...DEFAULT_SELECT_PROPS} />
    );
    const scanBtn = screen.getByText(/Scan en cours/).closest('button') as HTMLButtonElement;
    expect(scanBtn).toBeDisabled();
    expect(screen.getByText(/Arrêter/)).toBeInTheDocument();
  });

  it('calls onScan when button is clicked', () => {
    const onScan = vi.fn();
    render(
      <PriceTable materials={MATERIALS} prices={EMPTY_PRICES} scanning={false} onScan={onScan} onStop={vi.fn()} onEdit={vi.fn()} {...DEFAULT_SELECT_PROPS} />
    );
    fireEvent.click(screen.getByText(/Actualiser les prix/).closest('button')!);
    expect(onScan).toHaveBeenCalledOnce();
  });

  it('calls onStop when stop button is clicked during scan', () => {
    const onStop = vi.fn();
    render(
      <PriceTable materials={MATERIALS} prices={EMPTY_PRICES} scanning={true} onScan={vi.fn()} onStop={onStop} onEdit={vi.fn()} {...DEFAULT_SELECT_PROPS} />
    );
    fireEvent.click(screen.getByText(/Arrêter/).closest('button')!);
    expect(onStop).toHaveBeenCalledOnce();
  });

  it('calls onEdit when edit button is clicked', () => {
    const onEdit = vi.fn();
    render(
      <PriceTable materials={MATERIALS} prices={EMPTY_PRICES} scanning={false} onScan={vi.fn()} onStop={vi.fn()} onEdit={onEdit} {...DEFAULT_SELECT_PROPS} />
    );
    fireEvent.click(screen.getByRole('button', { name: /Modifier Prise/ }));
    expect(onEdit).toHaveBeenCalledWith(MATERIALS[0]);
  });

  it('calls onToggleSelect when row checkbox is clicked', () => {
    const onToggleSelect = vi.fn();
    render(
      <PriceTable materials={MATERIALS} prices={EMPTY_PRICES} scanning={false} onScan={vi.fn()} onStop={vi.fn()} onEdit={vi.fn()}
        selectedIds={new Set()} onToggleSelect={onToggleSelect} onToggleSelectAll={vi.fn()} />
    );
    fireEvent.click(screen.getByRole('checkbox', { name: /Sélectionner Prise/ }));
    expect(onToggleSelect).toHaveBeenCalledWith('mat-1');
  });

  it('shows selection badge when items are selected', () => {
    render(
      <PriceTable materials={MATERIALS} prices={EMPTY_PRICES} scanning={false} onScan={vi.fn()} onStop={vi.fn()} onEdit={vi.fn()}
        selectedIds={new Set(['mat-1'])} onToggleSelect={vi.fn()} onToggleSelectAll={vi.fn()} />
    );
    expect(screen.getByTestId('selection-badge')).toBeInTheDocument();
    expect(screen.getByTestId('selection-badge').textContent).toMatch(/1/);
  });

  it('shows article count in header', () => {
    render(
      <PriceTable materials={MATERIALS} prices={EMPTY_PRICES} scanning={false} onScan={vi.fn()} onStop={vi.fn()} onEdit={vi.fn()} {...DEFAULT_SELECT_PROPS} />
    );
    // "1 article" appears in toolbar title and in the category header row
    expect(screen.getAllByText(/1 article/).length).toBeGreaterThanOrEqual(1);
  });

  it('shows plural articles for multiple materials', () => {
    const twoMaterials = [
      ...MATERIALS,
      { ...MATERIALS[0], id: 'mat-2', nom: 'Item 2' },
    ];
    render(
      <PriceTable materials={twoMaterials} prices={EMPTY_PRICES} scanning={false} onScan={vi.fn()} onStop={vi.fn()} onEdit={vi.fn()} {...DEFAULT_SELECT_PROPS} />
    );
    // toolbar shows "2 articles"; category header also shows "2 articles"
    expect(screen.getAllByText(/2 articles/).length).toBeGreaterThanOrEqual(1);
  });

  it('shows empty state when no materials', () => {
    render(
      <PriceTable materials={[]} prices={EMPTY_PRICES} scanning={false} onScan={vi.fn()} onStop={vi.fn()} onEdit={vi.fn()} {...DEFAULT_SELECT_PROPS} />
    );
    expect(screen.getByText(/Aucun article/)).toBeInTheDocument();
  });

  it('shows last updated timestamp when prices are loaded', () => {
    render(
      <PriceTable materials={MATERIALS} prices={SUCCESS_PRICES} scanning={false} onScan={vi.fn()} onStop={vi.fn()} onEdit={vi.fn()} {...DEFAULT_SELECT_PROPS} />
    );
    expect(screen.getByText(/Prix mis à jour/)).toBeInTheDocument();
  });

  it('does not show timestamp when no prices fetched yet', () => {
    render(
      <PriceTable materials={MATERIALS} prices={EMPTY_PRICES} scanning={false} onScan={vi.fn()} onStop={vi.fn()} onEdit={vi.fn()} {...DEFAULT_SELECT_PROPS} />
    );
    expect(screen.queryByText(/Prix mis à jour/)).not.toBeInTheDocument();
  });

  it('renders a category header row for each category', () => {
    render(
      <PriceTable materials={MULTI_CAT_MATERIALS} prices={EMPTY_PRICES} scanning={false} onScan={vi.fn()} onStop={vi.fn()} onEdit={vi.fn()} {...DEFAULT_SELECT_PROPS} />
    );
    expect(screen.getByLabelText(/Replier la catégorie Prise de courant/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Replier la catégorie Façades/i)).toBeInTheDocument();
  });

  it('collapses a category when its header row is clicked', () => {
    render(
      <PriceTable materials={MULTI_CAT_MATERIALS} prices={EMPTY_PRICES} scanning={false} onScan={vi.fn()} onStop={vi.fn()} onEdit={vi.fn()} {...DEFAULT_SELECT_PROPS} />
    );
    // Both items visible initially
    expect(screen.getByText('Prise Céliane 4x2P+T')).toBeInTheDocument();
    expect(screen.getByText('Plaque Céliane 1 poste')).toBeInTheDocument();

    // Click the "Prise de courant" category header
    fireEvent.click(screen.getByLabelText(/Replier la catégorie Prise de courant/i));

    // First item hidden, second still visible
    expect(screen.queryByText('Prise Céliane 4x2P+T')).not.toBeInTheDocument();
    expect(screen.getByText('Plaque Céliane 1 poste')).toBeInTheDocument();
  });

  it('expands a collapsed category when its header row is clicked again', () => {
    render(
      <PriceTable materials={MULTI_CAT_MATERIALS} prices={EMPTY_PRICES} scanning={false} onScan={vi.fn()} onStop={vi.fn()} onEdit={vi.fn()} {...DEFAULT_SELECT_PROPS} />
    );
    const header = screen.getByLabelText(/Replier la catégorie Prise de courant/i);
    fireEvent.click(header); // collapse
    expect(screen.queryByText('Prise Céliane 4x2P+T')).not.toBeInTheDocument();
    fireEvent.click(screen.getByLabelText(/Déplier la catégorie Prise de courant/i)); // expand
    expect(screen.getByText('Prise Céliane 4x2P+T')).toBeInTheDocument();
  });

  it('shows "Tout replier" button when categories are expanded', () => {
    render(
      <PriceTable materials={MULTI_CAT_MATERIALS} prices={EMPTY_PRICES} scanning={false} onScan={vi.fn()} onStop={vi.fn()} onEdit={vi.fn()} {...DEFAULT_SELECT_PROPS} />
    );
    expect(screen.getByRole('button', { name: 'Tout replier' })).toBeInTheDocument();
  });

  it('collapses all categories when "Tout replier" is clicked', () => {
    render(
      <PriceTable materials={MULTI_CAT_MATERIALS} prices={EMPTY_PRICES} scanning={false} onScan={vi.fn()} onStop={vi.fn()} onEdit={vi.fn()} {...DEFAULT_SELECT_PROPS} />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Tout replier' }));
    expect(screen.queryByText('Prise Céliane 4x2P+T')).not.toBeInTheDocument();
    expect(screen.queryByText('Plaque Céliane 1 poste')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tout déplier' })).toBeInTheDocument();
  });

  it('expands all categories when "Tout déplier" is clicked', () => {
    render(
      <PriceTable materials={MULTI_CAT_MATERIALS} prices={EMPTY_PRICES} scanning={false} onScan={vi.fn()} onStop={vi.fn()} onEdit={vi.fn()} {...DEFAULT_SELECT_PROPS} />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Tout replier' }));
    fireEvent.click(screen.getByRole('button', { name: 'Tout déplier' }));
    expect(screen.getByText('Prise Céliane 4x2P+T')).toBeInTheDocument();
    expect(screen.getByText('Plaque Céliane 1 poste')).toBeInTheDocument();
  });
});

