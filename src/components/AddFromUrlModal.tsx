/**
 * src/components/AddFromUrlModal.tsx
 *
 * Modal: paste a materielelectrique.com product URL → fetch via proxy →
 * parse JSON-LD → confirm fields → add to catalogue.
 */
import React, { useState, useCallback, useEffect } from 'react';
import type { Material } from '@/types/material';
import { buildMaterialFromExtracted } from '@/hooks/useCatalogue';
import { extractProductFromHtml } from '@/services/extractProduct';

interface AddFromUrlModalProps {
  onAdd: (material: Material) => boolean;
  onClose: () => void;
}

type Step = 'url' | 'fetching' | 'confirm' | 'done' | 'error';

export function AddFromUrlModal({ onAdd, onClose }: AddFromUrlModalProps): React.ReactElement {
  const [step, setStep] = useState<Step>('url');
  const [url, setUrl] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // editable fields after fetch
  const [id, setId] = useState('');
  const [nom, setNom] = useState('');
  const [marque, setMarque] = useState('');
  const [categorie, setCategorie] = useState('');
  const [refMe, setRefMe] = useState('');
  const [alreadyExists, setAlreadyExists] = useState(false);

  const handleFetch = useCallback(async () => {
    const trimmed = url.trim();
    if (!trimmed) return;
    if (!trimmed.includes('materielelectrique.com')) {
      setErrorMsg('Seules les URLs materielelectrique.com sont supportées pour le moment.');
      setStep('error');
      return;
    }

    setStep('fetching');
    setErrorMsg('');

    try {
      // Route through the Vite proxy to avoid CORS
      const proxyPath = trimmed.replace(
        'https://www.materielelectrique.com',
        '/proxy/materielelectrique'
      );
      const res = await fetch(proxyPath, {
        headers: { Accept: 'text/html', 'Accept-Language': 'fr-FR,fr;q=0.9' },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const html = await res.text();

      // extractProductFromHtml is the same logic used by the CLI tools —
      // single source of truth in src/services/extractProduct.ts
      const extracted = extractProductFromHtml(html, trimmed);

      // id  = SKU   (stable product identifier, e.g. "LEG092022")
      // ref = slug  (materielelectrique.com URL slug, used by the adapter)
      setId(extracted.id);
      setNom(extracted.nom);
      setMarque(extracted.marque);
      setCategorie(extracted.categorie);
      setRefMe(extracted.reference);
      setAlreadyExists(false);
      setStep('confirm');
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
      setStep('error');
    }
  }, [url]);

  const handleAdd = useCallback(() => {
    const material = buildMaterialFromExtracted({
      id,
      nom,
      marque,
      categorie,
      referenceMe: refMe,
    });
    const added = onAdd(material);
    setAlreadyExists(!added);
    if (added) setStep('done');
  }, [id, nom, marque, categorie, refMe, onAdd]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">➕ Ajouter depuis une URL</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>

        <div className="px-6 py-5">
          {/* ── Step: url ── */}
          {(step === 'url' || step === 'fetching') && (
            <div className="space-y-4">
              <p className="text-sm text-gray-500">
                Collez l'URL d'une fiche produit sur{' '}
                <a href="https://www.materielelectrique.com" target="_blank" rel="noopener" className="text-orange-500 underline">
                  materielelectrique.com
                </a>
              </p>
              <input
                autoFocus
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleFetch(); }}
                disabled={step === 'fetching'}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 disabled:bg-gray-50"
                placeholder="https://www.materielelectrique.com/...-p-XXXXX.html"
              />
              <button
                onClick={handleFetch}
                disabled={!url.trim() || step === 'fetching'}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {step === 'fetching' ? (
                  <>
                    <span className="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                    Récupération en cours…
                  </>
                ) : (
                  <><span>🔍</span> Analyser la page</>
                )}
              </button>
            </div>
          )}

          {/* ── Step: error ── */}
          {step === 'error' && (
            <div className="space-y-4">
              <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
                ❌ {errorMsg}
              </div>
              <button
                onClick={() => setStep('url')}
                className="w-full px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium rounded-lg transition-colors"
              >
                ← Réessayer
              </button>
            </div>
          )}

          {/* ── Step: confirm ── */}
          {step === 'confirm' && (
            <div className="space-y-4">
              <p className="text-xs text-gray-500">Vérifiez les informations avant d'ajouter :</p>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">
                    Identifiant <span className="text-gray-400 font-normal">(réf. Matériel Électrique / SKU)</span>
                  </label>
                  <input
                    value={id}
                    onChange={(e) => setId(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs font-mono text-gray-600 focus:outline-none focus:ring-2 focus:ring-orange-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Nom *</label>
                  <input
                    value={nom}
                    onChange={(e) => setNom(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Marque</label>
                    <input
                      value={marque}
                      onChange={(e) => setMarque(e.target.value)}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Catégorie</label>
                    <input
                      value={categorie}
                      onChange={(e) => setCategorie(e.target.value)}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Référence Matériel Électrique <span className="text-gray-400 font-normal">(slug URL)</span>
                  </label>
                  <input
                    value={refMe}
                    onChange={(e) => setRefMe(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs font-mono text-gray-600 focus:outline-none focus:ring-2 focus:ring-orange-400"
                  />
                </div>
              </div>

              {alreadyExists && (
                <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  ⚠ Un article avec cet identifiant existe déjà dans le catalogue.
                </p>
              )}

              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => { setStep('url'); setAlreadyExists(false); }}
                  className="flex-1 px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors border border-gray-200"
                >
                  ← Retour
                </button>
                <button
                  onClick={handleAdd}
                  disabled={!nom.trim() || !id.trim()}
                  className="flex-1 px-4 py-2 text-sm font-medium bg-orange-500 hover:bg-orange-600 text-white rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  ➕ Ajouter au catalogue
                </button>
              </div>
            </div>
          )}

          {/* ── Step: done ── */}
          {step === 'done' && (
            <div className="space-y-4 text-center py-4">
              <div className="text-4xl">✅</div>
              <p className="font-semibold text-gray-900">{nom}</p>
              <p className="text-sm text-gray-500">ajouté au catalogue avec succès.</p>
              <div className="flex gap-2 justify-center pt-1">
                <button
                  onClick={() => { setStep('url'); setUrl(''); setNom(''); }}
                  className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors border border-gray-200"
                >
                  Ajouter un autre
                </button>
                <button
                  onClick={onClose}
                  className="px-4 py-2 text-sm font-medium bg-orange-500 hover:bg-orange-600 text-white rounded-lg transition-colors"
                >
                  Fermer
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

