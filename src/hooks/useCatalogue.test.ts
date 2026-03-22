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
