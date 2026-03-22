/**
 * src/components/AddFromUrlModal.test.tsx
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AddFromUrlModal } from './AddFromUrlModal';
import type { Material } from '@/types/material';

// ── mock extractProduct so we don't need real HTML ────────────────────────────

vi.mock('@/services/extractProduct', () => ({
  extractProductFromHtml: vi.fn(() => ({
    id: '71041542',
    nom: 'Prise 2P+T',
    marque: 'Legrand',
    categorie: 'Prise de courant',
    reference: 'prise-2pt-legrand-p-71041542',
  })),
}));

vi.mock('@/hooks/useCatalogue', () => ({
  buildMaterialFromExtracted: vi.fn(({ id, nom, marque, categorie, referenceMe }) => ({
    id,
    nom,
    marque,
    categorie,
    references_fournisseurs: { materielelectrique: referenceMe },
  })),
}));

// ── fixtures ──────────────────────────────────────────────────────────────────

const VALID_URL = 'https://www.materielelectrique.com/prise-2pt-p-71041542.html';
const CATALOGUE_FILES = ['catalogue.prises.legrand', 'catalogue.cables'];
const FILE_CATEGORIES = new Map([
  ['catalogue.prises.legrand', ['Prise de courant', 'Prise USB']],
  ['catalogue.cables', ['Câble']],
]);

function makeProps(
  overrides?: Partial<{
    catalogueFiles: string[];
    fileCategories: Map<string, string[]>;
    onAdd: (m: Material, f?: string) => boolean;
    onClose: () => void;
  }>
) {
  return {
    catalogueFiles: CATALOGUE_FILES,
    fileCategories: FILE_CATEGORIES,
    onAdd: vi.fn(() => true) as (m: Material, f?: string) => boolean,
    onClose: vi.fn(),
    ...overrides,
  };
}

// ── helper: reach the confirm step ───────────────────────────────────────────

async function reachConfirmStep(props: ReturnType<typeof makeProps>) {
  render(<AddFromUrlModal {...props} />);
  // Stub fetch to return HTML
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok: true,
    text: async () => '<html>product page</html>',
  }) as unknown as typeof fetch;
  fireEvent.change(screen.getByPlaceholderText(/materielelectrique.com/), {
    target: { value: VALID_URL },
  });
  fireEvent.click(screen.getByRole('button', { name: /Analyser la page/ }));
  await waitFor(() => expect(screen.getByText(/Vérifiez les informations/)).toBeInTheDocument());
}

// ── tests ─────────────────────────────────────────────────────────────────────

describe('AddFromUrlModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── url step ─────────────────────────────────────────────────────────────

  it('renders the URL input step initially', () => {
    render(<AddFromUrlModal {...makeProps()} />);
    expect(screen.getByText(/Ajouter depuis une URL/)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/materielelectrique.com/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Analyser la page/ })).toBeInTheDocument();
  });

  it('Analyser button is disabled when URL is empty', () => {
    render(<AddFromUrlModal {...makeProps()} />);
    expect(screen.getByRole('button', { name: /Analyser la page/ })).toBeDisabled();
  });

  it('Analyser button becomes enabled when a URL is typed', () => {
    render(<AddFromUrlModal {...makeProps()} />);
    fireEvent.change(screen.getByPlaceholderText(/materielelectrique.com/), {
      target: { value: VALID_URL },
    });
    expect(screen.getByRole('button', { name: /Analyser la page/ })).toBeEnabled();
  });

  it('closes when × is clicked', () => {
    const props = makeProps();
    render(<AddFromUrlModal {...props} />);
    fireEvent.click(screen.getByText('×'));
    expect(props.onClose).toHaveBeenCalledOnce();
  });

  it('closes when Escape is pressed', () => {
    const props = makeProps();
    render(<AddFromUrlModal {...props} />);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(props.onClose).toHaveBeenCalledOnce();
  });

  it('closes when backdrop is clicked', () => {
    const props = makeProps();
    const { container } = render(<AddFromUrlModal {...props} />);
    const backdrop = container.firstChild as HTMLElement;
    fireEvent.click(backdrop);
    expect(props.onClose).toHaveBeenCalledOnce();
  });

  // ── error step ───────────────────────────────────────────────────────────

  it('shows error step when URL is not materielelectrique.com', async () => {
    render(<AddFromUrlModal {...makeProps()} />);
    fireEvent.change(screen.getByPlaceholderText(/materielelectrique.com/), {
      target: { value: 'https://www.someothersite.com/product' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Analyser la page/ }));
    await waitFor(() =>
      expect(screen.getByText(/Seules les URLs materielelectrique/)).toBeInTheDocument()
    );
    // Réessayer goes back to url step
    fireEvent.click(screen.getByRole('button', { name: /Réessayer/ }));
    expect(screen.getByPlaceholderText(/materielelectrique.com/)).toBeInTheDocument();
  });

  it('shows error step when fetch fails', async () => {
    render(<AddFromUrlModal {...makeProps()} />);
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue({ ok: false, status: 503 }) as unknown as typeof fetch;
    fireEvent.change(screen.getByPlaceholderText(/materielelectrique.com/), {
      target: { value: VALID_URL },
    });
    fireEvent.click(screen.getByRole('button', { name: /Analyser la page/ }));
    await waitFor(() => expect(screen.getByText(/HTTP 503/)).toBeInTheDocument());
  });

  it('shows error step when fetch throws a network error', async () => {
    render(<AddFromUrlModal {...makeProps()} />);
    globalThis.fetch = vi
      .fn()
      .mockRejectedValue(new Error('Network error')) as unknown as typeof fetch;
    fireEvent.change(screen.getByPlaceholderText(/materielelectrique.com/), {
      target: { value: VALID_URL },
    });
    fireEvent.click(screen.getByRole('button', { name: /Analyser la page/ }));
    await waitFor(() => expect(screen.getByText(/Network error/)).toBeInTheDocument());
  });

  it('triggers fetch on Enter key in the URL input', async () => {
    render(<AddFromUrlModal {...makeProps()} />);
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => '<html></html>',
    }) as unknown as typeof fetch;
    fireEvent.change(screen.getByPlaceholderText(/materielelectrique.com/), {
      target: { value: VALID_URL },
    });
    fireEvent.keyDown(screen.getByPlaceholderText(/materielelectrique.com/), { key: 'Enter' });
    await waitFor(() => expect(screen.getByText(/Vérifiez les informations/)).toBeInTheDocument());
  });

  // ── confirm step ─────────────────────────────────────────────────────────

  it('reaches confirm step after successful fetch', async () => {
    const props = makeProps();
    await reachConfirmStep(props);
    expect(screen.getByDisplayValue('Prise 2P+T')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Legrand')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Suivant/ })).toBeInTheDocument();
  });

  it('Retour from confirm step goes back to url step', async () => {
    const props = makeProps();
    await reachConfirmStep(props);
    fireEvent.click(screen.getByRole('button', { name: /← Retour/ }));
    expect(screen.getByPlaceholderText(/materielelectrique.com/)).toBeInTheDocument();
  });

  it('Suivant button disabled when nom or id is empty', async () => {
    const props = makeProps();
    await reachConfirmStep(props);
    fireEvent.change(screen.getByDisplayValue('Prise 2P+T'), { target: { value: '' } });
    expect(screen.getByRole('button', { name: /Suivant/ })).toBeDisabled();
  });

  it('can edit fields in confirm step', async () => {
    const props = makeProps();
    await reachConfirmStep(props);
    fireEvent.change(screen.getByDisplayValue('Prise 2P+T'), {
      target: { value: 'Prise modifiée' },
    });
    expect(screen.getByDisplayValue('Prise modifiée')).toBeInTheDocument();
    fireEvent.change(screen.getByDisplayValue('Legrand'), { target: { value: 'Schneider' } });
    expect(screen.getByDisplayValue('Schneider')).toBeInTheDocument();
  });

  it('can edit id, categorie and ref fields in confirm step', async () => {
    const props = makeProps();
    await reachConfirmStep(props);
    fireEvent.change(screen.getByDisplayValue('71041542'), { target: { value: 'NEW-ID' } });
    expect(screen.getByDisplayValue('NEW-ID')).toBeInTheDocument();
    fireEvent.change(screen.getByDisplayValue('Prise de courant'), {
      target: { value: 'Interrupteur' },
    });
    expect(screen.getByDisplayValue('Interrupteur')).toBeInTheDocument();
    fireEvent.change(screen.getByDisplayValue('prise-2pt-legrand-p-71041542'), {
      target: { value: 'new-ref' },
    });
    expect(screen.getByDisplayValue('new-ref')).toBeInTheDocument();
  });

  // ── catalogue step ───────────────────────────────────────────────────────

  it('reaches catalogue step after clicking Suivant', async () => {
    const props = makeProps();
    await reachConfirmStep(props);
    fireEvent.click(screen.getByRole('button', { name: /Suivant/ }));
    expect(screen.getByText(/quel fichier catalogue/)).toBeInTheDocument();
    expect(screen.getAllByText('catalogue.prises.legrand').length).toBeGreaterThan(0);
  });

  it('can select a different catalogue file via radio button', async () => {
    const props = makeProps();
    await reachConfirmStep(props);
    fireEvent.click(screen.getByRole('button', { name: /Suivant/ }));
    const cablesRadio = screen.getByDisplayValue('catalogue.cables');
    fireEvent.click(cablesRadio);
    expect(cablesRadio).toBeChecked();
  });

  it('shows category selector when a file with multiple categories is selected', async () => {
    const props = makeProps();
    await reachConfirmStep(props);
    fireEvent.click(screen.getByRole('button', { name: /Suivant/ }));
    // prises.legrand has 2 categories → should show a select
    expect(screen.getByRole('combobox')).toBeInTheDocument();
  });

  it('shows single category as plain text when file has only one category', async () => {
    const props = makeProps({
      fileCategories: new Map([
        ['catalogue.prises.legrand', ['Prise de courant']],
        ['catalogue.cables', ['Câble']],
      ]),
    });
    await reachConfirmStep(props);
    fireEvent.click(screen.getByRole('button', { name: /Suivant/ }));
    // With one category, shows it as text not a select
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    expect(screen.getByText('Prise de courant')).toBeInTheDocument();
  });

  it('can change category via the combobox in catalogue step', async () => {
    const props = makeProps();
    await reachConfirmStep(props);
    fireEvent.click(screen.getByRole('button', { name: /Suivant/ }));
    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'Prise USB' } });
    expect(select).toHaveValue('Prise USB');
  });

  it('can type a new file name in catalogue step', async () => {
    const props = makeProps();
    await reachConfirmStep(props);
    fireEvent.click(screen.getByRole('button', { name: /Suivant/ }));
    fireEvent.click(screen.getByDisplayValue('__new__'));
    const newFileInput = screen.getByPlaceholderText(/catalogue.disjoncteurs/);
    fireEvent.change(newFileInput, { target: { value: 'catalogue.interrupteurs' } });
    expect(newFileInput).toHaveValue('catalogue.interrupteurs');
  });

  it('Retour from catalogue step returns to confirm', async () => {
    const props = makeProps();
    await reachConfirmStep(props);
    fireEvent.click(screen.getByRole('button', { name: /Suivant/ }));
    fireEvent.click(screen.getByRole('button', { name: /← Retour/ }));
    expect(screen.getByText(/Vérifiez les informations/)).toBeInTheDocument();
  });

  // ── done step ────────────────────────────────────────────────────────────

  it('reaches done step after adding to catalogue', async () => {
    const props = makeProps();
    await reachConfirmStep(props);
    fireEvent.click(screen.getByRole('button', { name: /Suivant/ }));
    fireEvent.click(screen.getByRole('button', { name: /Ajouter au catalogue/ }));
    await waitFor(() =>
      expect(screen.getByText(/ajouté au catalogue avec succès/)).toBeInTheDocument()
    );
    expect(props.onAdd).toHaveBeenCalledOnce();
  });

  it('calls onClose when Fermer is clicked in done step', async () => {
    const props = makeProps();
    await reachConfirmStep(props);
    fireEvent.click(screen.getByRole('button', { name: /Suivant/ }));
    fireEvent.click(screen.getByRole('button', { name: /Ajouter au catalogue/ }));
    await waitFor(() => screen.getByText(/ajouté au catalogue avec succès/));
    fireEvent.click(screen.getByRole('button', { name: 'Fermer' }));
    expect(props.onClose).toHaveBeenCalledOnce();
  });

  it('"Ajouter un autre" resets back to url step', async () => {
    const props = makeProps();
    await reachConfirmStep(props);
    fireEvent.click(screen.getByRole('button', { name: /Suivant/ }));
    fireEvent.click(screen.getByRole('button', { name: /Ajouter au catalogue/ }));
    await waitFor(() => screen.getByText(/ajouté au catalogue avec succès/));
    fireEvent.click(screen.getByRole('button', { name: /Ajouter un autre/ }));
    expect(screen.getByPlaceholderText(/materielelectrique.com/)).toBeInTheDocument();
  });

  it('shows alreadyExists warning when onAdd returns false', async () => {
    const props = makeProps({ onAdd: vi.fn(() => false) as (m: Material, f?: string) => boolean });
    await reachConfirmStep(props);
    fireEvent.click(screen.getByRole('button', { name: /Suivant/ }));
    fireEvent.click(screen.getByRole('button', { name: /Ajouter au catalogue/ }));
    await waitFor(() =>
      expect(screen.getByText(/Un article avec cet identifiant existe déjà/)).toBeInTheDocument()
    );
  });

  // ── no existing catalogue files ──────────────────────────────────────────

  it('shows new file input directly when no catalogue files exist', async () => {
    const props = makeProps({ catalogueFiles: [], fileCategories: new Map() });
    await reachConfirmStep(props);
    fireEvent.click(screen.getByRole('button', { name: /Suivant/ }));
    // With no files, goes straight to new file input
    expect(screen.getByPlaceholderText(/catalogue.disjoncteurs/)).toBeInTheDocument();
  });

  // ── catalogue file with zero categories (L298/L299 branch) ───────────────

  it('shows no category selector when selected file has no categories', async () => {
    const props = makeProps({
      fileCategories: new Map([
        ['catalogue.prises.legrand', []], // empty → no selector, no text
        ['catalogue.cables', ['Câble']],
      ]),
    });
    await reachConfirmStep(props);
    fireEvent.click(screen.getByRole('button', { name: /Suivant/ }));
    // No combobox and no single-category text
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });

  // ── handleAdd with new file name (L106/L108 isNewFile branch) ────────────

  it('adds to catalogue using a new file name typed by the user', async () => {
    const props = makeProps();
    await reachConfirmStep(props);
    fireEvent.click(screen.getByRole('button', { name: /Suivant/ }));
    fireEvent.click(screen.getByDisplayValue('__new__'));
    fireEvent.change(screen.getByPlaceholderText(/catalogue.disjoncteurs/), {
      target: { value: 'catalogue.interrupteurs' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Ajouter au catalogue/ }));
    await waitFor(() =>
      expect(screen.getByText(/ajouté au catalogue avec succès/)).toBeInTheDocument()
    );
    // onAdd called with the new file name as second arg
    expect(props.onAdd).toHaveBeenCalledWith(
      expect.objectContaining({ nom: 'Prise 2P+T' }),
      'catalogue.interrupteurs'
    );
  });

  // ── pickFile keeps current category when it exists in the new file (L87) ──

  it('pickFile keeps current category when it already exists in the selected file', async () => {
    // Both files share "Prise de courant" — switching to cables should reset, but prises keeps it
    const props = makeProps({
      fileCategories: new Map([
        ['catalogue.prises.legrand', ['Prise de courant', 'Prise USB']],
        ['catalogue.cables', ['Prise de courant', 'Câble']], // also has same category
      ]),
    });
    await reachConfirmStep(props);
    fireEvent.click(screen.getByRole('button', { name: /Suivant/ }));
    // First file selected → category is "Prise de courant" (matches extracted)
    // Switch to cables (also has "Prise de courant") — category should be kept
    fireEvent.click(screen.getByDisplayValue('catalogue.cables'));
    const combobox = screen.getByRole('combobox');
    expect(combobox).toHaveValue('Prise de courant');
  });
});
