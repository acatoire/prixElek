/**
 * src/hooks/usePriceScan.test.ts
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePriceScan, buildIdleMatrix } from './usePriceScan';
import type { Material } from '@/types/material';
import type { SupplierPrice } from '@/types/price';

// ── Mock adapters ─────────────────────────────────────────────────────────────

const mockGetPrice = vi.fn();

vi.mock('@/adapters/materielelectrique', () => ({
  MaterielElectriqueAdapter: vi.fn().mockImplementation(() => ({ getPrice: mockGetPrice })),
  DEFAULT_SCRAPING_CONFIG: { delayBetweenRequestsMs: 0, requestTimeoutMs: 5000, userAgent: 'test' },
}));

vi.mock('@/adapters/rexel', () => ({
  RexelAdapter: vi.fn().mockImplementation(() => ({ getPrice: vi.fn().mockResolvedValue(null) })),
}));

vi.mock('@/adapters/bricodepot', () => ({
  BricodepotAdapter: vi.fn().mockImplementation(() => ({ getPrice: vi.fn().mockResolvedValue(null) })),
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

const MATERIAL_B: Material = {
  id: 'mat-b',
  nom: 'Material B',
  marque: 'Brand',
  categorie: 'Cat',
  references_fournisseurs: { materielelectrique: 'REF-B' },
};

const MOCK_PRICE: SupplierPrice = {
  prix_ht: 18.64,
  stock: 1,
  unite: 'pièce',
  fetchedAt: new Date().toISOString(), // fresh — now
  tiers: [],  // [] = fetched with tier-aware code, product has no tiers
};


// ── buildIdleMatrix ───────────────────────────────────────────────────────────

describe('buildIdleMatrix', () => {
  it('creates an idle cell for each material and supplier', () => {
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
  beforeEach(() => { vi.clearAllMocks(); });

  it('starts with empty prices and scanning=false', () => {
    const { result } = renderHook(() => usePriceScan());
    expect(result.current.scanning).toBe(false);
    expect(result.current.prices).toEqual({});
  });

  it('sets cells to success after a successful scan', async () => {
    mockGetPrice.mockResolvedValue(MOCK_PRICE);
    const { result } = renderHook(() => usePriceScan());

    await act(async () => { await result.current.startScan([MATERIAL_WITH_REF]); });

    expect(result.current.scanning).toBe(false);
    expect(result.current.prices['mat-1']['materielelectrique'].status).toBe('success');
    expect(result.current.prices['mat-1']['materielelectrique'].data?.prix_ht).toBe(18.64);
  });

  it('sets cell to error when adapter throws', async () => {
    mockGetPrice.mockRejectedValue(new Error('Network fail'));
    const { result } = renderHook(() => usePriceScan());

    await act(async () => { await result.current.startScan([MATERIAL_WITH_REF]); });

    const cell = result.current.prices['mat-1']['materielelectrique'];
    expect(cell.status).toBe('error');
    expect(cell.errorMessage).toBe('Network fail');
  });

  it('sets cell to error when reference is null', async () => {
    const { result } = renderHook(() => usePriceScan());

    await act(async () => { await result.current.startScan([MATERIAL_NO_REF]); });

    const cell = result.current.prices['mat-2']['materielelectrique'];
    expect(cell.status).toBe('error');
    expect(cell.errorMessage).toBe('Référence non renseignée');
  });

  it('does not start a second scan while one is running', async () => {
    let resolveFirst!: () => void;
    mockGetPrice.mockReturnValue(
      new Promise<SupplierPrice>((resolve) => { resolveFirst = () => resolve(MOCK_PRICE); })
    );

    const { result } = renderHook(() => usePriceScan());

    act(() => { void result.current.startScan([MATERIAL_WITH_REF]); });
    await act(async () => { await result.current.startScan([MATERIAL_WITH_REF]); });

    // Only one getPrice call should have been made
    expect(mockGetPrice).toHaveBeenCalledTimes(1);
    await act(async () => { resolveFirst(); });
  });

  it('only fetches the selected materials when selectedIds is provided', async () => {
    mockGetPrice.mockResolvedValue(MOCK_PRICE);
    const { result } = renderHook(() => usePriceScan());

    // Only select mat-1, pass both materials
    await act(async () => {
      await result.current.startScan(
        [MATERIAL_WITH_REF, MATERIAL_B],
        undefined,
        new Set(['mat-1'])
      );
    });

    // mat-1 should be fetched
    expect(result.current.prices['mat-1']['materielelectrique'].status).toBe('success');
    // mat-b should NOT have been touched (no entry initialised)
    expect(result.current.prices['mat-b']?.['materielelectrique']?.status).toBeUndefined();
    expect(mockGetPrice).toHaveBeenCalledTimes(1);
  });

  it('skips fetching when a cell has a fresh price (< 24h)', async () => {
    mockGetPrice.mockResolvedValue(MOCK_PRICE);
    const { result } = renderHook(() => usePriceScan());

    // First scan — populates with a fresh price
    await act(async () => { await result.current.startScan([MATERIAL_WITH_REF]); });
    expect(mockGetPrice).toHaveBeenCalledTimes(1);

    // Second scan immediately after — price is still fresh, should be skipped
    mockGetPrice.mockClear();
    await act(async () => { await result.current.startScan([MATERIAL_WITH_REF]); });
    expect(mockGetPrice).toHaveBeenCalledTimes(0);
  });

  it('re-fetches when the cached price is stale (> 24h)', async () => {
    // First scan stores a fresh price
    mockGetPrice.mockResolvedValue(MOCK_PRICE);
    const { result } = renderHook(() => usePriceScan());
    await act(async () => { await result.current.startScan([MATERIAL_WITH_REF]); });
    expect(mockGetPrice).toHaveBeenCalledTimes(1);

    // Confirm second scan (fresh) is skipped
    mockGetPrice.mockClear();
    await act(async () => { await result.current.startScan([MATERIAL_WITH_REF]); });
    expect(mockGetPrice).toHaveBeenCalledTimes(0);

    // Fast-forward time by 25 h so the cached price becomes stale
    const realNow = Date.now;
    vi.spyOn(Date, 'now').mockReturnValue(realNow() + 25 * 60 * 60 * 1000);

    try {
      mockGetPrice.mockClear();
      mockGetPrice.mockResolvedValue({ ...MOCK_PRICE, fetchedAt: new Date().toISOString() });
      await act(async () => { await result.current.startScan([MATERIAL_WITH_REF]); });
      expect(mockGetPrice).toHaveBeenCalledTimes(1);
    } finally {
      vi.spyOn(Date, 'now').mockRestore();
    }
  });
});
