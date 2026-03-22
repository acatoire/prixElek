/**
 * src/hooks/useBricodepotAuth.test.ts
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useBricodepotAuth } from './useBricodepotAuth';

const VALID_COOKIES = 'JSESSIONID=abc123; DYN_USER_ID=xyz; other=value';

beforeEach(() => { localStorage.clear(); });
afterEach(() => { localStorage.clear(); });

describe('useBricodepotAuth', () => {
  it('starts disconnected when localStorage is empty', () => {
    const { result } = renderHook(() => useBricodepotAuth());
    expect(result.current.isConnected).toBe(false);
    expect(result.current.cookies).toBe('');
  });

  it('reads persisted cookies from localStorage on mount', () => {
    localStorage.setItem('prixelek_bricodepot_cookies', VALID_COOKIES);
    const { result } = renderHook(() => useBricodepotAuth());
    expect(result.current.cookies).toBe(VALID_COOKIES);
    expect(result.current.isConnected).toBe(true);
  });

  it('saveCookies persists trimmed value and marks connected', () => {
    const { result } = renderHook(() => useBricodepotAuth());
    act(() => { result.current.saveCookies(`  ${VALID_COOKIES}  `); });
    expect(result.current.cookies).toBe(VALID_COOKIES);
    expect(result.current.isConnected).toBe(true);
    expect(localStorage.getItem('prixelek_bricodepot_cookies')).toBe(VALID_COOKIES);
  });

  it('clearCookies removes localStorage key and marks disconnected', () => {
    localStorage.setItem('prixelek_bricodepot_cookies', VALID_COOKIES);
    const { result } = renderHook(() => useBricodepotAuth());
    act(() => { result.current.clearCookies(); });
    expect(result.current.isConnected).toBe(false);
    expect(result.current.cookies).toBe('');
    expect(localStorage.getItem('prixelek_bricodepot_cookies')).toBeNull();
  });
});

