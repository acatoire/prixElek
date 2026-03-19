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

export interface UseRexelAuthReturn {
  token: string;
  branchId: string;
  accountId: string;
  isConnected: boolean;
  saveCredentials: (credentials: RexelCredentials) => void;
  clearToken: () => void;
}

export function useRexelAuth(): UseRexelAuthReturn {
  const [token, setToken] = useState<string>(
    () => localStorage.getItem(STORAGE_KEY_TOKEN) ?? ''
  );
  const [branchId, setBranchId] = useState<string>(
    () => localStorage.getItem(STORAGE_KEY_BRANCH) ?? ''
  );

  const saveCredentials = useCallback((credentials: RexelCredentials) => {
    const cleanToken = credentials.token.trim();
    const cleanBranch = credentials.branchId.trim();
    localStorage.setItem(STORAGE_KEY_TOKEN, cleanToken);
    localStorage.setItem(STORAGE_KEY_BRANCH, cleanBranch);
    setToken(cleanToken);
    setBranchId(cleanBranch);
  }, []);

  const clearToken = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY_TOKEN);
    localStorage.removeItem(STORAGE_KEY_BRANCH);
    setToken('');
    setBranchId('');
  }, []);

  const accountId = token ? extractAccountId(token) : '';

  return {
    token,
    branchId,
    accountId,
    isConnected: token.length > 0 && accountId.length > 0 && branchId.length > 0,
    saveCredentials,
    clearToken,
  };
}
