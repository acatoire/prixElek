/**
 * src/components/BricodepotLoginModal.tsx
 *
 * Modal to paste the Cookie: header value from a working Bricodepot curl request.
 * ATG Web Commerce requires session cookies (JSESSIONID, DYN_USER_ID, f5avr*)
 * that can only be obtained from a real browser session — paste them here once.
 */
import React, { useState, useCallback, useEffect } from 'react';

interface BricodepotLoginModalProps {
  currentCookies: string;
  onSave: (cookies: string) => void;
  onClear: () => void;
  onClose: () => void;
}

/** Extract the value of a named cookie from a cookie string */
function hasCookie(cookies: string, name: string): boolean {
  return cookies.split(';').some((c) => c.trim().startsWith(name + '='));
}

/** True when the pasted cookies look like a valid ATG session */
function isValidSession(cookies: string): boolean {
  return hasCookie(cookies, 'JSESSIONID') && hasCookie(cookies, 'DYN_USER_ID');
}

export function BricodepotLoginModal({
  currentCookies,
  onSave,
  onClear,
  onClose,
}: BricodepotLoginModalProps): React.ReactElement {
  const [draft, setDraft] = useState(currentCookies);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  const handleSave = useCallback(() => {
    const clean = draft.trim();
    if (!clean) return;
    onSave(clean);
    onClose();
  }, [draft, onSave, onClose]);

  const isConnected = currentCookies.length > 0 && isValidSession(currentCookies);
  const draftValid = draft.trim().length > 0 && isValidSession(draft.trim());

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
            <span className="text-lg">🍪</span>
            <h2 className="text-base font-semibold text-gray-900">Session Brico Dépôt</h2>
            {isConnected && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                ✓ Session active
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
              Comment obtenir les cookies de session :
            </p>
            <ol className="list-decimal list-inside space-y-0.5">
              <li>
                Ouvrez <strong>bricodepot.fr</strong> dans votre navigateur
              </li>
              <li>Naviguez vers n'importe quelle fiche produit</li>
              <li>F12 → Réseau → cliquez sur la requête de la page produit</li>
              <li>
                En-têtes de requête → copiez la valeur de{' '}
                <code className="bg-blue-100 px-0.5 rounded">Cookie</code>
              </li>
              <li>Collez-la ci-dessous</li>
            </ol>
            <p className="text-blue-600 pt-0.5">
              Les cookies requis sont <code className="bg-blue-100 px-0.5 rounded">JSESSIONID</code>{' '}
              et <code className="bg-blue-100 px-0.5 rounded">DYN_USER_ID</code>. La session dure
              plusieurs heures.
            </p>
          </div>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Valeur de l'en-tête <code className="bg-gray-100 px-1 rounded">Cookie:</code>
            </label>
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={5}
              className="w-full font-mono text-xs border border-gray-200 rounded-lg px-3 py-2
                focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
              placeholder="JSESSIONID=...; DYN_USER_ID=...; f5avr...=...; ..."
              spellCheck={false}
            />
            {draft.trim().length > 0 && (
              <p
                className={`mt-1 text-xs font-medium ${draftValid ? 'text-green-600' : 'text-orange-500'}`}
              >
                {draftValid
                  ? '✓ JSESSIONID et DYN_USER_ID détectés'
                  : '⚠ JSESSIONID ou DYN_USER_ID manquant — vérifiez la valeur copiée'}
              </p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 bg-gray-50/50">
          <button
            onClick={() => {
              onClear();
              onClose();
            }}
            className="text-sm font-medium text-red-500 hover:bg-red-50 px-4 py-2 rounded-lg transition-colors"
            disabled={!isConnected}
          >
            🗑 Effacer la session
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
              disabled={!draftValid}
              className="px-4 py-2 text-sm font-medium bg-blue-500 hover:bg-blue-600 text-white
                rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Enregistrer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
