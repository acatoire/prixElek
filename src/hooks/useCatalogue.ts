/**
 * src/hooks/useCatalogue.ts
 *
 * Manages the live catalogue state in-browser.
 *  - Initialized from the static Vite-bundled JSON files
 *  - Provides add / update / remove / import / export
 *  - Tracks lastModifiedAt / lastExportedAt for the unsaved-changes reminder
 */

import { useState, useCallback } from 'react';
import type { Material } from '@/types/material';
import { loadAllMaterialsWithSource } from '@/services/CatalogService';
import { exportCatalogueAsZip } from '@/services/catalogueZip';

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

type MaterialWithSource = Material & { _sourceFile: string };

export interface UseCatalogueReturn {
  materials: Material[];
  /** Timestamp (ms) of the last catalogue mutation — null if never modified */
  lastModifiedAt: number | null;
  /** Timestamp (ms) of the last export or import — null if never done */
  lastExportedAt: number | null;
  /** Sorted list of existing catalogue file stems (e.g. "catalogue.cables") */
  catalogueFiles: string[];
  /** Map of file stem → sorted unique category labels found in that file */
  fileCategories: Map<string, string[]>;
  importCatalogue: (items: Material[]) => void;
  /** Add a material. Pass targetFile to pin it to a specific catalogue stem. */
  addMaterial: (item: Material, targetFile?: string) => boolean;
  updateMaterial: (item: Material) => void;
  removeMaterial: (id: string) => void;
  exportCatalogue: () => void;
}

export function useCatalogue(): UseCatalogueReturn {
  const [materialsWithSource, setMaterialsWithSource] = useState<MaterialWithSource[]>(
    () => loadAllMaterialsWithSource()
  );
  const [lastModifiedAt, setLastModifiedAt] = useState<number | null>(null);
  const [lastExportedAt, setLastExportedAt] = useState<number | null>(null);

  const materials: Material[] = materialsWithSource.map(({ _sourceFile: _f, ...m }) => m);

  /** Sorted, deduplicated list of catalogue stems currently in use. */
  const catalogueFiles: string[] = Array.from(
    new Set(materialsWithSource.map((m) => m._sourceFile))
  ).sort();

  /** Map of file stem → sorted unique category labels found in that file. */
  const fileCategories = new Map<string, string[]>();
  for (const m of materialsWithSource) {
    const cats = fileCategories.get(m._sourceFile) ?? [];
    if (!cats.includes(m.categorie)) cats.push(m.categorie);
    fileCategories.set(m._sourceFile, cats);
  }
  for (const [stem, cats] of fileCategories) {
    fileCategories.set(stem, cats.sort());
  }

  const importCatalogue = useCallback((items: Material[]) => {
    setMaterialsWithSource(items.map((m) => ({ ...m, _sourceFile: 'catalogue.import' })));
    // Import counts as "in sync" — reset so reminder doesn't fire immediately
    const now = Date.now();
    setLastExportedAt(now);
    setLastModifiedAt(null);
  }, []);

  const addMaterial = useCallback((item: Material, targetFile?: string): boolean => {
    let added = false;
    setMaterialsWithSource((prev) => {
      if (prev.some((m) => m.id === item.id)) return prev;
      added = true;
      const stem =
        targetFile ??
        `catalogue.${slugify(item.categorie || item.nom).slice(0, 40) || 'divers'}`;
      return [...prev, { ...item, _sourceFile: stem }];
    });
    if (added) setLastModifiedAt(Date.now());
    return added;
  }, []);

  const updateMaterial = useCallback((item: Material) => {
    setMaterialsWithSource((prev) =>
      prev.map((m) => (m.id === item.id ? { ...item, _sourceFile: m._sourceFile } : m))
    );
    setLastModifiedAt(Date.now());
  }, []);

  const removeMaterial = useCallback((id: string) => {
    setMaterialsWithSource((prev) => prev.filter((m) => m.id !== id));
    setLastModifiedAt(Date.now());
  }, []);

  const exportCatalogue = useCallback(() => {
    exportCatalogueAsZip(materialsWithSource);
    setLastExportedAt(Date.now());
    setLastModifiedAt(null); // exported = back in sync
  }, [materialsWithSource]);

  return {
    materials,
    lastModifiedAt,
    lastExportedAt,
    catalogueFiles,
    fileCategories,
    importCatalogue,
    addMaterial,
    updateMaterial,
    removeMaterial,
    exportCatalogue,
  };
}

/** Build a catalogue Material from scratch (used by the Add-from-URL flow) */
export function buildMaterialFromExtracted(opts: {
  id: string;
  nom: string;
  marque: string;
  categorie: string;
  referenceMe: string;
}): Material {
  const id = opts.id || slugify(opts.nom);
  return {
    id,
    nom: opts.nom,
    marque: opts.marque,
    categorie: opts.categorie,
    references_fournisseurs: {
      materielelectrique: opts.referenceMe || null,
      rexel: null,
      sonepar: null,
      yesss: null,
    },
  };
}
