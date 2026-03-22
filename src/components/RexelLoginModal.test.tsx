/**
 * src/components/RexelLoginModal.test.tsx
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { RexelLoginModal } from './RexelLoginModal';

// Minimal valid JWT with ERPCustomerID for extractAccountId
const ACCOUNT = '987654';
const PAYLOAD = btoa(JSON.stringify({ ERPCustomerID: { accountNumber: ACCOUNT } }))
  .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
const VALID_TOKEN = `hdr.${PAYLOAD}.sig`;

const EMPTY_PROPS = {
  currentToken: '', currentBranchId: '', currentZipcode: '', currentCity: '',
  onSave: vi.fn(), onClear: vi.fn(), onClose: vi.fn(),
};

describe('RexelLoginModal', () => {
  it('renders the modal title', () => {
    render(<RexelLoginModal {...EMPTY_PROPS} />);
    expect(screen.getByText(/Connexion Rexel/)).toBeInTheDocument();
  });

  it('shows "Connecté" badge when a token is present', () => {
    render(<RexelLoginModal {...EMPTY_PROPS} currentToken={VALID_TOKEN} currentBranchId="4413" currentZipcode="44880" currentCity="SAUTRON" />);
    expect(screen.getByText(/Connecté/)).toBeInTheDocument();
  });

  it('does not show "Connecté" badge when no token', () => {
    render(<RexelLoginModal {...EMPTY_PROPS} />);
    expect(screen.queryByText(/Connecté/)).not.toBeInTheDocument();
  });

  it('calls onClose when × is clicked', () => {
    const onClose = vi.fn();
    render(<RexelLoginModal {...EMPTY_PROPS} onClose={onClose} />);
    fireEvent.click(screen.getByText('×'));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('calls onClose when Escape is pressed', () => {
    const onClose = vi.fn();
    render(<RexelLoginModal {...EMPTY_PROPS} onClose={onClose} />);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('Enregistrer is disabled when fields are incomplete', () => {
    render(<RexelLoginModal {...EMPTY_PROPS} />);
    expect(screen.getByRole('button', { name: /Enregistrer/ })).toBeDisabled();
  });

  it('detects account id from a valid token draft', () => {
    render(<RexelLoginModal {...EMPTY_PROPS} />);
    // type a valid token into the textarea
    fireEvent.change(screen.getByPlaceholderText(/eyJ/), { target: { value: VALID_TOKEN } });
    expect(screen.getByText(new RegExp(ACCOUNT))).toBeInTheDocument();
  });

  it('calls onSave and onClose when all fields are filled', () => {
    const onSave = vi.fn();
    const onClose = vi.fn();
    render(<RexelLoginModal {...EMPTY_PROPS} onSave={onSave} onClose={onClose} />);
    fireEvent.change(screen.getByPlaceholderText(/eyJ/), { target: { value: VALID_TOKEN } });
    fireEvent.change(screen.getByPlaceholderText('4413'), { target: { value: '4413' } });
    fireEvent.change(screen.getByPlaceholderText('44880'), { target: { value: '44880' } });
    fireEvent.change(screen.getByPlaceholderText('SAUTRON'), { target: { value: 'SAUTRON' } });
    fireEvent.click(screen.getByRole('button', { name: /Enregistrer/ }));
    expect(onSave).toHaveBeenCalledOnce();
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('calls onClear and onClose when Se déconnecter is clicked', () => {
    const onClear = vi.fn();
    const onClose = vi.fn();
    render(<RexelLoginModal {...EMPTY_PROPS} currentToken={VALID_TOKEN} currentBranchId="4413" currentZipcode="44880" currentCity="SAUTRON" onClear={onClear} onClose={onClose} />);
    fireEvent.click(screen.getByText(/Se déconnecter/));
    expect(onClear).toHaveBeenCalledOnce();
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('toggles token visibility when Afficher/Masquer is clicked', () => {
    render(<RexelLoginModal {...EMPTY_PROPS} />);
    const toggleBtn = screen.getByText('Afficher');
    fireEvent.click(toggleBtn);
    expect(screen.getByText('Masquer')).toBeInTheDocument();
  });

  it('strips Bearer prefix from pasted token', () => {
    const onSave = vi.fn();
    const onClose = vi.fn();
    render(<RexelLoginModal {...EMPTY_PROPS} onSave={onSave} onClose={onClose} />);
    fireEvent.change(screen.getByPlaceholderText(/eyJ/), { target: { value: `Bearer ${VALID_TOKEN}` } });
    fireEvent.change(screen.getByPlaceholderText('4413'), { target: { value: '4413' } });
    fireEvent.change(screen.getByPlaceholderText('44880'), { target: { value: '44880' } });
    fireEvent.change(screen.getByPlaceholderText('SAUTRON'), { target: { value: 'SAUTRON' } });
    fireEvent.click(screen.getByRole('button', { name: /Enregistrer/ }));
    expect(onSave.mock.calls[0][0].token).toBe(VALID_TOKEN);
  });
});

