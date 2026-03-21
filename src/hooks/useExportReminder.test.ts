/**
 * src/hooks/useExportReminder.test.ts
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useExportReminder } from './useExportReminder';

const FIVE_MIN = 5 * 60 * 1000;

describe('useExportReminder', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('does not show reminder when lastModifiedAt is null', () => {
    const { result } = renderHook(() => useExportReminder(null, null));
    expect(result.current.showReminder).toBe(false);
  });

  it('does not show reminder when modification is recent (< 5 min)', () => {
    const now = Date.now();
    const { result } = renderHook(() => useExportReminder(now, null));
    expect(result.current.showReminder).toBe(false);
  });

  it('shows reminder after 5 min of unsaved changes', () => {
    const modifiedAt = Date.now() - FIVE_MIN; // exactly 5 min ago
    const { result } = renderHook(() => useExportReminder(modifiedAt, null));
    expect(result.current.showReminder).toBe(true);
  });

  it('does not show reminder when already exported after modification', () => {
    const modifiedAt = Date.now() - FIVE_MIN;
    const exportedAt = modifiedAt + 1000; // exported after modification
    const { result } = renderHook(() => useExportReminder(modifiedAt, exportedAt));
    expect(result.current.showReminder).toBe(false);
  });

  it('hides reminder when lastModifiedAt becomes null (export done)', () => {
    const modifiedAt = Date.now() - FIVE_MIN;
    let mod: number | null = modifiedAt;
    const { result, rerender } = renderHook(() => useExportReminder(mod, null));
    expect(result.current.showReminder).toBe(true);

    mod = null;
    rerender();
    expect(result.current.showReminder).toBe(false);
  });

  it('dismissReminder hides the banner and snoozes for 5 min', () => {
    const modifiedAt = Date.now() - FIVE_MIN;
    const { result } = renderHook(() => useExportReminder(modifiedAt, null));
    expect(result.current.showReminder).toBe(true);

    act(() => { result.current.dismissReminder(); });
    expect(result.current.showReminder).toBe(false);

    // Advance 4:59 — should still be snoozed
    act(() => { vi.advanceTimersByTime(FIVE_MIN - 1000); });
    expect(result.current.showReminder).toBe(false);

    // Advance past the 5-min mark — should reappear
    act(() => { vi.advanceTimersByTime(2000); });
    expect(result.current.showReminder).toBe(true);
  });
});

