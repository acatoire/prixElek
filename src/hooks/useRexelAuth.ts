/**
 * src/hooks/useRexelAuth.ts
 *
 * Manages the Rexel Bearer token and branch ID.
 * - Persisted in localStorage so it survives page reloads.
 * - Exposes the token, branchId, a setter, and a clear function.
 */

import { useState, useCallback } from 'react';
import { extractAccountId, type RexelCredentials } from '@/adapters/rexel';

const STORAGE_KEY_TOKEN = 'prixelek_rexel_token';
const STORAGE_KEY_BRANCH = 'prixelek_rexel_branchId';
const STORAGE_KEY_ZIPCODE = 'prixelek_rexel_zipcode';
const STORAGE_KEY_CITY = 'prixelek_rexel_city';

export interface UseRexelAuthReturn {
  token: string;
  branchId: string;
  zipcode: string;
  city: string;
  accountId: string;
  isConnected: boolean;
  saveCredentials: (credentials: RexelCredentials) => void;
  clearToken: () => void;
}

export function useRexelAuth(): UseRexelAuthReturn {
  const [token, setToken] = useState<string>(() => localStorage.getItem(STORAGE_KEY_TOKEN) ?? '');
  const [branchId, setBranchId] = useState<string>(
    () => localStorage.getItem(STORAGE_KEY_BRANCH) ?? ''
  );
  const [zipcode, setZipcode] = useState<string>(
    () => localStorage.getItem(STORAGE_KEY_ZIPCODE) ?? ''
  );
  const [city, setCity] = useState<string>(() => localStorage.getItem(STORAGE_KEY_CITY) ?? '');

  const saveCredentials = useCallback((credentials: RexelCredentials) => {
    const cleanToken = credentials.token.trim();
    const cleanBranch = credentials.branchId.trim();
    const cleanZip = credentials.zipcode.trim();
    const cleanCity = credentials.city.trim();
    localStorage.setItem(STORAGE_KEY_TOKEN, cleanToken);
    localStorage.setItem(STORAGE_KEY_BRANCH, cleanBranch);
    localStorage.setItem(STORAGE_KEY_ZIPCODE, cleanZip);
    localStorage.setItem(STORAGE_KEY_CITY, cleanCity);
    setToken(cleanToken);
    setBranchId(cleanBranch);
    setZipcode(cleanZip);
    setCity(cleanCity);
  }, []);

  const clearToken = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY_TOKEN);
    localStorage.removeItem(STORAGE_KEY_BRANCH);
    localStorage.removeItem(STORAGE_KEY_ZIPCODE);
    localStorage.removeItem(STORAGE_KEY_CITY);
    setToken('');
    setBranchId('');
    setZipcode('');
    setCity('');
  }, []);

  const accountId = token ? extractAccountId(token) : '';

  return {
    token,
    branchId,
    zipcode,
    city,
    accountId,
    isConnected: token.length > 0 && accountId.length > 0 && branchId.length > 0,
    saveCredentials,
    clearToken,
  };
}
