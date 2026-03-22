/**
 * src/App.test.tsx
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { App } from './App';

// ── shared mock data ──────────────────────────────────────────────────────────

const MATERIAL = {
  id: 'mat-1',
  nom: 'Prise Test',
  marque: 'Legrand',
  categorie: 'Prise de courant',
  references_fournisseurs: { materielelectrique: 'REF-001' },
};

// ── module mocks ──────────────────────────────────────────────────────────────

vi.mock('@/services/CatalogService', () => ({
  loadAllMaterials: () => [MATERIAL],
  loadAllMaterialsWithSource: () => [{ ...MATERIAL, _sourceFile: 'catalogue.prises.legrand' }],
}));

vi.mock('@/services/catalogueZip', () => ({
  exportCatalogueAsZip: vi.fn(),
  importCatalogueFromZip: vi.fn(() => []),
  importCatalogueFromJson: vi.fn(() => []),
}));

vi.mock('@/adapters/materielelectrique', () => ({
  MaterielElectriqueAdapter: vi.fn().mockImplementation(() => ({ getPrice: vi.fn() })),
  DEFAULT_SCRAPING_CONFIG: { delayBetweenRequestsMs: 0, requestTimeoutMs: 5000, userAgent: 'test' },
  loadScrapingConfig: vi.fn(() => ({ delayBetweenRequestsMs: 0, requestTimeoutMs: 5000, userAgent: 'test' })),
}));

// Controllable mocks for hooks that drive conditional UI
const mockStartScan = vi.fn();
const mockStopScan = vi.fn();
vi.mock('@/hooks/usePriceScan', () => ({
  usePriceScan: () => ({ prices: {}, scanning: false, startScan: mockStartScan, stopScan: mockStopScan }),
}));

const mockDismissReminder = vi.fn();
let mockShowReminder = false;
vi.mock('@/hooks/useExportReminder', () => ({
  useExportReminder: () => ({ showReminder: mockShowReminder, dismissReminder: mockDismissReminder }),
}));

let mockRexelConnected = false;
vi.mock('@/hooks/useRexelAuth', () => ({
  useRexelAuth: () => ({
    token: mockRexelConnected ? 'tok' : '',
    branchId: mockRexelConnected ? '4413' : '',
    zipcode: mockRexelConnected ? '44880' : '',
    city: mockRexelConnected ? 'SAUTRON' : '',
    accountId: mockRexelConnected ? 'ACC' : '',
    isConnected: mockRexelConnected,
    saveCredentials: vi.fn(),
    clearToken: vi.fn(),
  }),
}));

let mockBricoConnected = false;
vi.mock('@/hooks/useBricodepotAuth', () => ({
  useBricodepotAuth: () => ({
    cookies: mockBricoConnected ? 'session=abc' : '',
    isConnected: mockBricoConnected,
    saveCookies: vi.fn(),
    clearCookies: vi.fn(),
  }),
}));

// ── helpers ───────────────────────────────────────────────────────────────────

function expandAll() {
  fireEvent.click(screen.getByRole('button', { name: 'Tout déplier' }));
}

// ── tests ─────────────────────────────────────────────────────────────────────

describe('App', () => {
  beforeEach(() => {
    mockShowReminder = false;
    mockRexelConnected = false;
    mockBricoConnected = false;
    vi.clearAllMocks();
  });

  // ── existing baseline tests ──────────────────────────────────────────────

  it('renders the application header', () => {
    render(<App />);
    expect(screen.getByText('prixElek')).toBeInTheDocument();
  });

  it('renders the catalogue table with a material', () => {
    render(<App />);
    expandAll();
    expect(screen.getByText('Prise Test')).toBeInTheDocument();
  });

  it('renders the scan button (disabled when nothing selected)', () => {
    render(<App />);
    const btn = screen.getByRole('button', { name: /Sélectionnez des articles/ });
    expect(btn).toBeInTheDocument();
    expect(btn).toBeDisabled();
  });

  it('scan button becomes enabled after selecting an item', () => {
    render(<App />);
    expandAll();
    fireEvent.click(screen.getByRole('checkbox', { name: /Sélectionner Prise Test/ }));
    expect(screen.getByRole('button', { name: /Actualiser les prix/ })).toBeEnabled();
  });

  // ── supplier connection badge ─────────────────────────────────────────────

  it('shows 🔴 badges when suppliers are disconnected', () => {
    render(<App />);
    const rexelBtn = screen.getByRole('button', { name: /Rexel/ });
    const bricoBtn = screen.getByRole('button', { name: /Brico Dépôt/ });
    expect(rexelBtn.textContent).toContain('🔴');
    expect(bricoBtn.textContent).toContain('🔴');
  });

  it('shows 🟢 badge when Rexel is connected', () => {
    mockRexelConnected = true;
    render(<App />);
    expect(screen.getByRole('button', { name: /Rexel/ }).textContent).toContain('🟢');
  });

  it('shows 🟢 badge when Brico Dépôt is connected', () => {
    mockBricoConnected = true;
    render(<App />);
    expect(screen.getByRole('button', { name: /Brico Dépôt/ }).textContent).toContain('🟢');
  });

  // ── export reminder toast ─────────────────────────────────────────────────

  it('shows export reminder toast when showReminder is true', () => {
    mockShowReminder = true;
    render(<App />);
    expect(screen.getByText(/pensez à l'exporter/)).toBeInTheDocument();
  });

  it('hides export reminder toast when showReminder is false', () => {
    mockShowReminder = false;
    render(<App />);
    expect(screen.queryByText(/pensez à l'exporter/)).not.toBeInTheDocument();
  });

  it('calls exportCatalogue when "Exporter maintenant" is clicked in the toast', async () => {
    mockShowReminder = true;
    const { exportCatalogueAsZip } = vi.mocked(await import('@/services/catalogueZip'));
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /Exporter maintenant/ }));
    // exportCatalogue in useCatalogue calls exportCatalogueAsZip
    expect(exportCatalogueAsZip).toHaveBeenCalled();
  });

  it('calls dismissReminder when "Plus tard" is clicked', () => {
    mockShowReminder = true;
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /Plus tard/ }));
    expect(mockDismissReminder).toHaveBeenCalledOnce();
  });

  // ── commande tab ──────────────────────────────────────────────────────────

  it('switches to the Commande tab when clicked', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /Commande/ }));
    // CommandeTab renders a heading with "Commande"
    expect(screen.getAllByText(/Commande/).length).toBeGreaterThan(0);
  });

  it('shows item count badge on Commande tab when items are selected', () => {
    render(<App />);
    expandAll();
    fireEvent.click(screen.getByRole('checkbox', { name: /Sélectionner Prise Test/ }));
    // Badge "1" appears in the tab nav (may share text with other elements — use getAllByText)
    expect(screen.getAllByText('1').length).toBeGreaterThan(0);
  });

  // ── scan triggering (handleScan / line 67-73) ─────────────────────────────

  it('calls startScan with rexel credentials when connected and scan is triggered', () => {
    mockRexelConnected = true;
    render(<App />);
    expandAll();
    fireEvent.click(screen.getByRole('checkbox', { name: /Sélectionner Prise Test/ }));
    fireEvent.click(screen.getByRole('button', { name: /Actualiser les prix/ }));
    expect(mockStartScan).toHaveBeenCalledOnce();
    const [, rexelArg] = mockStartScan.mock.calls[0] as [unknown, unknown];
    expect(rexelArg).toMatchObject({ token: 'tok', branchId: '4413' });
  });

  it('calls startScan with undefined rexel arg when disconnected', () => {
    mockRexelConnected = false;
    render(<App />);
    expandAll();
    fireEvent.click(screen.getByRole('checkbox', { name: /Sélectionner Prise Test/ }));
    fireEvent.click(screen.getByRole('button', { name: /Actualiser les prix/ }));
    expect(mockStartScan).toHaveBeenCalledOnce();
    const [, rexelArg] = mockStartScan.mock.calls[0] as [unknown, unknown];
    expect(rexelArg).toBeUndefined();
  });

  // ── category toggle (lines 53-58) ─────────────────────────────────────────

  it('toggleCategory collapses and expands a category', () => {
    render(<App />);
    // Starts collapsed — expand all, then collapse a category by clicking its header
    expandAll();
    expect(screen.getByText('Prise Test')).toBeInTheDocument();
    // Click the category header to collapse it
    fireEvent.click(screen.getByText('Prise de courant'));
    expect(screen.queryByText('Prise Test')).not.toBeInTheDocument();
    // Click again to expand
    fireEvent.click(screen.getByText('Prise de courant'));
    expect(screen.getByText('Prise Test')).toBeInTheDocument();
  });

  // ── modals ────────────────────────────────────────────────────────────────

  it('opens and closes the Rexel login modal', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /Rexel/ }));
    expect(screen.getByText('Connexion Rexel')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Annuler' }));
    expect(screen.queryByText('Connexion Rexel')).not.toBeInTheDocument();
  });

  it('opens and closes the Brico Dépôt login modal', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /Brico Dépôt/ }));
    expect(screen.getByText(/Session Brico/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Annuler' }));
    expect(screen.queryByText(/Session Brico/)).not.toBeInTheDocument();
  });

  it('opens and closes the Add-from-URL modal via toolbar', () => {
    render(<App />);
    fireEvent.click(screen.getByTitle(/Ajouter/));
    expect(screen.getByText(/Ajouter depuis une URL/)).toBeInTheDocument();
    // Close via the × icon button in the modal header
    fireEvent.click(screen.getByText('×'));
    expect(screen.queryByText(/Ajouter depuis une URL/)).not.toBeInTheDocument();
  });

  it('opens and closes the Edit modal when a material row edit button is clicked', () => {
    render(<App />);
    expandAll();
    fireEvent.click(screen.getByRole('button', { name: 'Modifier Prise Test' }));
    expect(screen.getByText(/Modifier l'article/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Annuler' }));
    expect(screen.queryByText(/Modifier l'article/)).not.toBeInTheDocument();
  });
});
