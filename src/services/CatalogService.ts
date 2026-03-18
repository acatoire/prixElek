/**
 * src/services/CatalogService.ts
 *
 * Loads all catalogue.*.json files from /config and merges them.
 * The glob modules are injectable for testability.
 */

import type { Catalog, Material } from '@/types/material';

// Vite glob — picks up all catalogue.*.json at build time
const CATALOGUE_MODULES = import.meta.glob('/config/catalogue.*.json', { eager: true });

/**
 * Returns all materials from every catalogue.*.json file in /config.
 * Accepts an optional modules override so tests can inject fixtures directly.
 */
export function loadAllMaterials(
  modules: Record<string, unknown> = CATALOGUE_MODULES
): Material[] {
  const seen = new Set<string>();
  const result: Material[] = [];

  for (const path of Object.keys(modules).sort()) {
    const mod = modules[path] as { default: Catalog } | Catalog;
    const catalog: Catalog =
      'default' in mod ? (mod as { default: Catalog }).default : (mod as Catalog);

    for (const material of catalog) {
      if (!seen.has(material.id)) {
        seen.add(material.id);
        result.push(material);
      }
    }
  }

  return result;
}
