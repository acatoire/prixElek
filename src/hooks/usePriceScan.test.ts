/**
 * src/hooks/usePriceScan.test.ts
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePriceScan, buildIdleMatrix } from './usePriceScan';
import type { Material } from '@/types/material';
import type { SupplierPrice } from '@/types/price';

// ── Mock the adapter ──────────────────────────────────────────────────────────

const mockGetPrice = vi.fn();

vi.mock('@/adapters/materielelectrique', () => ({
  MaterielElectriqueAdapter: vi.fn().mockImplementation(() => ({
    getPrice: mockGetPrice,
  })),
  DEFAULT_SCRAPING_CONFIG: {
    delayBetweenRequestsMs: 0,
    requestTimeoutMs: 5000,
    userAgent: 'test',
  },
}));

// ── Fixtures ──────────────────────────────────────────────────────────────────

const MATERIAL_WITH_REF: Material = {
  id: 'mat-1',
  nom: 'Test Material',
  marque: 'Brand',
  categorie: 'Cat',
  references_fournisseurs: { materielelectrique: 'REF-001' },
};

const MATERIAL_NO_REF: Material = {
  id: 'mat-2',
  nom: 'No ref material',
  marque: 'Brand',
  categorie: 'Cat',
  references_fournisseurs: { materielelectrique: null },
};

const MOCK_PRICE: SupplierPrice = {
  prix_ht: 18.64,
  stock: 1,
  unite: 'pièce',
  fetchedAt: '2026-01-01T00:00:00.000Z',
};

// ── buildIdleMatrix ───────────────────────────────────────────────────────────

describe('buildIdleMatrix', () => {
  it('creates an idle cell for each material', () => {
    const matrix = buildIdleMatrix([MATERIAL_WITH_REF, MATERIAL_NO_REF]);
    expect(matrix['mat-1']['materielelectrique'].status).toBe('idle');
    expect(matrix['mat-2']['materielelectrique'].status).toBe('idle');
  });

  it('returns empty object for empty material list', () => {
    expect(buildIdleMatrix([])).toEqual({});
  });
});

// ── usePriceScan ──────────────────────────────────────────────────────────────

describe('usePriceScan', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('starts with empty prices and scanning=false', () => {
    const { result } = renderHook(() => usePriceScan());
    expect(result.current.scanning).toBe(false);
    expect(result.current.prices).toEqual({});
  });

  it('sets cells to success after a successful scan', async () => {
    mockGetPrice.mockResolvedValue(MOCK_PRICE);
    const { result } = renderHook(() => usePriceScan());

    await act(async () => {
      await result.current.startScan([MATERIAL_WITH_REF]);
    });

    expect(result.current.scanning).toBe(false);
    expect(result.current.prices['mat-1']['materielelectrique'].status).toBe('success');
    expect(result.current.prices['mat-1']['materielelectrique'].data?.prix_ht).toBe(18.64);
  });

  it('sets cell to error when adapter throws', async () => {
    mockGetPrice.mockRejectedValue(new Error('Network fail'));
    const { result } = renderHook(() => usePriceScan());

    await act(async () => {
      await result.current.startScan([MATERIAL_WITH_REF]);
    });

    const cell = result.current.prices['mat-1']['materielelectrique'];
    expect(cell.status).toBe('error');
    expect(cell.errorMessage).toBe('Network fail');
  });

  it('sets cell to error when reference is null', async () => {
    const { result } = renderHook(() => usePriceScan());

    await act(async () => {
      await result.current.startScan([MATERIAL_NO_REF]);
    });

    const cell = result.current.prices['mat-2']['materielelectrique'];
    expect(cell.status).toBe('error');
    expect(cell.errorMessage).toBe('Référence non renseignée');
  });

  it('does not start a second scan while one is running', async () => {
    let resolveFirst!: () => void;
    mockGetPrice.mockReturnValue(
      new Promise<SupplierPrice>((resolve) => {
        resolveFirst = () => resolve(MOCK_PRICE);
      })
    );

    const { result } = renderHook(() => usePriceScan());

    // Start first scan (don't await)
    act(() => { void result.current.startScan([MATERIAL_WITH_REF]); });

    // Try to start a second scan while first is pending
    await act(async () => {
      await result.current.startScan([MATERIAL_WITH_REF]);
    });

    // Only one getPrice call should have been made
    expect(mockGetPrice).toHaveBeenCalledTimes(1);

    // Resolve the first scan
    await act(async () => { resolveFirst(); });
  });
});

