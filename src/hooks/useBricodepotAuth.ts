/**
 * src/hooks/useBricodepotAuth.ts
 *
 * Stores the Bricodepot session cookie string in localStorage.
 * The user pastes the value of the Cookie: header from a working curl/browser request.
 * The BricodepotAdapter then injects it on every request, bypassing the ATG
 * session-seed flow entirely.
 */

import { useState, useCallback } from 'react';

const STORAGE_KEY = 'prixelek_bricodepot_cookies';

export interface UseBricodepotAuthReturn {
  cookies: string;
  isConnected: boolean;
  saveCookies: (raw: string) => void;
  clearCookies: () => void;
}

export function useBricodepotAuth(): UseBricodepotAuthReturn {
  const [cookies, setCookies] = useState<string>(() => localStorage.getItem(STORAGE_KEY) ?? '');

  const saveCookies = useCallback((raw: string) => {
    const clean = raw.trim();
    localStorage.setItem(STORAGE_KEY, clean);
    setCookies(clean);
  }, []);

  const clearCookies = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setCookies('');
  }, []);

  return {
    cookies,
    isConnected: cookies.length > 0,
    saveCookies,
    clearCookies,
  };
}
