/**
 * src/components/CatalogueToolbar.test.tsx
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CatalogueToolbar } from './CatalogueToolbar';
import { zipSync, strToU8 } from 'fflate';

// Mock the zip/json import services
vi.mock('@/services/catalogueZip', () => ({
  importCatalogueFromZip: vi.fn(() => [
    { id: 'zip-mat', nom: 'Zip Item', marque: 'B', categorie: 'C', references_fournisseurs: {} },
  ]),
  importCatalogueFromJson: vi.fn(() => [
    { id: 'json-mat', nom: 'JSON Item', marque: 'B', categorie: 'C', references_fournisseurs: {} },
  ]),
}));

function makeZipFile(): File {
  const zip = zipSync({ 'catalogue.test.json': strToU8('[]') });
  const buf = new ArrayBuffer(zip.byteLength);
  new Uint8Array(buf).set(zip);
  return new File([buf], 'test.zip', { type: 'application/zip' });
}

function makeJsonFile(): File {
  return new File(
    ['[{"id":"x","nom":"X","marque":"B","categorie":"C","references_fournisseurs":{}}]'],
    'test.json',
    { type: 'application/json' }
  );
}

describe('CatalogueToolbar', () => {
  let onImport: ReturnType<typeof vi.fn>;
  let onExport: ReturnType<typeof vi.fn>;
  let onAddFromUrl: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    onImport = vi.fn();
    onExport = vi.fn();
    onAddFromUrl = vi.fn();
  });

  it('renders the three action buttons', () => {
    render(
      <CatalogueToolbar onImport={onImport} onExport={onExport} onAddFromUrl={onAddFromUrl} />
    );
    expect(screen.getByTitle(/Importer/)).toBeInTheDocument();
    expect(screen.getByTitle(/Exporter/)).toBeInTheDocument();
    expect(screen.getByTitle(/Ajouter/)).toBeInTheDocument();
  });

  it('calls onExport when the export button is clicked', () => {
    render(
      <CatalogueToolbar onImport={onImport} onExport={onExport} onAddFromUrl={onAddFromUrl} />
    );
    fireEvent.click(screen.getByTitle(/Exporter/));
    expect(onExport).toHaveBeenCalledOnce();
  });

  it('calls onAddFromUrl when the ➕ button is clicked', () => {
    render(
      <CatalogueToolbar onImport={onImport} onExport={onExport} onAddFromUrl={onAddFromUrl} />
    );
    fireEvent.click(screen.getByTitle(/Ajouter/));
    expect(onAddFromUrl).toHaveBeenCalledOnce();
  });

  it('calls onImport with JSON items when a .json file is selected', async () => {
    render(
      <CatalogueToolbar onImport={onImport} onExport={onExport} onAddFromUrl={onAddFromUrl} />
    );
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = makeJsonFile();
    // Simulate FileReader loading
    const readAsArrayBufferMock = vi.fn().mockImplementation(function (this: FileReader) {
      const result = new TextEncoder().encode(
        '[{"id":"x","nom":"X","marque":"B","categorie":"C","references_fournisseurs":{}}]'
      ).buffer;
      Object.defineProperty(this, 'result', { value: result });
      this.onload?.({ target: this } as ProgressEvent<FileReader>);
    });
    vi.spyOn(FileReader.prototype, 'readAsArrayBuffer').mockImplementation(readAsArrayBufferMock);
    fireEvent.change(input, { target: { files: [file] } });
    expect(onImport).toHaveBeenCalledOnce();
    vi.restoreAllMocks();
  });

  it('calls onImport with zip items when a .zip file is selected', async () => {
    render(
      <CatalogueToolbar onImport={onImport} onExport={onExport} onAddFromUrl={onAddFromUrl} />
    );
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = makeZipFile();
    const readAsArrayBufferMock = vi.fn().mockImplementation(function (this: FileReader) {
      Object.defineProperty(this, 'result', { value: new ArrayBuffer(0) });
      this.onload?.({ target: this } as ProgressEvent<FileReader>);
    });
    vi.spyOn(FileReader.prototype, 'readAsArrayBuffer').mockImplementation(readAsArrayBufferMock);
    fireEvent.change(input, { target: { files: [file] } });
    expect(onImport).toHaveBeenCalledOnce();
    vi.restoreAllMocks();
  });

  it('does nothing when no file is selected', () => {
    render(
      <CatalogueToolbar onImport={onImport} onExport={onExport} onAddFromUrl={onAddFromUrl} />
    );
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [] } });
    expect(onImport).not.toHaveBeenCalled();
  });
});
