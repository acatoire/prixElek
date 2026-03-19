/**
 * src/components/RexelLoginModal.tsx
 *
 * Modal to connect to Rexel by pasting a Bearer token.
 * Instructions: log in on rexel.fr, open DevTools Network, filter
 * "priceandavailability", copy the Authorization header value.
 */
import React, { useState, useCallback, useEffect } from 'react';

interface RexelLoginModalProps {
  currentToken: string;
  onSave: (token: string) => void;
  onClear: () => void;
  onClose: () => void;
}

export function RexelLoginModal({ currentToken, onSave, onClear, onClose }: RexelLoginModalProps): React.ReactElement {
  const [draft, setDraft] = useState(currentToken);
  const [showToken, setShowToken] = useState(false);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  const handleSave = useCallback(() => {
    const clean = draft.trim().replace(/^Bearer\s+/i, '');
    if (!clean) return;
    onSave(clean);
    onClose();
  }, [draft, onSave, onClose]);

  const hasToken = currentToken.length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
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
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>

        {/* Instructions */}
        <div className="px-6 pt-5 pb-0">
          <div className="bg-blue-50 border border-blue-100 rounded-lg px-4 py-3 text-xs text-blue-700 space-y-1">
            <p className="font-semibold text-blue-800 text-sm">Comment obtenir votre token Rexel :</p>
            <ol className="list-decimal list-inside space-y-0.5">
              <li>Connectez-vous sur <a href="https://www.rexel.fr" target="_blank" rel="noopener" className="underline font-medium">rexel.fr</a></li>
              <li>Ouvrez DevTools (F12) → Réseau → filtrez <code className="bg-blue-100 px-1 rounded">priceandavailability</code></li>
              <li>Naviguez vers une fiche produit pour déclencher la requête</li>
              <li>Clic droit sur la requête → <strong>Copier en tant que fetch</strong></li>
              <li>Copiez la valeur après <code className="bg-blue-100 px-1 rounded">Bearer </code> dans le header Authorization</li>
            </ol>
          </div>
        </div>

        {/* Token input */}
        <div className="px-6 py-4 space-y-2">
          <label className="block text-xs font-medium text-gray-700">
            Token Bearer <span className="text-gray-400 font-normal">(sans le préfixe "Bearer ")</span>
          </label>
          <div className="relative">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={3}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
              placeholder="eyJhbGciOiJSUzI1NiJ9…"
              style={{ filter: showToken ? 'none' : 'blur(3px)' }}
            />
            <button type="button" onClick={() => setShowToken((v) => !v)}
              className="absolute top-2 right-2 text-xs text-gray-400 hover:text-gray-600 bg-white px-1.5 py-0.5 rounded border border-gray-200">
              {showToken ? '🙈' : '👁'}
            </button>
          </div>
          <p className="text-xs text-gray-400">Valide ~30 jours. Stocké uniquement dans votre navigateur (localStorage).</p>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 bg-gray-50/50">
          {hasToken
            ? <button onClick={() => { onClear(); onClose(); }} className="text-sm text-red-500 hover:bg-red-50 px-4 py-2 rounded-lg transition-colors">🔓 Se déconnecter</button>
            : <div />}
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">Annuler</button>
            <button onClick={handleSave} disabled={!draft.trim()}
              className="px-4 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
              💾 Enregistrer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
