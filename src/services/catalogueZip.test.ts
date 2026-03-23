// @vitest-environment node
/**
 * src/services/catalogueZip.test.ts
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { zipSync, strToU8 } from 'fflate';
import {
  exportCatalogueAsZip,
  importCatalogueFromZip,
  importCatalogueFromJson,
} from './catalogueZip';
import type { Material } from '@/types/material';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const MAT_A: Material & { _sourceFile?: string } = {
  id: 'mat-a',
  nom: 'Item A',
  marque: 'Brand',
  categorie: 'Cat',
  references_fournisseurs: { materielelectrique: 'REF-A' },
  _sourceFile: 'catalogue.prises',
};
const MAT_B: Material & { _sourceFile?: string } = {
  id: 'mat-b',
  nom: 'Item B',
  marque: 'Brand',
  categorie: 'Cat',
  references_fournisseurs: { materielelectrique: 'REF-B' },
  _sourceFile: 'catalogue.cables',
};
const MAT_NO_SOURCE: Material & { _sourceFile?: string } = {
  id: 'mat-c',
  nom: 'Item C',
  marque: 'Brand',
  categorie: 'Cat',
  references_fournisseurs: {},
};

function makeZipBuffer(files: Record<string, object>): ArrayBuffer {
  const zipFiles: Record<string, Uint8Array> = {};
  for (const [name, content] of Object.entries(files)) {
    zipFiles[name] = strToU8(JSON.stringify(content));
  }
  const zipped = zipSync(zipFiles);
  // Copy into a fresh ArrayBuffer to avoid ArrayBufferLike / SharedArrayBuffer type issues
  const buf = new ArrayBuffer(zipped.byteLength);
  new Uint8Array(buf).set(zipped);
  return buf;
}

// ── exportCatalogueAsZip ──────────────────────────────────────────────────────

describe('exportCatalogueAsZip', () => {
  let clickSpy: ReturnType<typeof vi.fn>;
  let createObjectURLSpy: ReturnType<typeof vi.fn>;
  let revokeObjectURLSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    clickSpy = vi.fn();
    createObjectURLSpy = vi.fn().mockReturnValue('blob:fake');
    revokeObjectURLSpy = vi.fn();

    // In the node environment we set up globals manually so the service can run.
    globalThis.URL = {
      createObjectURL: createObjectURLSpy,
      revokeObjectURL: revokeObjectURLSpy,
    } as unknown as typeof URL;

    globalThis.document = {
      createElement: vi.fn().mockReturnValue({ href: '', download: '', click: clickSpy }),
    } as unknown as typeof document;

    // Minimal Blob stub — just needs to be constructable.
    globalThis.Blob = class {
      constructor(
        public parts: unknown[],
        public options?: unknown
      ) {}
    } as unknown as typeof Blob;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    // @ts-expect-error — clean up node global stubs
    delete globalThis.URL;
    // @ts-expect-error — clean up node global stubs
    delete globalThis.document;
    // @ts-expect-error — clean up node global stubs
    delete globalThis.Blob;
  });

  it('creates a zip blob and triggers a download', () => {
    exportCatalogueAsZip([MAT_A, MAT_B]);
    expect(createObjectURLSpy).toHaveBeenCalledOnce();
    expect(clickSpy).toHaveBeenCalledOnce();
    expect(revokeObjectURLSpy).toHaveBeenCalledWith('blob:fake');
  });

  it('places materials without _sourceFile into catalogue.divers', () => {
    expect(() => exportCatalogueAsZip([MAT_NO_SOURCE])).not.toThrow();
    expect(createObjectURLSpy).toHaveBeenCalledOnce();
  });

  it('appends .json extension if not already present', () => {
    exportCatalogueAsZip([MAT_A]);
    expect(clickSpy).toHaveBeenCalledOnce();
  });

  it('does not double-append .json when stem already ends in .json', () => {
    // Exercises the true branch: stem.endsWith('.json') ? stem : `${stem}.json`
    const matWithJsonStem: typeof MAT_A = {
      ...MAT_A,
      id: 'mat-json-stem',
      _sourceFile: 'catalogue.prises.json',
    };
    expect(() => exportCatalogueAsZip([matWithJsonStem])).not.toThrow();
    expect(clickSpy).toHaveBeenCalledOnce();
  });

  it('groups multiple materials with the same stem into one file', () => {
    // Exercises the false branch of: if (!groups.has(stem))
    const mat1 = { ...MAT_A, id: 'grp-1', _sourceFile: 'catalogue.prises' };
    const mat2 = { ...MAT_A, id: 'grp-2', _sourceFile: 'catalogue.prises' };
    expect(() => exportCatalogueAsZip([mat1, mat2])).not.toThrow();
    expect(clickSpy).toHaveBeenCalledOnce();
  });
});

// ── importCatalogueFromZip ────────────────────────────────────────────────────

describe('importCatalogueFromZip', () => {
  it('returns merged flat list from multiple catalogue JSON files', () => {
    const buf = makeZipBuffer({
      'catalogue.prises.json': [MAT_A],
      'catalogue.cables.json': [MAT_B],
    });
    const result = importCatalogueFromZip(buf);
    expect(result).toHaveLength(2);
    expect(result.map((m) => m.id)).toContain('mat-a');
    expect(result.map((m) => m.id)).toContain('mat-b');
  });

  it('deduplicates materials with the same id', () => {
    const buf = makeZipBuffer({
      'catalogue.a.json': [MAT_A],
      'catalogue.b.json': [MAT_A], // duplicate
    });
    const result = importCatalogueFromZip(buf);
    expect(result).toHaveLength(1);
  });

  it('throws when no catalogue.*.json file is found in the zip', () => {
    const buf = makeZipBuffer({ 'unrelated.json': [MAT_A] });
    expect(() => importCatalogueFromZip(buf)).toThrow(/Aucun fichier catalogue/);
  });

  it('throws when a JSON file inside the zip is malformed', () => {
    const badZip: Record<string, Uint8Array> = {};
    badZip['catalogue.bad.json'] = strToU8('{ INVALID JSON }');
    const zipped = zipSync(badZip);
    const buf = new ArrayBuffer(zipped.byteLength);
    new Uint8Array(buf).set(zipped);
    expect(() => importCatalogueFromZip(buf)).toThrow(/invalide/);
  });

  it('throws when a JSON file contains a non-array', () => {
    const buf = makeZipBuffer({ 'catalogue.x.json': { not: 'an array' } });
    expect(() => importCatalogueFromZip(buf)).toThrow(/tableau/);
  });
});

// ── importCatalogueFromJson ───────────────────────────────────────────────────

describe('importCatalogueFromJson', () => {
  function toBuffer(value: unknown): ArrayBuffer {
    return new TextEncoder().encode(JSON.stringify(value)).buffer as ArrayBuffer;
  }

  it('returns array from a valid JSON array buffer', () => {
    const result = importCatalogueFromJson(toBuffer([MAT_A, MAT_B]));
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe('mat-a');
  });

  it('throws when the JSON is not an array', () => {
    expect(() => importCatalogueFromJson(toBuffer({ not: 'array' }))).toThrow(/tableau/);
  });
});
