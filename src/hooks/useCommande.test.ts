/**
 * src/hooks/useCommande.test.ts
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCommande } from './useCommande';

// Mock browser APIs used in exportOrder
const clickMock = vi.fn();
const createObjectURLMock = vi.fn(() => 'blob:fake');
const revokeObjectURLMock = vi.fn();

beforeEach(() => {
  vi.spyOn(URL, 'createObjectURL').mockImplementation(createObjectURLMock);
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(revokeObjectURLMock);
  const realCreateElement = document.createElement.bind(document);
  vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
    if (tag === 'a') return { href: '', download: '', click: clickMock } as unknown as HTMLElement;
    return realCreateElement(tag);
  });
});
afterEach(() => { vi.restoreAllMocks(); });

describe('useCommande', () => {
  it('starts with empty selectedIds and quantities', () => {
    const { result } = renderHook(() => useCommande());
    expect(result.current.selectedIds.size).toBe(0);
    expect(result.current.quantities).toEqual({});
  });

  it('toggleSelected adds an id and initialises quantity to 1', () => {
    const { result } = renderHook(() => useCommande());
    act(() => { result.current.toggleSelected('mat-1'); });
    expect(result.current.selectedIds.has('mat-1')).toBe(true);
    expect(result.current.quantities['mat-1']).toBe(1);
  });

  it('toggleSelected removes an already-selected id', () => {
    const { result } = renderHook(() => useCommande());
    act(() => { result.current.toggleSelected('mat-1'); });
    act(() => { result.current.toggleSelected('mat-1'); });
    expect(result.current.selectedIds.has('mat-1')).toBe(false);
  });

  it('setAllSelected true adds all ids', () => {
    const { result } = renderHook(() => useCommande());
    act(() => { result.current.setAllSelected(['a', 'b', 'c'], true); });
    expect(result.current.selectedIds.size).toBe(3);
    expect(result.current.quantities['a']).toBe(1);
  });

  it('setAllSelected false removes all ids', () => {
    const { result } = renderHook(() => useCommande());
    act(() => { result.current.setAllSelected(['a', 'b'], true); });
    act(() => { result.current.setAllSelected(['a', 'b'], false); });
    expect(result.current.selectedIds.size).toBe(0);
  });

  it('setAllSelected true does not overwrite existing quantity', () => {
    const { result } = renderHook(() => useCommande());
    act(() => { result.current.toggleSelected('a'); });
    act(() => { result.current.setQuantity('a', 5); });
    act(() => { result.current.setAllSelected(['a'], true); });
    expect(result.current.quantities['a']).toBe(5);
  });

  it('setQuantity updates quantity and clamps to min 1', () => {
    const { result } = renderHook(() => useCommande());
    act(() => { result.current.toggleSelected('mat-1'); });
    act(() => { result.current.setQuantity('mat-1', 10); });
    expect(result.current.quantities['mat-1']).toBe(10);
    act(() => { result.current.setQuantity('mat-1', 0); });
    expect(result.current.quantities['mat-1']).toBe(1);
  });

  it('removeItem removes id from selectedIds and quantities', () => {
    const { result } = renderHook(() => useCommande());
    act(() => { result.current.toggleSelected('mat-1'); });
    act(() => { result.current.setQuantity('mat-1', 3); });
    act(() => { result.current.removeItem('mat-1'); });
    expect(result.current.selectedIds.has('mat-1')).toBe(false);
    expect(result.current.quantities['mat-1']).toBeUndefined();
  });

  it('exportOrder triggers a file download', () => {
    const { result } = renderHook(() => useCommande());
    act(() => { result.current.toggleSelected('mat-1'); });
    act(() => { result.current.exportOrder(); });
    expect(clickMock).toHaveBeenCalledOnce();
    expect(createObjectURLMock).toHaveBeenCalledOnce();
  });

  it('importOrder restores selectedIds and quantities from JSON', () => {
    const { result } = renderHook(() => useCommande());
    const snapshot = JSON.stringify({
      exportedAt: new Date().toISOString(),
      lines: [
        { materialId: 'mat-a', quantity: 3 },
        { materialId: 'mat-b', quantity: 7 },
      ],
    });
    act(() => { result.current.importOrder(snapshot); });
    expect(result.current.selectedIds.has('mat-a')).toBe(true);
    expect(result.current.quantities['mat-a']).toBe(3);
    expect(result.current.quantities['mat-b']).toBe(7);
  });

  it('importOrder throws on invalid JSON shape', () => {
    const { result } = renderHook(() => useCommande());
    expect(() => {
      act(() => { result.current.importOrder('{"no":"lines"}'); });
    }).toThrow(/Format de commande invalide/);
  });

  it('importOrder clamps quantity to min 1', () => {
    const { result } = renderHook(() => useCommande());
    const snapshot = JSON.stringify({
      exportedAt: new Date().toISOString(),
      lines: [{ materialId: 'x', quantity: -5 }],
    });
    act(() => { result.current.importOrder(snapshot); });
    expect(result.current.quantities['x']).toBe(1);
  });
});


