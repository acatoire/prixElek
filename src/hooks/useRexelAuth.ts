/**
 * src/hooks/useRexelAuth.ts
 *
 * Manages the Rexel Bearer token.
 * - Persisted in localStorage so it survives page reloads.
 * - Exposes the token, a setter, and a clear function.
 */

import { useState, useCallback } from 'react';

const STORAGE_KEY = 'prixelek_rexel_token';

export interface UseRexelAuthReturn {
  token: string;
  isConnected: boolean;
  saveToken: (token: string) => void;
  clearToken: () => void;
}

export function useRexelAuth(): UseRexelAuthReturn {
  const [token, setToken] = useState<string>(
    () => localStorage.getItem(STORAGE_KEY) ?? ''
  );

  const saveToken = useCallback((t: string) => {
    const clean = t.trim();
    localStorage.setItem(STORAGE_KEY, clean);
    setToken(clean);
  }, []);

  const clearToken = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setToken('');
  }, []);

  return {
    token,
    isConnected: token.length > 0,
    saveToken,
    clearToken,
  };
}

