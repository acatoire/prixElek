/**
 * tools/lib/catalogue-io.test.ts
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Catalog, Material } from '../../src/types/material';
import type { ExtractedProduct } from './extract-product-from-page';
import { cataloguePath, buildMaterial, addMaterialToCatalogue, readCatalogue, writeCatalogue } from './catalogue-io';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const PRODUCT: ExtractedProduct = {
  id: 'prise-legrand-p-297691',
  nom: 'Prise Céliane 4x2P+T',
  marque: 'Legrand',
  categorie: 'Prise de Courant',
  reference: 'LEG067128',
  ean: '3245060671280',
};

const MATERIAL: Material = {
  id: 'prise-legrand-p-297691',
  nom: 'Prise Céliane 4x2P+T',
  marque: 'Legrand',
  categorie: 'Prise de Courant',
  references_fournisseurs: {
    materielelectrique: 'LEG067128',
    rexel: null,
    sonepar: null,
    yesss: null,
  },
};

// ── cataloguePath ─────────────────────────────────────────────────────────────

describe('cataloguePath', () => {
  it('appends .json to a bare name', () => {
    const p = cataloguePath('catalogue.prises.legrand');
    expect(p).toMatch(/catalogue\.prises\.legrand\.json$/);
  });

  it('does not double-add .json if already present', () => {
    const p = cataloguePath('catalogue.prises.legrand.json');
    expect(p).toMatch(/catalogue\.prises\.legrand\.json$/);
    expect(p).not.toMatch(/\.json\.json$/);
  });
});

// ── buildMaterial ─────────────────────────────────────────────────────────────

describe('buildMaterial', () => {
  it('maps ExtractedProduct fields to Material correctly', () => {
    expect(buildMaterial(PRODUCT)).toEqual(MATERIAL);
  });

  it('sets other suppliers to null', () => {
    const m = buildMaterial(PRODUCT);
    expect(m.references_fournisseurs.rexel).toBeNull();
    expect(m.references_fournisseurs.sonepar).toBeNull();
    expect(m.references_fournisseurs.yesss).toBeNull();
  });
});

// ── addMaterialToCatalogue ────────────────────────────────────────────────────

describe('addMaterialToCatalogue', () => {
  let catalogue: Catalog;

  beforeEach(() => {
    catalogue = [];
  });

  it('adds a new material and returns true', () => {
    const added = addMaterialToCatalogue(catalogue, MATERIAL);
    expect(added).toBe(true);
    expect(catalogue).toHaveLength(1);
    expect(catalogue[0].id).toBe(MATERIAL.id);
  });

  it('skips a duplicate and returns false', () => {
    addMaterialToCatalogue(catalogue, MATERIAL);
    const added = addMaterialToCatalogue(catalogue, MATERIAL);
    expect(added).toBe(false);
    expect(catalogue).toHaveLength(1);
  });

  it('adds multiple distinct materials', () => {
    const other: Material = { ...MATERIAL, id: 'other-id' };
    addMaterialToCatalogue(catalogue, MATERIAL);
    addMaterialToCatalogue(catalogue, other);
    expect(catalogue).toHaveLength(2);
  });
});

// ── readCatalogue — injected fakes ────────────────────────────────────────────

describe('readCatalogue', () => {
  it('returns an empty catalogue when file does not exist', async () => {
    const result = await readCatalogue('/some/path.json', {
      existsSync: () => false,
      readFile: vi.fn() as any,
    });
    expect(result).toEqual([]);
  });

  it('parses and returns the catalogue from file', async () => {
    const result = await readCatalogue('/some/path.json', {
      existsSync: () => true,
      readFile: vi.fn().mockResolvedValue(JSON.stringify([MATERIAL])) as any,
    });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(MATERIAL.id);
  });

  it('throws a clear error when file has a root object instead of an array', async () => {
    await expect(
      readCatalogue('/some/bad.json', {
        existsSync: () => true,
        readFile: vi.fn().mockResolvedValue(JSON.stringify({ version: 1, name: 'bad' })),
      })
    ).rejects.toThrow(/Invalid catalogue file.*expected a JSON array/);
  });
});

// ── writeCatalogue — injected fakes ───────────────────────────────────────────

describe('writeCatalogue', () => {
  it('calls writeFile with pretty-printed JSON ending with newline', async () => {
    const writeFile = vi.fn().mockResolvedValue(undefined);
    const cat: Catalog = [MATERIAL];
    await writeCatalogue('/some/path.json', cat, { writeFile });
    const [filePath, content] = writeFile.mock.calls[0] as [string, string];
    expect(filePath).toBe('/some/path.json');
    expect(content.endsWith('\n')).toBe(true);
    const parsed = JSON.parse(content) as Catalog;
    expect(parsed[0].id).toBe(MATERIAL.id);
  });
});
