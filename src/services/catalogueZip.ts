/**
 * src/services/catalogueZip.ts
 *
 * Zip-based import/export for the catalogue.
 *
 * Export layout inside the zip:
 *   catalogue.<slug>.json   — one file per category group
 *
 * The grouping mirrors the config/ file convention so the exported zip
 * can be dropped straight into config/ and committed to the repo.
 *
 * Uses fflate (already a project dependency) — runs entirely in the browser,
 * no server round-trip.
 */

import { zipSync, unzipSync, strToU8, strFromU8 } from 'fflate';
import type { Material, Catalog } from '@/types/material';

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Convert a free-form category string to a file-safe slug */
function categorySlug(categorie: string): string {
  return categorie
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    || 'divers';
}

// ── Export ────────────────────────────────────────────────────────────────────

/**
 * Groups materials by category slug, serialises each group to a JSON file,
 * packs them all in a zip and triggers a browser download.
 */
export function exportCatalogueAsZip(materials: Material[]): void {
  // Group by category slug
  const groups = new Map<string, Material[]>();
  for (const m of materials) {
    const slug = categorySlug(m.categorie);
    if (!groups.has(slug)) groups.set(slug, []);
    groups.get(slug)!.push(m);
  }

  // Build the zip file map  { filename: Uint8Array }
  const files: Record<string, Uint8Array> = {};
  for (const [slug, items] of groups) {
    const filename = `catalogue.${slug}.json`;
    files[filename] = strToU8(JSON.stringify(items, null, 2) + '\n');
  }

  const zipped = zipSync(files, { level: 6 });
  const blob = new Blob([zipped], { type: 'application/zip' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'catalogue-prixelek.zip';
  a.click();
  URL.revokeObjectURL(url);
}

// ── Import ────────────────────────────────────────────────────────────────────

/**
 * Reads a zip file (as ArrayBuffer), extracts every catalogue.*.json entry,
 * merges all items and returns the flat list.
 * Throws a descriptive Error if the zip contains no catalogue files.
 */
export function importCatalogueFromZip(buffer: ArrayBuffer): Catalog {
  const unzipped = unzipSync(new Uint8Array(buffer));

  const all: Material[] = [];
  const catalogueFiles = Object.keys(unzipped).filter(
    (name) => /^catalogue\..+\.json$/i.test(name)
  );

  if (catalogueFiles.length === 0) {
    throw new Error(
      'Aucun fichier catalogue.*.json trouvé dans le zip.\n' +
      'Vérifiez que le fichier a bien été exporté depuis prixElek.'
    );
  }

  for (const filename of catalogueFiles.sort()) {
    const text = strFromU8(unzipped[filename]);
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new Error(`Fichier JSON invalide dans le zip : ${filename}`);
    }
    if (!Array.isArray(parsed)) {
      throw new Error(`${filename} doit contenir un tableau JSON.`);
    }
    all.push(...(parsed as Material[]));
  }

  // Deduplicate by id (first occurrence wins)
  const seen = new Set<string>();
  return all.filter((m) => {
    if (seen.has(m.id)) return false;
    seen.add(m.id);
    return true;
  });
}

/**
 * Reads a plain JSON file (ArrayBuffer) and returns the flat catalogue list.
 * Accepts both a root array and the legacy single-file format.
 */
export function importCatalogueFromJson(buffer: ArrayBuffer): Catalog {
  const text = new TextDecoder().decode(buffer);
  const parsed = JSON.parse(text) as unknown;
  if (!Array.isArray(parsed)) {
    throw new Error('Le fichier JSON doit contenir un tableau d\'articles.');
  }
  return parsed as Catalog;
}

