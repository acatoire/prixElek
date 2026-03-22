/**
 * src/components/BricodepotLoginModal.test.tsx
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BricodepotLoginModal } from './BricodepotLoginModal';

const VALID_COOKIES = 'JSESSIONID=abc; DYN_USER_ID=xyz; other=val';
const EMPTY_PROPS = {
  currentCookies: '',
  onSave: vi.fn(),
  onClear: vi.fn(),
  onClose: vi.fn(),
};

describe('BricodepotLoginModal', () => {
  it('renders the modal title', () => {
    render(<BricodepotLoginModal {...EMPTY_PROPS} />);
    expect(screen.getByText(/Session Brico Dépôt/)).toBeInTheDocument();
  });

  it('shows "Session active" badge when current cookies are valid', () => {
    render(<BricodepotLoginModal {...EMPTY_PROPS} currentCookies={VALID_COOKIES} />);
    expect(screen.getByText(/Session active/)).toBeInTheDocument();
  });

  it('does not show "Session active" when no cookies', () => {
    render(<BricodepotLoginModal {...EMPTY_PROPS} />);
    expect(screen.queryByText(/Session active/)).not.toBeInTheDocument();
  });

  it('calls onClose when × is clicked', () => {
    const onClose = vi.fn();
    render(<BricodepotLoginModal {...EMPTY_PROPS} onClose={onClose} />);
    fireEvent.click(screen.getByText('×'));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('calls onClose when Escape is pressed', () => {
    const onClose = vi.fn();
    render(<BricodepotLoginModal {...EMPTY_PROPS} onClose={onClose} />);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('Enregistrer is disabled when draft is empty', () => {
    render(<BricodepotLoginModal {...EMPTY_PROPS} />);
    expect(screen.getByRole('button', { name: /Enregistrer/ })).toBeDisabled();
  });

  it('shows validation warning when draft cookies are missing required keys', () => {
    render(<BricodepotLoginModal {...EMPTY_PROPS} />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'some=thing' } });
    expect(screen.getByText(/JSESSIONID ou DYN_USER_ID manquant/)).toBeInTheDocument();
  });

  it('shows success message when draft is valid', () => {
    render(<BricodepotLoginModal {...EMPTY_PROPS} />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: VALID_COOKIES } });
    expect(screen.getByText(/JSESSIONID et DYN_USER_ID détectés/)).toBeInTheDocument();
  });

  it('calls onSave and onClose when Enregistrer with valid draft', () => {
    const onSave = vi.fn();
    const onClose = vi.fn();
    render(<BricodepotLoginModal {...EMPTY_PROPS} onSave={onSave} onClose={onClose} />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: VALID_COOKIES } });
    fireEvent.click(screen.getByRole('button', { name: /Enregistrer/ }));
    expect(onSave).toHaveBeenCalledWith(VALID_COOKIES);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('calls onClear and onClose when Effacer is clicked', () => {
    const onClear = vi.fn();
    const onClose = vi.fn();
    render(
      <BricodepotLoginModal
        {...EMPTY_PROPS}
        currentCookies={VALID_COOKIES}
        onClear={onClear}
        onClose={onClose}
      />
    );
    fireEvent.click(screen.getByText(/Effacer la session/));
    expect(onClear).toHaveBeenCalledOnce();
    expect(onClose).toHaveBeenCalledOnce();
  });
});
