/**
 * src/hooks/useCatalogue.test.ts
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCatalogue, buildMaterialFromExtracted } from './useCatalogue';
import type { Material } from '@/types/material';

// ── Mocks ─────────────────────────────────────────────────────────────────────

const SEED_MATERIAL: Material & { _sourceFile: string } = {
  id: 'seed-1',
  nom: 'Prise Test',
  marque: 'Legrand',
  categorie: 'Prise de courant',
  references_fournisseurs: { materielelectrique: 'REF-001' },
  _sourceFile: 'catalogue.prises.legrand',
};

vi.mock('@/services/CatalogService', () => ({
  loadAllMaterialsWithSource: vi.fn(() => [SEED_MATERIAL]),
}));

const exportZipMock = vi.fn();
vi.mock('@/services/catalogueZip', () => ({
  exportCatalogueAsZip: (...args: unknown[]) => exportZipMock(...args),
  importCatalogueFromZip: vi.fn(() => []),
  importCatalogueFromJson: vi.fn(() => []),
}));

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('useCatalogue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads seed materials on mount', () => {
    const { result } = renderHook(() => useCatalogue());
    expect(result.current.materials).toHaveLength(1);
    expect(result.current.materials[0].id).toBe('seed-1');
  });

  it('exposes catalogueFiles derived from _sourceFile', () => {
    const { result } = renderHook(() => useCatalogue());
    expect(result.current.catalogueFiles).toContain('catalogue.prises.legrand');
  });

  it('exposes fileCategories map', () => {
    const { result } = renderHook(() => useCatalogue());
    const cats = result.current.fileCategories.get('catalogue.prises.legrand');
    expect(cats).toContain('Prise de courant');
  });

  it('starts with null lastModifiedAt and lastExportedAt', () => {
    const { result } = renderHook(() => useCatalogue());
    expect(result.current.lastModifiedAt).toBeNull();
    expect(result.current.lastExportedAt).toBeNull();
  });

  it('addMaterial adds a new material and sets lastModifiedAt', () => {
    const { result } = renderHook(() => useCatalogue());
    const newMat: Material = {
      id: 'new-1',
      nom: 'Nouveau',
      marque: 'Brand',
      categorie: 'Cat',
      references_fournisseurs: {},
    };
    let added: boolean;
    act(() => {
      added = result.current.addMaterial(newMat);
    });
    expect(added!).toBe(true);
    expect(result.current.materials).toHaveLength(2);
    expect(result.current.lastModifiedAt).not.toBeNull();
  });

  it('addMaterial with targetFile uses that stem', () => {
    const { result } = renderHook(() => useCatalogue());
    const mat: Material = {
      id: 'new-tf',
      nom: 'Test',
      marque: 'B',
      categorie: 'C',
      references_fournisseurs: {},
    };
    act(() => {
      result.current.addMaterial(mat, 'catalogue.custom');
    });
    expect(result.current.catalogueFiles).toContain('catalogue.custom');
  });

  it('addMaterial returns false for duplicate id', () => {
    const { result } = renderHook(() => useCatalogue());
    const dup: Material = { ...SEED_MATERIAL };
    let added: boolean;
    act(() => {
      added = result.current.addMaterial(dup);
    });
    expect(added!).toBe(false);
    expect(result.current.materials).toHaveLength(1);
  });

  it('updateMaterial updates an existing material', () => {
    const { result } = renderHook(() => useCatalogue());
    act(() => {
      result.current.updateMaterial({ ...SEED_MATERIAL, nom: 'Updated Nom' });
    });
    expect(result.current.materials[0].nom).toBe('Updated Nom');
    expect(result.current.lastModifiedAt).not.toBeNull();
  });

  it('removeMaterial removes the material by id', () => {
    const { result } = renderHook(() => useCatalogue());
    act(() => {
      result.current.removeMaterial('seed-1');
    });
    expect(result.current.materials).toHaveLength(0);
    expect(result.current.lastModifiedAt).not.toBeNull();
  });

  it('importCatalogue replaces materials and resets reminder state', () => {
    const { result } = renderHook(() => useCatalogue());
    const imported: Material[] = [
      { id: 'imp-1', nom: 'Imported', marque: 'B', categorie: 'C', references_fournisseurs: {} },
    ];
    act(() => {
      result.current.importCatalogue(imported);
    });
    expect(result.current.materials).toHaveLength(1);
    expect(result.current.materials[0].id).toBe('imp-1');
    expect(result.current.lastModifiedAt).toBeNull();
    expect(result.current.lastExportedAt).not.toBeNull();
  });

  it('exportCatalogue calls exportCatalogueAsZip and resets reminder', () => {
    const { result } = renderHook(() => useCatalogue());
    // First mutate so lastModifiedAt is set
    act(() => {
      result.current.updateMaterial({ ...SEED_MATERIAL, nom: 'Changed' });
    });
    expect(result.current.lastModifiedAt).not.toBeNull();
    act(() => {
      result.current.exportCatalogue();
    });
    expect(exportZipMock).toHaveBeenCalledOnce();
    expect(result.current.lastModifiedAt).toBeNull();
    expect(result.current.lastExportedAt).not.toBeNull();
  });

  it('addMaterial without targetFile derives stem from categorie', () => {
    const { result } = renderHook(() => useCatalogue());
    const mat: Material = {
      id: 'cat-derive',
      nom: 'Test',
      marque: 'B',
      categorie: 'Disjoncteur',
      references_fournisseurs: {},
    };
    act(() => {
      result.current.addMaterial(mat);
    });
    const files = result.current.catalogueFiles;
    expect(files.some((f) => f.includes('disjoncteur'))).toBe(true);
  });

  it('addMaterial without targetFile uses nom when categorie is empty', () => {
    const { result } = renderHook(() => useCatalogue());
    const mat: Material = {
      id: 'nom-derive',
      nom: 'Mon Câble Spécial',
      marque: 'B',
      categorie: '',
      references_fournisseurs: {},
    };
    act(() => {
      result.current.addMaterial(mat);
    });
    const files = result.current.catalogueFiles;
    // stem should be derived from nom since categorie is empty
    expect(files.some((f) => f.includes('mon-cable') || f.includes('mon-c'))).toBe(true);
  });

  it('fileCategories does not duplicate categories for the same file', () => {
    const { result } = renderHook(() => useCatalogue());
    // Add two materials with same categorie in same file
    const mat1: Material = {
      id: 'dup-cat-1',
      nom: 'Item1',
      marque: 'B',
      categorie: 'Prise de courant',
      references_fournisseurs: {},
    };
    const mat2: Material = {
      id: 'dup-cat-2',
      nom: 'Item2',
      marque: 'B',
      categorie: 'Prise de courant',
      references_fournisseurs: {},
    };
    act(() => {
      result.current.addMaterial(mat1, 'catalogue.prises');
      result.current.addMaterial(mat2, 'catalogue.prises');
    });
    const cats = result.current.fileCategories.get('catalogue.prises');
    // Category should only appear once despite two materials with same category
    const count = cats?.filter((c) => c === 'Prise de courant').length ?? 0;
    expect(count).toBe(1);
  });

  it('updateMaterial leaves non-matching materials unchanged', () => {
    const { result } = renderHook(() => useCatalogue());
    // seed-1 is the only material; update something with a different id
    act(() => {
      result.current.updateMaterial({
        id: 'does-not-exist',
        nom: 'Ghost',
        marque: 'X',
        categorie: 'Y',
        references_fournisseurs: {},
      });
    });
    // seed-1 should be untouched
    expect(result.current.materials[0].id).toBe('seed-1');
    expect(result.current.materials[0].nom).toBe('Prise Test');
  });
});

// ── buildMaterialFromExtracted ────────────────────────────────────────────────

describe('buildMaterialFromExtracted', () => {
  it('builds a material with the given fields', () => {
    const m = buildMaterialFromExtracted({
      id: 'test-id',
      nom: 'Test Product',
      marque: 'Brand',
      categorie: 'Cat',
      referenceMe: 'ref-slug',
    });
    expect(m.id).toBe('test-id');
    expect(m.nom).toBe('Test Product');
    expect(m.references_fournisseurs.materielelectrique).toBe('ref-slug');
  });

  it('slugifies the nom into an id when id is empty', () => {
    const m = buildMaterialFromExtracted({
      id: '',
      nom: 'Mon Produit Électrique',
      marque: 'B',
      categorie: 'C',
      referenceMe: '',
    });
    expect(m.id).toMatch(/mon-produit/);
  });

  it('sets materielelectrique ref to null when referenceMe is empty', () => {
    const m = buildMaterialFromExtracted({
      id: 'x',
      nom: 'X',
      marque: 'B',
      categorie: 'C',
      referenceMe: '',
    });
    expect(m.references_fournisseurs.materielelectrique).toBeNull();
  });
});
