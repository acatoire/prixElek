/**
 * src/hooks/useCatalogue.ts
 *
 * Manages the live catalogue state in-browser.
 *  - Initialized from the static Vite-bundled JSON files (same as loadAllMaterials)
 *  - Can be overridden by a user-imported JSON file
 *  - Provides add / update / remove / import / export
 */

import { useState, useCallback } from 'react';
import type { Material, Catalog } from '@/types/material';
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

/** Internal type — materials carry their source filename while in state */
type MaterialWithSource = Material & { _sourceFile: string };

export interface UseCatalogueReturn {
  materials: Material[];
  /** Replace the full catalogue (e.g. after JSON import) */
  importCatalogue: (items: Material[]) => void;
  /** Add a new item (no-op if id already exists) */
  addMaterial: (item: Material) => boolean;
  /** Replace an existing item in place */
  updateMaterial: (item: Material) => void;
  /** Remove an item by id */
  removeMaterial: (id: string) => void;
  /** Download the current catalogue as JSON */
  exportCatalogue: () => void;
}

export function useCatalogue(): UseCatalogueReturn {
  const [materialsWithSource, setMaterialsWithSource] = useState<MaterialWithSource[]>(
    () => loadAllMaterialsWithSource()
  );

  // Expose plain materials (without _sourceFile) to consumers
  const materials: Material[] = materialsWithSource.map(({ _sourceFile: _f, ...m }) => m);

  const importCatalogue = useCallback((items: Material[]) => {
    // Imported items have no known source file — assign a default stem
    setMaterialsWithSource(
      items.map((m) => ({ ...m, _sourceFile: 'catalogue.import' }))
    );
  }, []);

  const addMaterial = useCallback((item: Material): boolean => {
    let added = false;
    setMaterialsWithSource((prev) => {
      if (prev.some((m) => m.id === item.id)) return prev;
      added = true;
      // Newly added items: derive a source file from a slugified name stem
      const stem = `catalogue.${slugify(item.categorie || item.nom).slice(0, 40) || 'divers'}`;
      return [...prev, { ...item, _sourceFile: stem }];
    });
    return added;
  }, []);

  const updateMaterial = useCallback((item: Material) => {
    setMaterialsWithSource((prev) =>
      prev.map((m) => (m.id === item.id ? { ...item, _sourceFile: m._sourceFile } : m))
    );
  }, []);

  const removeMaterial = useCallback((id: string) => {
    setMaterialsWithSource((prev) => prev.filter((m) => m.id !== id));
  }, []);

  const exportCatalogue = useCallback(() => {
    exportCatalogueAsZip(materialsWithSource);
  }, [materialsWithSource]);

  return { materials, importCatalogue, addMaterial, updateMaterial, removeMaterial, exportCatalogue };
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
