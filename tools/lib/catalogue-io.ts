/**
 * tools/lib/catalogue-io.ts
 *
 * Read and write catalogue.*.json files.
 * Handles file creation, deduplication, and pretty-printing.
 *
 * File I/O is injected via optional parameters to keep tests free of vi.mock.
 */

import { readFile as fsReadFile, writeFile as fsWriteFile } from 'fs/promises';
import { existsSync as fsExistsSync } from 'fs';
import { join } from 'path';
import type { Material, Catalog } from '../../src/types/material';
import type { ExtractedProduct } from './extract-product-from-page';

const CONFIG_DIR = join(process.cwd(), 'config');

/** Returns the absolute path for a catalogue file name (with or without .json) */
export function cataloguePath(name: string): string {
  const clean = name.replace(/\.json$/i, '');
  return join(CONFIG_DIR, `${clean}.json`);
}

/** Reads a catalogue file. Returns an empty catalogue if the file does not exist. */
export async function readCatalogue(
  filePath: string,
  deps = { existsSync: fsExistsSync, readFile: fsReadFile }
): Promise<Catalog> {
  if (!deps.existsSync(filePath)) {
    return { materiaux: [] };
  }
  const raw = await deps.readFile(filePath, 'utf-8');
  return JSON.parse(raw as string) as Catalog;
}

/** Writes a catalogue to disk as pretty-printed JSON. */
export async function writeCatalogue(
  filePath: string,
  catalogue: Catalog,
  deps = { writeFile: fsWriteFile }
): Promise<void> {
  await deps.writeFile(filePath, JSON.stringify(catalogue, null, 2) + '\n', 'utf-8');
}

/**
 * Converts an ExtractedProduct into a Material catalogue entry.
 */
export function buildMaterial(product: ExtractedProduct): Material {
  return {
    id: product.id,
    nom: product.nom,
    marque: product.marque,
    categorie: product.categorie,
    references_fournisseurs: {
      materielelectrique: product.reference,
      rexel: null,
      sonepar: null,
      yesss: null,
    },
  };
}

/**
 * Adds a material to a catalogue, skipping if same id already exists.
 * Returns whether the item was actually added.
 */
export function addMaterialToCatalogue(catalogue: Catalog, material: Material): boolean {
  const exists = catalogue.materiaux.some((m) => m.id === material.id);
  if (exists) return false;
  catalogue.materiaux.push(material);
  return true;
}

