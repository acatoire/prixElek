/**
 * src/components/EditMaterialModal.test.tsx
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { EditMaterialModal } from './EditMaterialModal';
import type { Material } from '@/types/material';

const MATERIAL: Material = {
  id: 'mat-1',
  nom: 'Prise Céliane',
  marque: 'Legrand',
  categorie: 'Prise de courant',
  references_fournisseurs: { materielelectrique: 'LEG067128', rexel: null },
};

describe('EditMaterialModal', () => {
  it('renders null when material is null', () => {
    const { container } = render(
      <EditMaterialModal material={null} onSave={vi.fn()} onDelete={vi.fn()} onClose={vi.fn()} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders the material name and brand in inputs', () => {
    render(<EditMaterialModal material={MATERIAL} onSave={vi.fn()} onDelete={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByDisplayValue('Prise Céliane')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Legrand')).toBeInTheDocument();
  });

  it('calls onClose when × button is clicked', () => {
    const onClose = vi.fn();
    render(<EditMaterialModal material={MATERIAL} onSave={vi.fn()} onDelete={vi.fn()} onClose={onClose} />);
    fireEvent.click(screen.getByText('×'));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('calls onClose when Escape is pressed', () => {
    const onClose = vi.fn();
    render(<EditMaterialModal material={MATERIAL} onSave={vi.fn()} onDelete={vi.fn()} onClose={onClose} />);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('calls onClose when clicking the backdrop', () => {
    const onClose = vi.fn();
    const { container } = render(
      <EditMaterialModal material={MATERIAL} onSave={vi.fn()} onDelete={vi.fn()} onClose={onClose} />
    );
    const backdrop = container.firstChild as HTMLElement;
    fireEvent.click(backdrop, { target: backdrop });
    expect(onClose).toHaveBeenCalled();
  });

  it('calls onSave with updated material when Enregistrer is clicked', () => {
    const onSave = vi.fn();
    const onClose = vi.fn();
    render(<EditMaterialModal material={MATERIAL} onSave={onSave} onDelete={vi.fn()} onClose={onClose} />);
    const nomInput = screen.getByDisplayValue('Prise Céliane');
    fireEvent.change(nomInput, { target: { value: 'Nouveau Nom' } });
    fireEvent.click(screen.getByRole('button', { name: /Enregistrer/ }));
    expect(onSave).toHaveBeenCalledOnce();
    expect(onSave.mock.calls[0][0].nom).toBe('Nouveau Nom');
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('Enregistrer button is disabled when nom is empty', () => {
    render(<EditMaterialModal material={MATERIAL} onSave={vi.fn()} onDelete={vi.fn()} onClose={vi.fn()} />);
    fireEvent.change(screen.getByDisplayValue('Prise Céliane'), { target: { value: '' } });
    expect(screen.getByRole('button', { name: /Enregistrer/ })).toBeDisabled();
  });

  it('first delete click shows confirmation, second calls onDelete', () => {
    const onDelete = vi.fn();
    const onClose = vi.fn();
    render(<EditMaterialModal material={MATERIAL} onSave={vi.fn()} onDelete={onDelete} onClose={onClose} />);
    // First click → confirm prompt
    fireEvent.click(screen.getByRole('button', { name: /Supprimer/ }));
    expect(screen.getByRole('button', { name: /Confirmer/ })).toBeInTheDocument();
    expect(onDelete).not.toHaveBeenCalled();
    // Second click → actually deletes
    fireEvent.click(screen.getByRole('button', { name: /Confirmer/ }));
    expect(onDelete).toHaveBeenCalledWith('mat-1');
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('updates a supplier reference field', () => {
    const onSave = vi.fn();
    render(<EditMaterialModal material={MATERIAL} onSave={onSave} onDelete={vi.fn()} onClose={vi.fn()} />);
    const refInput = screen.getByDisplayValue('LEG067128');
    fireEvent.change(refInput, { target: { value: 'NEW-REF' } });
    fireEvent.click(screen.getByRole('button', { name: /Enregistrer/ }));
    expect(onSave.mock.calls[0][0].references_fournisseurs.materielelectrique).toBe('NEW-REF');
  });

  it('updates marque and categorie fields', () => {
    const onSave = vi.fn();
    render(<EditMaterialModal material={MATERIAL} onSave={onSave} onDelete={vi.fn()} onClose={vi.fn()} />);
    fireEvent.change(screen.getByDisplayValue('Legrand'), { target: { value: 'Schneider' } });
    fireEvent.change(screen.getByDisplayValue('Prise de courant'), { target: { value: 'Interrupteur' } });
    fireEvent.click(screen.getByRole('button', { name: /Enregistrer/ }));
    expect(onSave.mock.calls[0][0].marque).toBe('Schneider');
    expect(onSave.mock.calls[0][0].categorie).toBe('Interrupteur');
  });
});

