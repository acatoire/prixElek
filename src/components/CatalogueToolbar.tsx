/**
 * src/components/CatalogueToolbar.tsx
 *
 * Toolbar row with: import ZIP/JSON, export ZIP, add from URL buttons.
 */
import React, {useRef, useCallback} from 'react';
import type {Catalog} from '@/types/material';
import {importCatalogueFromZip, importCatalogueFromJson} from '@/services/catalogueZip';

interface CatalogueToolbarProps {
  onImport: (items: Catalog) => void;
  onExport: () => void;
  onAddFromUrl: () => void;
}

export function CatalogueToolbar({
                                   onImport,
                                   onExport,
                                   onAddFromUrl,
                                 }: CatalogueToolbarProps): React.ReactElement {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (evt) => {
        try {
          const buffer = evt.target?.result as ArrayBuffer;
          const isZip = file.name.toLowerCase().endsWith('.zip');
          const items = isZip
            ? importCatalogueFromZip(buffer)
            : importCatalogueFromJson(buffer);
          onImport(items);
        } catch (err: unknown) {
          alert(`Import échoué : ${err instanceof Error ? err.message : String(err)}`);
        }
        e.target.value = '';
      };
      reader.readAsArrayBuffer(file);
    },
    [onImport]
  );

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Hidden file input — accepts both zip and json */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".zip,.json,application/zip,application/json"
        className="hidden"
        onChange={handleFileChange}
      />

      <button
        onClick={() => fileInputRef.current?.click()}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium
          bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors
          focus:outline-none focus:ring-2 focus:ring-gray-400"
        title="Importer un catalogue (.zip ou .json)"
      > 📂
      </button>

      <button
        onClick={onExport}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium
          bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors
          focus:outline-none focus:ring-2 focus:ring-gray-400"
        title="Exporter le catalogue en ZIP (un fichier JSON par catégorie)"
      > 💾
      </button>

      <button
        onClick={onAddFromUrl}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium
          bg-orange-50 hover:bg-orange-100 text-orange-700 border border-orange-200 transition-colors
          focus:outline-none focus:ring-2 focus:ring-orange-400"
        title="Ajouter un article depuis une URL materielelectrique.com"
      > ➕
      </button>
    </div>
  );
}
