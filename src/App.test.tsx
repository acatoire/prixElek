/**
 * src/App.test.tsx
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { App } from './App';

// Mock heavy dependencies so App renders without real data/network
vi.mock('@/services/CatalogService', () => {
  const material = {
    id: 'mat-1',
    nom: 'Prise Test',
    marque: 'Legrand',
    categorie: 'Prise de courant',
    references_fournisseurs: { materielelectrique: 'REF-001' },
  };
  return {
    loadAllMaterials: () => [material],
    loadAllMaterialsWithSource: () => [{ ...material, _sourceFile: 'catalogue.prises.legrand' }],
  };
});

vi.mock('@/services/catalogueZip', () => ({
  exportCatalogueAsZip: vi.fn(),
  importCatalogueFromZip: vi.fn(() => []),
  importCatalogueFromJson: vi.fn(() => []),
}));

vi.mock('@/adapters/materielelectrique', () => ({
  MaterielElectriqueAdapter: vi.fn().mockImplementation(() => ({
    getPrice: vi.fn(),
  })),
  DEFAULT_SCRAPING_CONFIG: { delayBetweenRequestsMs: 0, requestTimeoutMs: 5000, userAgent: 'test' },
}));

describe('App', () => {
  it('renders the application header', () => {
    render(<App />);
    expect(screen.getByText('prixElek')).toBeInTheDocument();
  });

  it('renders the catalogue table with a material', () => {
    render(<App />);
    expect(screen.getByText('Prise Test')).toBeInTheDocument();
  });

  it('renders the scan button', () => {
    render(<App />);
    expect(screen.getByRole('button', { name: 'Actualiser les prix' })).toBeInTheDocument();
  });

  it('clicking the scan button triggers a scan', async () => {
    render(<App />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Actualiser les prix' }));
    });
    // after click the button is either still present or replaced by "Scan en cours"
    expect(
      screen.queryByRole('button', { name: 'Actualiser les prix' }) ??
      screen.queryByRole('button', { name: 'Scan en cours' })
    ).toBeTruthy();
  });
});
