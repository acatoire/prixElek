/**
 * src/services/CatalogService.ts
 *
 * Loads all catalogue.*.json files from /catalogue at the project root.
 * The glob modules are injectable for testability.
 */

import type { Catalog, Material } from '@/types/material';

// Vite glob — picks up all catalogue.*.json from the root catalogue/ folder
const CATALOGUE_MODULES = import.meta.glob('/catalogue/catalogue.*.json', { eager: true });

/**
 * Returns all materials, each tagged with the source filename stem
 * (e.g. "catalogue.cables") so the export can reconstruct the original files.
 */
export function loadAllMaterialsWithSource(
  modules: Record<string, unknown> = CATALOGUE_MODULES
): Array<Material & { _sourceFile: string }> {
  const seen = new Set<string>();
  const result: Array<Material & { _sourceFile: string }> = [];

  for (const path of Object.keys(modules).sort()) {
    // Extract "catalogue.cables" from "/catalogue/catalogue.cables.json"
    const stem = path
      .split('/')
      .pop()!
      .replace(/\.json$/i, '');

    const mod = modules[path] as { default: Catalog } | Catalog;
    const catalog: Catalog =
      'default' in mod ? (mod as { default: Catalog }).default : (mod as Catalog);

    for (const material of catalog) {
      if (!seen.has(material.id)) {
        seen.add(material.id);
        result.push({ ...material, _sourceFile: stem });
      }
    }
  }

  return result;
}

/** Convenience wrapper — strips _sourceFile, used where provenance is not needed */
export function loadAllMaterials(modules: Record<string, unknown> = CATALOGUE_MODULES): Material[] {
  return loadAllMaterialsWithSource(modules).map(({ _sourceFile: _f, ...m }) => m);
}
