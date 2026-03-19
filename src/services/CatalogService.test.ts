/**
 * src/services/CatalogService.test.ts
 */
import { describe, it, expect } from 'vitest';
import { loadAllMaterials } from './CatalogService';
import type { Catalog } from '@/types/material';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const catalogA: Catalog = [
  { id: 'item-a', nom: 'Item A', marque: 'BrandA', categorie: 'Cat1', references_fournisseurs: { materielelectrique: 'REF-A' } },
];

const catalogB: Catalog = [
  { id: 'item-b', nom: 'Item B', marque: 'BrandB', categorie: 'Cat2', references_fournisseurs: { materielelectrique: 'REF-B' } },
];

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('loadAllMaterials', () => {
  it('returns empty array when no modules', () => {
    expect(loadAllMaterials({})).toEqual([]);
  });

  it('loads materials from a single catalogue (default-wrapped)', () => {
    const modules = { '/catalogue/catalogue.a.json': { default: catalogA } };
    const result = loadAllMaterials(modules);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('item-a');
  });

  it('loads materials from a single catalogue (no default wrapper)', () => {
    const modules = { '/catalogue/catalogue.a.json': catalogA };
    const result = loadAllMaterials(modules);
    expect(result[0].id).toBe('item-a');
  });

  it('merges materials from multiple catalogues in sorted file order', () => {
    const modules = {
      '/catalogue/catalogue.b.json': { default: catalogB },
      '/catalogue/catalogue.a.json': { default: catalogA },
    };
    const result = loadAllMaterials(modules);
    expect(result).toHaveLength(2);
    // Sorted: catalogue.a first, then catalogue.b
    expect(result[0].id).toBe('item-a');
    expect(result[1].id).toBe('item-b');
  });

  it('deduplicates materials with the same id across catalogues', () => {
    const modules = {
      '/catalogue/catalogue.a.json': { default: catalogA },
      '/catalogue/catalogue.dupe.json': { default: catalogA },
    };
    expect(loadAllMaterials(modules)).toHaveLength(1);
  });
});
