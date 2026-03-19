/**
 * src/services/catalogueZip.ts
 *
 * Zip-based import/export for the catalogue.
 *
 * Export layout inside the zip (mirrors catalogue/ at project root):
 *   catalogue.cables.json
 *   catalogue.prises.legrand.json
 *   …
 *
 * Each file is named after the _sourceFile stem tracked on the material,
 * so the zip is always a faithful mirror of the catalogue/ folder.
 *
 * Uses fflate — runs entirely in the browser, no server round-trip.
 */

import { zipSync, unzipSync, strToU8, strFromU8 } from 'fflate';
import type { Material, Catalog } from '@/types/material';

type MaterialWithSource = Material & { _sourceFile?: string };

// ── Export ────────────────────────────────────────────────────────────────────

/**
 * Groups materials by their _sourceFile stem (e.g. "catalogue.cables"),
 * serialises each group to JSON, packs into a zip and triggers a download.
 * Materials without a _sourceFile are placed in "catalogue.divers".
 */
export function exportCatalogueAsZip(materials: MaterialWithSource[]): void {
  const groups = new Map<string, Material[]>();

  for (const { _sourceFile, ...m } of materials) {
    const stem = _sourceFile ?? 'catalogue.divers';
    if (!groups.has(stem)) groups.set(stem, []);
    groups.get(stem)!.push(m);
  }

  const files: Record<string, Uint8Array> = {};
  for (const [stem, items] of groups) {
    // Ensure the filename always ends in .json
    const filename = stem.endsWith('.json') ? stem : `${stem}.json`;
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
 * Reads a zip (ArrayBuffer), extracts every catalogue.*.json,
 * merges and deduplicates, returns flat list.
 */
export function importCatalogueFromZip(buffer: ArrayBuffer): Catalog {
  const unzipped = unzipSync(new Uint8Array(buffer));

  const catalogueFiles = Object.keys(unzipped).filter(
    (name) => /^catalogue\..+\.json$/i.test(name)
  );

  if (catalogueFiles.length === 0) {
    throw new Error(
      'Aucun fichier catalogue.*.json trouvé dans le zip.\n' +
      'Vérifiez que le fichier a bien été exporté depuis prixElek.'
    );
  }

  const all: Material[] = [];
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

  const seen = new Set<string>();
  return all.filter((m) => {
    if (seen.has(m.id)) return false;
    seen.add(m.id);
    return true;
  });
}

/**
 * Reads a plain JSON file (ArrayBuffer) and returns the flat catalogue list.
 */
export function importCatalogueFromJson(buffer: ArrayBuffer): Catalog {
  const text = new TextDecoder().decode(buffer);
  const parsed = JSON.parse(text) as unknown;
  if (!Array.isArray(parsed)) {
    throw new Error("Le fichier JSON doit contenir un tableau d'articles.");
  }
  return parsed as Catalog;
}
