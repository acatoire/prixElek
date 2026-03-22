/**
 * src/components/CommandeTab.test.tsx
 *
 * Tests for the Commande (order) tab component.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CommandeTab } from './CommandeTab';
import type { Material } from '@/types/material';
import type { PriceMatrix } from '@/types/price';
import type { UseCommandeReturn } from '@/hooks/useCommande';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const MAT: Material = {
  id: 'mat-1', nom: 'Prise Céliane', marque: 'Legrand', categorie: 'Prise de courant',
  references_fournisseurs: { materielelectrique: 'LEG067128', rexel: null, bricodepot: null },
};

const MAT2: Material = {
  id: 'mat-2', nom: 'Plaque Céliane', marque: 'Legrand', categorie: 'Façades',
  references_fournisseurs: { materielelectrique: 'LEG066631', rexel: null, bricodepot: null },
};

const CABLE_MAT: Material = {
  id: 'cable-1', nom: 'Câble 3G2.5', marque: 'Nexans', categorie: 'cables',
  references_fournisseurs: { materielelectrique: 'REF-CABLE', rexel: null, bricodepot: null },
  cable: {
    unite_base: 'ml',
    packaging: { materielelectrique: { lot_metres: 100, prix_base: 'metre' }, rexel: { lot_metres: 100, prix_base: 'lot' } },
  },
};

const EMPTY_PRICES: PriceMatrix = {};

const SUCCESS_PRICES: PriceMatrix = {
  'mat-1': {
    materielelectrique: { status: 'success', data: { prix_ht: 10.0, stock: 1, unite: 'pièce', fetchedAt: new Date().toISOString(), tiers: [] }, errorMessage: null },
  },
  'mat-2': {
    materielelectrique: { status: 'success', data: { prix_ht: 2.0, stock: 1, unite: 'pièce', fetchedAt: new Date().toISOString(), tiers: [] }, errorMessage: null },
  },
};

const TIERED_PRICES: PriceMatrix = {
  'mat-1': {
    materielelectrique: {
      status: 'success',
      data: {
        prix_ht: 1.2083, stock: 1, unite: 'pièce', fetchedAt: new Date().toISOString(),
        tiers: [
          { minQty: 1, prix_ht: 1.2083, prix_ttc: 1.45, discountPct: 0 },
          { minQty: 20, prix_ht: 1.1333, prix_ttc: 1.36, discountPct: 6 },
        ],
      },
      errorMessage: null,
    },
  },
};

function makeCommande(
  selectedIds: string[] = [],
  quantities: Record<string, number> = {},
): UseCommandeReturn {
  return {
    selectedIds: new Set(selectedIds),
    quantities,
    toggleSelected: vi.fn(),
    setAllSelected: vi.fn(),
    setQuantity: vi.fn(),
    removeItem: vi.fn(),
    exportOrder: vi.fn(),
    importOrder: vi.fn(),
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('CommandeTab', () => {
  it('shows empty state when no items are selected', () => {
    render(
      <CommandeTab materials={[MAT]} prices={EMPTY_PRICES} commande={makeCommande()} scanning={false} onScan={vi.fn()} onStop={vi.fn()} />
    );
    expect(screen.getByText(/Aucun article sélectionné/)).toBeInTheDocument();
  });

  it('shows load button in the empty state', () => {
    render(
      <CommandeTab materials={[MAT]} prices={EMPTY_PRICES} commande={makeCommande()} scanning={false} onScan={vi.fn()} onStop={vi.fn()} />
    );
    // The 📂 button is present
    expect(screen.getByTitle(/Charger une commande/)).toBeInTheDocument();
  });

  it('shows the order table when items are selected', () => {
    render(
      <CommandeTab materials={[MAT]} prices={EMPTY_PRICES} commande={makeCommande(['mat-1'], { 'mat-1': 1 })} scanning={false} onScan={vi.fn()} onStop={vi.fn()} />
    );
    expect(screen.getByText('Prise Céliane')).toBeInTheDocument();
  });

  it('renders idle price cells as —', () => {
    render(
      <CommandeTab materials={[MAT]} prices={EMPTY_PRICES} commande={makeCommande(['mat-1'], { 'mat-1': 1 })} scanning={false} onScan={vi.fn()} onStop={vi.fn()} />
    );
    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
  });

  it('shows success price × qty in the cell', () => {
    render(
      <CommandeTab materials={[MAT]} prices={SUCCESS_PRICES} commande={makeCommande(['mat-1'], { 'mat-1': 3 })} scanning={false} onScan={vi.fn()} onStop={vi.fn()} />
    );
    // 10.00 × 3 = 30,00 € — appears in cell and/or total row
    expect(screen.getAllByText(/30/).length).toBeGreaterThan(0);
  });

  it('applies best tier price when qty >= tier threshold', () => {
    render(
      <CommandeTab materials={[MAT]} prices={TIERED_PRICES} commande={makeCommande(['mat-1'], { 'mat-1': 20 })} scanning={false} onScan={vi.fn()} onStop={vi.fn()} />
    );
    // 1.1333 × 20 = 22.67 € (approx) — may appear in cell and/or total
    expect(screen.getAllByText(/22/).length).toBeGreaterThan(0);
    // Tier badge shown
    expect(screen.getByText(/-6%/)).toBeInTheDocument();
  });

  it('shows "Non référencé" for a supplier with no ref', () => {
    render(
      <CommandeTab materials={[MAT]} prices={EMPTY_PRICES} commande={makeCommande(['mat-1'], { 'mat-1': 1 })} scanning={false} onScan={vi.fn()} onStop={vi.fn()} />
    );
    expect(screen.getAllByText('Non référencé').length).toBeGreaterThan(0);
  });

  it('calls setQuantity when quantity input changes', () => {
    const commande = makeCommande(['mat-1'], { 'mat-1': 1 });
    render(
      <CommandeTab materials={[MAT]} prices={EMPTY_PRICES} commande={commande} scanning={false} onScan={vi.fn()} onStop={vi.fn()} />
    );
    const input = screen.getByRole('spinbutton');
    fireEvent.change(input, { target: { value: '5' } });
    expect(commande.setQuantity).toHaveBeenCalledWith('mat-1', 5);
  });

  it('calls removeItem when ✕ is clicked', () => {
    const commande = makeCommande(['mat-1'], { 'mat-1': 1 });
    render(
      <CommandeTab materials={[MAT]} prices={EMPTY_PRICES} commande={commande} scanning={false} onScan={vi.fn()} onStop={vi.fn()} />
    );
    fireEvent.click(screen.getByTitle(/Retirer/));
    expect(commande.removeItem).toHaveBeenCalledWith('mat-1');
  });

  it('calls onScan when scan button clicked', () => {
    const onScan = vi.fn();
    render(
      <CommandeTab materials={[MAT]} prices={EMPTY_PRICES} commande={makeCommande(['mat-1'], { 'mat-1': 1 })} scanning={false} onScan={onScan} onStop={vi.fn()} />
    );
    fireEvent.click(screen.getByRole('button', { name: /Actualiser les prix/ }));
    expect(onScan).toHaveBeenCalledOnce();
  });

  it('shows stop button and disables scan button when scanning', () => {
    render(
      <CommandeTab materials={[MAT]} prices={EMPTY_PRICES} commande={makeCommande(['mat-1'], { 'mat-1': 1 })} scanning={true} onScan={vi.fn()} onStop={vi.fn()} />
    );
    expect(screen.getByRole('button', { name: 'Arrêter le scan' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Scan en cours/ })).toBeDisabled();
  });

  it('calls onStop when stop button clicked', () => {
    const onStop = vi.fn();
    render(
      <CommandeTab materials={[MAT]} prices={EMPTY_PRICES} commande={makeCommande(['mat-1'], { 'mat-1': 1 })} scanning={true} onScan={vi.fn()} onStop={onStop} />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Arrêter le scan' }));
    expect(onStop).toHaveBeenCalledOnce();
  });

  it('calls exportOrder when save button clicked', () => {
    const commande = makeCommande(['mat-1'], { 'mat-1': 1 });
    render(
      <CommandeTab materials={[MAT]} prices={EMPTY_PRICES} commande={commande} scanning={false} onScan={vi.fn()} onStop={vi.fn()} />
    );
    fireEvent.click(screen.getByTitle(/Sauvegarder/));
    expect(commande.exportOrder).toHaveBeenCalledOnce();
  });

  it('shows total row with price sum', () => {
    render(
      <CommandeTab materials={[MAT]} prices={SUCCESS_PRICES} commande={makeCommande(['mat-1'], { 'mat-1': 2 })} scanning={false} onScan={vi.fn()} onStop={vi.fn()} />
    );
    // 10.00 × 2 = 20,00 € — appears in cell and/or total row
    expect(screen.getAllByText(/20/).length).toBeGreaterThan(0);
  });

  it('collapses a category row when header is clicked', () => {
    render(
      <CommandeTab materials={[MAT, MAT2]} prices={EMPTY_PRICES} commande={makeCommande(['mat-1', 'mat-2'], { 'mat-1': 1, 'mat-2': 1 })} scanning={false} onScan={vi.fn()} onStop={vi.fn()} />
    );
    expect(screen.getByText('Prise Céliane')).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText(/Replier la catégorie Prise de courant/i));
    expect(screen.queryByText('Prise Céliane')).not.toBeInTheDocument();
  });

  it('renders a cable material row', () => {
    render(
      <CommandeTab materials={[CABLE_MAT]} prices={EMPTY_PRICES} commande={makeCommande(['cable-1'], { 'cable-1': 10 })} scanning={false} onScan={vi.fn()} onStop={vi.fn()} />
    );
    expect(screen.getByText('Câble 3G2.5')).toBeInTheDocument();
    expect(screen.getByText(/Câble \(prix au mètre\)/)).toBeInTheDocument();
  });

  it('shows error cell in commande table', () => {
    const errorPrices: PriceMatrix = {
      'mat-1': {
        materielelectrique: { status: 'error', data: null, errorMessage: 'Timeout' },
      },
    };
    render(
      <CommandeTab materials={[MAT]} prices={errorPrices} commande={makeCommande(['mat-1'], { 'mat-1': 1 })} scanning={false} onScan={vi.fn()} onStop={vi.fn()} />
    );
    expect(screen.getAllByText(/Erreur/).length).toBeGreaterThan(0);
  });

  it('shows loading cell indicator', () => {
    const loadingPrices: PriceMatrix = {
      'mat-1': {
        materielelectrique: { status: 'loading', data: null, errorMessage: null },
      },
    };
    render(
      <CommandeTab materials={[MAT]} prices={loadingPrices} commande={makeCommande(['mat-1'], { 'mat-1': 1 })} scanning={false} onScan={vi.fn()} onStop={vi.fn()} />
    );
    expect(screen.getAllByText('…').length).toBeGreaterThan(0);
  });

  it('collapse/expand all works via toolbar button', () => {
    render(
      <CommandeTab materials={[MAT, MAT2]} prices={EMPTY_PRICES} commande={makeCommande(['mat-1', 'mat-2'], { 'mat-1': 1, 'mat-2': 1 })} scanning={false} onScan={vi.fn()} onStop={vi.fn()} />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Tout replier' }));
    expect(screen.queryByText('Prise Céliane')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Tout déplier' }));
    expect(screen.getByText('Prise Céliane')).toBeInTheDocument();
  });
});





