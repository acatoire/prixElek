/**
 * src/components/RexelLoginModal.tsx
 */
import React, { useState, useCallback, useEffect } from 'react';
import { extractAccountId, type RexelCredentials } from '@/adapters/rexel';
interface RexelLoginModalProps {
  currentToken: string;
  currentBranchId: string;
  onSave: (credentials: RexelCredentials) => void;
  onClear: () => void;
  onClose: () => void;
}
export function RexelLoginModal({ currentToken, currentBranchId, onSave, onClear, onClose }: RexelLoginModalProps): React.ReactElement {
  const [draft, setDraft] = useState(currentToken);
  const [branchDraft, setBranchDraft] = useState(currentBranchId);
  const [showToken, setShowToken] = useState(false);
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);
  const handleSave = useCallback(() => {
    const clean = draft.trim().replace(/^Bearer\s+/i, '');
    const cleanBranch = branchDraft.trim();
    if (!clean || !cleanBranch) return;
    onSave({ token: clean, branchId: cleanBranch });
    onClose();
  }, [draft, branchDraft, onSave, onClose]);
  const hasToken = currentToken.length > 0 && currentBranchId.length > 0;
  const draftClean = draft.trim().replace(/^Bearer\s+/i, '');
  const draftAccountId = draftClean ? extractAccountId(draftClean) : '';
  const draftValid = draftAccountId.length > 0 && branchDraft.trim().length > 0;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <span className="text-lg">🔑</span>
            <h2 className="text-base font-semibold text-gray-900">Connexion Rexel</h2>
            {hasToken && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                ✓ Connecté
              </span>
            )}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">x</button>
        </div>
        <div className="px-6 pt-5 pb-0">
          <div className="bg-blue-50 border border-blue-100 rounded-lg px-4 py-3 text-xs text-blue-700 space-y-1">
            <p className="font-semibold text-blue-800 text-sm">Comment obtenir votre token Rexel :</p>
            <ol className="list-decimal list-inside space-y-0.5">
              <li>Connectez-vous sur rexel.fr</li>
              <li>Ouvrez DevTools (F12) onglet Reseau et filtrez priceandavailability</li>
              <li>Naviguez vers une fiche produit pour declencher la requete</li>
              <li>Clic droit sur la requete - Copier en tant que fetch</li>
              <li>Copiez la valeur apres Bearer dans le header Authorization</li>
            </ol>
          </div>
        </div>
        <div className="px-6 py-4 space-y-2">
          <label className="block text-xs font-medium text-gray-700">
            Code agence Rexel (branchId)
          </label>
          <input
            value={branchDraft}
            onChange={(e) => setBranchDraft(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-400"
            placeholder="4413"
          />
          <label className="block text-xs font-medium text-gray-700">
            Token Bearer (sans le prefixe Bearer)
          </label>
          <div className="relative">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={3}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
              placeholder="eyJhbGciOiJSUzI1NiJ9..."
              style={{ filter: showToken ? 'none' : 'blur(3px)' }}
            />
            <button type="button" onClick={() => setShowToken((v) => !v)}
              className="absolute top-2 right-2 text-xs text-gray-400 hover:text-gray-600 bg-white px-1.5 py-0.5 rounded border border-gray-200">
              {showToken ? 'Masquer' : 'Afficher'}
            </button>
          </div>
          {draftClean && (
            draftValid ? (
              <p className="text-xs text-green-600 bg-green-50 border border-green-200 rounded px-2 py-1">
                Token valide - compte {draftAccountId} detecte
              </p>
            ) : (
              <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-2 py-1">
                Token invalide - aucun accountId dans le JWT. Verifiez que vous etes connecte sur rexel.fr.
              </p>
            )
          )}
          <p className="text-xs text-gray-400">Valide environ 30 jours. Stocke uniquement dans votre navigateur (localStorage).</p>
        </div>
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 bg-gray-50/50">
          {hasToken
            ? <button onClick={() => { onClear(); onClose(); }} className="text-sm text-red-500 hover:bg-red-50 px-4 py-2 rounded-lg transition-colors">Se deconnecter</button>
            : <div />}
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">Annuler</button>
            <button onClick={handleSave} disabled={!draftValid}
              className="px-4 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
              Enregistrer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}