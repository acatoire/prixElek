/**
 * src/components/RexelLoginModal.tsx
 */
import React, { useState, useCallback, useEffect } from 'react';
import { extractAccountId, type RexelCredentials } from '@/adapters/rexel';

interface RexelLoginModalProps {
  currentToken: string;
  currentBranchId: string;
  currentZipcode: string;
  currentCity: string;
  onSave: (credentials: RexelCredentials) => void;
  onClear: () => void;
  onClose: () => void;
}

export function RexelLoginModal({
  currentToken,
  currentBranchId,
  currentZipcode,
  currentCity,
  onSave,
  onClear,
  onClose,
}: RexelLoginModalProps): React.ReactElement {
  const [draft, setDraft] = useState(currentToken);
  const [draftBranch, setDraftBranch] = useState(currentBranchId);
  const [draftZip, setDraftZip] = useState(currentZipcode);
  const [draftCity, setDraftCity] = useState(currentCity);
  const [showToken, setShowToken] = useState(false);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  const handleSave = useCallback(() => {
    const cleanToken = draft.trim().replace(/^Bearer\s+/i, '');
    const cleanBranch = draftBranch.trim();
    const cleanZip = draftZip.trim();
    const cleanCity = draftCity.trim();
    if (!cleanToken || !cleanBranch || !cleanZip || !cleanCity) return;
    onSave({ token: cleanToken, branchId: cleanBranch, zipcode: cleanZip, city: cleanCity });
    onClose();
  }, [draft, draftBranch, draftZip, draftCity, onSave, onClose]);

  const hasToken = currentToken.length > 0;
  const draftClean = draft.trim().replace(/^Bearer\s+/i, '');
  const draftAccountId = draftClean ? extractAccountId(draftClean) : '';
  const draftValid =
    draftAccountId.length > 0 &&
    draftBranch.trim().length > 0 &&
    draftZip.trim().length > 0 &&
    draftCity.trim().length > 0;

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
          <div className="flex items-center gap-2">
            <span className="text-lg">🔑</span>
            <h2 className="text-base font-semibold text-gray-900">Connexion Rexel</h2>
            {hasToken && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                ✓ Connecté
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl leading-none"
          >
            ×
          </button>
        </div>

        {/* Instructions */}
        <div className="px-6 pt-5 pb-0">
          <div className="bg-blue-50 border border-blue-100 rounded-lg px-4 py-3 text-xs text-blue-700 space-y-1">
            <p className="font-semibold text-blue-800 text-sm">
              Comment obtenir vos identifiants :
            </p>
            <ol className="list-decimal list-inside space-y-0.5">
              <li>
                Connectez-vous sur <strong>rexel.fr</strong>
              </li>
              <li>
                F12 → Réseau → filtrez <strong>priceandavailability</strong>
              </li>
              <li>Naviguez vers une fiche produit pour déclencher la requête</li>
              <li>
                Clic droit → <strong>Copier en tant que cURL</strong>
              </li>
              <li>
                Dans le <code className="bg-blue-100 px-0.5 rounded">--data-raw</code>, relevez{' '}
                <strong>branchId</strong>, <strong>zipcode</strong> et <strong>city</strong>
              </li>
              <li>
                Dans <code className="bg-blue-100 px-0.5 rounded">Authorization</code>, copiez la
                valeur après <strong>Bearer </strong>
              </li>
            </ol>
          </div>
        </div>

        {/* Fields */}
        <div className="px-6 py-4 space-y-4">
          {/* Token */}
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-gray-700">Token Bearer</label>
            <div className="relative">
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                rows={3}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
                placeholder="eyJhbGciOiJSUzI1NiJ9..."
                style={{ filter: showToken ? 'none' : 'blur(3px)' }}
              />
              <button
                type="button"
                onClick={() => setShowToken((v) => !v)}
                className="absolute top-2 right-2 text-xs text-gray-400 hover:text-gray-600 bg-white px-1.5 py-0.5 rounded border border-gray-200"
              >
                {showToken ? 'Masquer' : 'Afficher'}
              </button>
            </div>
            {draftClean &&
              (draftAccountId ? (
                <p className="text-xs text-green-600 bg-green-50 border border-green-200 rounded px-2 py-1">
                  ✓ Compte {draftAccountId} détecté
                </p>
              ) : (
                <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-2 py-1">
                  Token invalide — vérifiez que vous êtes connecté sur rexel.fr
                </p>
              ))}
          </div>

          {/* Branch + location on one row */}
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-gray-700">
                Code agence <span className="text-gray-400 font-normal">(branchId)</span>
              </label>
              <input
                type="text"
                value={draftBranch}
                onChange={(e) => setDraftBranch(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-400"
                placeholder="4413"
                maxLength={10}
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-gray-700">
                Code postal <span className="text-gray-400 font-normal">(zipcode)</span>
              </label>
              <input
                type="text"
                value={draftZip}
                onChange={(e) => setDraftZip(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-400"
                placeholder="44880"
                maxLength={10}
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-gray-700">
                Ville <span className="text-gray-400 font-normal">(city)</span>
              </label>
              <input
                type="text"
                value={draftCity}
                onChange={(e) => setDraftCity(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                placeholder="SAUTRON"
                maxLength={60}
              />
            </div>
          </div>

          <p className="text-xs text-gray-400">
            Token valide environ 30 jours. Stocké uniquement dans votre navigateur (localStorage).
          </p>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 bg-gray-50/50">
          {hasToken ? (
            <button
              onClick={() => {
                onClear();
                onClose();
              }}
              className="text-sm text-red-500 hover:bg-red-50 px-4 py-2 rounded-lg transition-colors"
            >
              Se déconnecter
            </button>
          ) : (
            <div />
          )}
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Annuler
            </button>
            <button
              onClick={handleSave}
              disabled={!draftValid}
              className="px-4 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Enregistrer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
