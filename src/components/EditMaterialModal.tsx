/**
 * src/components/EditMaterialModal.tsx
 *
 * Modal to edit or delete a catalogue item.
 */
import React, { useEffect, useCallback, useReducer } from 'react';
import type { Material } from '@/types/material';
import { SUPPLIERS as SUPPLIER_DEFS } from '@/config/suppliers';

interface EditMaterialModalProps {
  material: Material | null;
  onSave: (updated: Material) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

// Derive supplier list from the single source of truth
const SUPPLIERS = SUPPLIER_DEFS.map((s) => s.id);
const SUPPLIER_LABELS: Record<string, string> = Object.fromEntries(
  SUPPLIER_DEFS.map((s) => [s.id, s.label])
);

export function EditMaterialModal({
  material,
  onSave,
  onDelete,
  onClose,
}: EditMaterialModalProps): React.ReactElement | null {
  type FormState = {
    nom: string;
    marque: string;
    categorie: string;
    refs: Record<string, string>;
    confirmDelete: boolean;
  };
  type FormAction =
    | { type: 'reset'; material: Material }
    | { type: 'setNom'; value: string }
    | { type: 'setMarque'; value: string }
    | { type: 'setCategorie'; value: string }
    | { type: 'setRef'; supplier: string; value: string }
    | { type: 'setConfirmDelete'; value: boolean };

  const buildRefs = (m: Material): Record<string, string> =>
    Object.fromEntries(SUPPLIERS.map((s) => [s, m.references_fournisseurs[s] ?? '']));

  const initState = (m: Material | null): FormState => ({
    nom: m?.nom ?? '',
    marque: m?.marque ?? '',
    categorie: m?.categorie ?? '',
    refs: m ? buildRefs(m) : {},
    confirmDelete: false,
  });

  const reducer = (state: FormState, action: FormAction): FormState => {
    switch (action.type) {
      case 'reset':
        return initState(action.material);
      case 'setNom':
        return { ...state, nom: action.value };
      case 'setMarque':
        return { ...state, marque: action.value };
      case 'setCategorie':
        return { ...state, categorie: action.value };
      case 'setRef':
        return { ...state, refs: { ...state.refs, [action.supplier]: action.value } };
      case 'setConfirmDelete':
        return { ...state, confirmDelete: action.value };
    }
  };

  const [form, dispatch] = useReducer(reducer, material, initState);
  const { nom, marque, categorie, refs, confirmDelete } = form;

  // Reset form whenever the edited material changes
  useEffect(() => {
    if (material) dispatch({ type: 'reset', material });
  }, [material?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSave = useCallback(() => {
    if (!material || !nom.trim()) return;
    const updated: Material = {
      ...material,
      nom: nom.trim(),
      marque: marque.trim(),
      categorie: categorie.trim(),
      references_fournisseurs: Object.fromEntries(
        SUPPLIERS.map((s) => [s, refs[s]?.trim() || null])
      ),
    };
    onSave(updated);
    onClose();
  }, [material, nom, marque, categorie, refs, onSave, onClose]);

  const handleDelete = useCallback(() => {
    if (!material) return;
    if (!confirmDelete) {
      dispatch({ type: 'setConfirmDelete', value: true });
      return;
    }
    onDelete(material.id);
    onClose();
  }, [material, confirmDelete, onDelete, onClose]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  if (!material) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">✏️ Modifier l'article</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl leading-none"
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4 overflow-y-auto max-h-[70vh]">
          {/* id (readonly) */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Identifiant (slug)
            </label>
            <input
              readOnly
              value={material.id}
              className="w-full text-xs text-gray-400 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 cursor-not-allowed"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Nom *</label>
            <input
              value={nom}
              onChange={(e) => dispatch({ type: 'setNom', value: e.target.value })}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
              placeholder="Nom du produit"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Marque</label>
              <input
                value={marque}
                onChange={(e) => dispatch({ type: 'setMarque', value: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                placeholder="ex: Legrand"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Catégorie</label>
              <input
                value={categorie}
                onChange={(e) => dispatch({ type: 'setCategorie', value: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                placeholder="ex: Prise de courant"
              />
            </div>
          </div>

          {/* Supplier references */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-2">
              Références fournisseurs
            </label>
            <div className="space-y-2">
              {SUPPLIERS.map((s) => (
                <div key={s} className="flex items-center gap-2">
                  <span className="text-xs text-gray-500 w-36 shrink-0">{SUPPLIER_LABELS[s]}</span>
                  <input
                    value={refs[s] ?? ''}
                    onChange={(e) =>
                      dispatch({ type: 'setRef', supplier: s, value: e.target.value })
                    }
                    className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                    placeholder="référence ou vide"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 bg-gray-50/50">
          <button
            onClick={handleDelete}
            className={[
              'text-sm font-medium px-4 py-2 rounded-lg transition-colors',
              confirmDelete
                ? 'bg-red-600 text-white hover:bg-red-700'
                : 'text-red-500 hover:bg-red-50',
            ].join(' ')}
          >
            {confirmDelete ? '⚠ Confirmer la suppression' : '🗑 Supprimer'}
          </button>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Annuler
            </button>
            <button
              onClick={handleSave}
              disabled={!nom.trim()}
              className="px-4 py-2 text-sm font-medium bg-orange-500 hover:bg-orange-600 text-white rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Enregistrer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
