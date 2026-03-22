/**
 * src/hooks/useRexelAuth.test.ts
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useRexelAuth } from './useRexelAuth';

// Valid minimal Rexel JWT payload (base64url of JSON with ERPCustomerID.accountNumber)
const ACCOUNT = '123456';
const FAKE_PAYLOAD = btoa(JSON.stringify({ ERPCustomerID: { accountNumber: ACCOUNT } }))
  .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
const FAKE_TOKEN = `header.${FAKE_PAYLOAD}.sig`;

const CREDS = { token: FAKE_TOKEN, branchId: '4413', zipcode: '44880', city: 'SAUTRON' };

beforeEach(() => { localStorage.clear(); });
afterEach(() => { localStorage.clear(); });

describe('useRexelAuth', () => {
  it('starts disconnected when localStorage is empty', () => {
    const { result } = renderHook(() => useRexelAuth());
    expect(result.current.isConnected).toBe(false);
    expect(result.current.token).toBe('');
  });

  it('reads persisted token from localStorage on mount', () => {
    localStorage.setItem('prixelek_rexel_token', FAKE_TOKEN);
    localStorage.setItem('prixelek_rexel_branchId', '4413');
    localStorage.setItem('prixelek_rexel_zipcode', '44880');
    localStorage.setItem('prixelek_rexel_city', 'SAUTRON');
    const { result } = renderHook(() => useRexelAuth());
    expect(result.current.token).toBe(FAKE_TOKEN);
    expect(result.current.isConnected).toBe(true);
    expect(result.current.accountId).toBe(ACCOUNT);
  });

  it('saveCredentials persists to localStorage and marks connected', () => {
    const { result } = renderHook(() => useRexelAuth());
    act(() => { result.current.saveCredentials(CREDS); });
    expect(result.current.isConnected).toBe(true);
    expect(localStorage.getItem('prixelek_rexel_token')).toBe(FAKE_TOKEN);
    expect(localStorage.getItem('prixelek_rexel_branchId')).toBe('4413');
  });

  it('saveCredentials trims whitespace from token', () => {
    const { result } = renderHook(() => useRexelAuth());
    act(() => { result.current.saveCredentials({ ...CREDS, token: `  ${FAKE_TOKEN}  ` }); });
    expect(result.current.token).toBe(FAKE_TOKEN);
  });

  it('clearToken removes localStorage keys and marks disconnected', () => {
    localStorage.setItem('prixelek_rexel_token', FAKE_TOKEN);
    const { result } = renderHook(() => useRexelAuth());
    act(() => { result.current.clearToken(); });
    expect(result.current.isConnected).toBe(false);
    expect(result.current.token).toBe('');
    expect(localStorage.getItem('prixelek_rexel_token')).toBeNull();
  });

  it('accountId is empty string when token is empty', () => {
    const { result } = renderHook(() => useRexelAuth());
    expect(result.current.accountId).toBe('');
  });
});

