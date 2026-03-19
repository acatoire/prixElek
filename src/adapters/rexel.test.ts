/**
 * src/adapters/rexel.test.ts
 *
 * Unit tests for RexelAdapter.
 * All HTTP calls intercepted by MSW.
 */

import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import axios from 'axios';
import { RexelAdapter, decodeRexelToken, extractAccountId, extractWebshopId, extractApiKey } from './rexel';
import { FetchError } from '@/types/error';

const SKU = '70569480';
const API_URL = 'https://eu.dif.rexel.com/web/api/v3/product/priceandavailability';

// Build a minimal valid JWT with an accountNumber, webshopId and api_key embedded
function makeJwt(accountNumber: string, webshopId = 'FRW', apiKey = 'test-api-key'): string {
  const payload = Buffer.from(
    JSON.stringify({
      ERPCustomerID: { accountNumber },
      WebshopID: { webshopId },
      api_key: apiKey,
      exp: 9999999999,
    })
  ).toString('base64url');
  return `header.${payload}.signature`;
}

const ACCOUNT_ID = '6440598';
const TOKEN = makeJwt(ACCOUNT_ID);
const BRANCH_ID = '4413';
const CREDS = { token: TOKEN, branchId: BRANCH_ID, zipcode: '44880', city: 'SAUTRON' };

function makeResponse(overrides?: {
  sku?: string;
  unitPrice?: number;
  availableQty?: number;
  noPrices?: boolean;
}) {
  const o = { sku: SKU, unitPrice: 21.048, availableQty: 2, noPrices: false, ...overrides };
  return {
    lines: [
      {
        sku: o.sku,
        prices: o.noPrices ? [] : [
          { price: { amount: o.unitPrice, currency: 'EUR' }, priceLabel: 'UNIT_LIST_PRICE' },
          { price: { amount: 21.05, currency: 'EUR' }, priceLabel: 'LINE_TOTAL_PRICE_NOVAT' },
          { price: { amount: 33.904, currency: 'EUR' }, priceLabel: 'GROSS_LIST_PRICE' },
        ],
        availabilities: [
          { type: 'DELIVERY_BRANCH_AVAILABILITY', quantity: { available: o.availableQty } },
        ],
      },
    ],
  };
}

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function mockApi(body: object, status = 200) {
  server.use(http.post(API_URL, () =>
    status === 200
      ? HttpResponse.json(body, { status: 200 })
      : new HttpResponse(null, { status })
  ));
}

describe('RexelAdapter', () => {
  let adapter: RexelAdapter;
  beforeAll(() => { adapter = new RexelAdapter(CREDS); });

  // ── JWT helpers ─────────────────────────────────────────────────────────────

  describe('decodeRexelToken', () => {
    it('extracts accountNumber from a valid JWT', () => {
      const decoded = decodeRexelToken(TOKEN);
      expect(decoded.ERPCustomerID?.accountNumber).toBe(ACCOUNT_ID);
    });

    it('returns empty object for a garbage token', () => {
      expect(decodeRexelToken('not.a.jwt')).toEqual({});
    });

    it('returns empty object for an empty string', () => {
      expect(decodeRexelToken('')).toEqual({});
    });
  });

  describe('extractAccountId', () => {
    it('returns the accountNumber from a valid JWT', () => {
      expect(extractAccountId(TOKEN)).toBe(ACCOUNT_ID);
    });

    it('returns empty string when token has no ERPCustomerID', () => {
      const bare = `header.${Buffer.from('{}').toString('base64url')}.sig`;
      expect(extractAccountId(bare)).toBe('');
    });
  });

  describe('extractWebshopId', () => {
    it('returns the webshopId from a valid JWT', () => {
      expect(extractWebshopId(TOKEN)).toBe('FRW');
    });

    it('returns empty string when token has no WebshopID', () => {
      const bare = `header.${Buffer.from('{}').toString('base64url')}.sig`;
      expect(extractWebshopId(bare)).toBe('');
    });
  });

  describe('extractApiKey', () => {
    it('returns the api_key from a valid JWT', () => {
      expect(extractApiKey(TOKEN)).toBe('test-api-key');
    });

    it('returns empty string when token has no api_key', () => {
      const bare = `header.${Buffer.from('{}').toString('base64url')}.sig`;
      expect(extractApiKey(bare)).toBe('');
    });
  });

  it('has correct supplierId', () => {
    expect(adapter.supplierId).toBe('rexel');
  });

  it('throws AUTH_ERROR when no token provided', async () => {
    const empty = new RexelAdapter({ token: '', branchId: BRANCH_ID, zipcode: '44880', city: 'SAUTRON' });
    await expect(empty.getPrice(SKU)).rejects.toMatchObject({ code: 'AUTH_ERROR' });
  });

  it('throws AUTH_ERROR when token has no accountId', async () => {
    const noAccount = `header.${Buffer.from('{"exp":9999}').toString('base64url')}.sig`;
    const a = new RexelAdapter({ token: noAccount, branchId: BRANCH_ID, zipcode: '44880', city: 'SAUTRON' });
    await expect(a.getPrice(SKU)).rejects.toMatchObject({ code: 'AUTH_ERROR' });
  });

  it('throws AUTH_ERROR when branchId is missing', async () => {
    const a = new RexelAdapter({ token: TOKEN, branchId: '', zipcode: '44880', city: 'SAUTRON' });
    await expect(a.getPrice(SKU)).rejects.toMatchObject({ code: 'AUTH_ERROR' });
  });

  describe('getPrice — happy path', () => {
    it('parses UNIT_LIST_PRICE and in-stock availability', async () => {
      mockApi(makeResponse());
      const price = await adapter.getPrice(SKU);
      expect(price.prix_ht).toBe(21.048);
      expect(price.stock).toBe(1);
      expect(price.unite).toBe('pièce');
      expect(price.fetchedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it('returns stock=0 when all delivery availabilities are 0', async () => {
      mockApi(makeResponse({ availableQty: 0 }));
      const price = await adapter.getPrice(SKU);
      expect(price.stock).toBe(0);
    });

    it('falls back to LINE_TOTAL_PRICE_NOVAT when UNIT_LIST_PRICE absent', async () => {
      const body = makeResponse();
      body.lines[0].prices = body.lines[0].prices.filter(
        (p) => p.priceLabel !== 'UNIT_LIST_PRICE'
      );
      mockApi(body);
      const price = await adapter.getPrice(SKU);
      expect(price.prix_ht).toBe(21.05);
    });
  });

  describe('getPrice — error cases', () => {
    it('throws AUTH_ERROR on HTTP 401', async () => {
      mockApi({}, 401);
      await expect(adapter.getPrice(SKU)).rejects.toMatchObject({ code: 'AUTH_ERROR', retryable: false });
    });

    it('throws AUTH_ERROR on HTTP 403', async () => {
      mockApi({}, 403);
      await expect(adapter.getPrice(SKU)).rejects.toMatchObject({ code: 'AUTH_ERROR' });
    });

    it('throws RATE_LIMIT on HTTP 429', async () => {
      mockApi({}, 429);
      await expect(adapter.getPrice(SKU)).rejects.toMatchObject({ code: 'RATE_LIMIT', retryable: true });
    });

    it('throws NOT_FOUND on HTTP 404', async () => {
      mockApi({}, 404);
      await expect(adapter.getPrice(SKU)).rejects.toMatchObject({ code: 'NOT_FOUND' });
    });

    it('throws NETWORK_ERROR on HTTP 503', async () => {
      mockApi({}, 503);
      await expect(adapter.getPrice(SKU)).rejects.toMatchObject({ code: 'NETWORK_ERROR', retryable: true });
    });

    it('throws NETWORK_ERROR on connection failure', async () => {
      server.use(http.post(API_URL, () => HttpResponse.error()));
      await expect(adapter.getPrice(SKU)).rejects.toMatchObject({ code: 'NETWORK_ERROR' });
    });

    it('throws NETWORK_ERROR on non-axios error', async () => {
      const spy = vi.spyOn(axios, 'post').mockRejectedValueOnce(new TypeError('plain error'));
      await expect(adapter.getPrice(SKU)).rejects.toMatchObject({ code: 'NETWORK_ERROR' });
      spy.mockRestore();
    });

    it('throws NOT_FOUND when lines array is empty', async () => {
      mockApi({ lines: [] });
      await expect(adapter.getPrice(SKU)).rejects.toMatchObject({ code: 'NOT_FOUND' });
    });

    it('throws PARSE_ERROR when no prices in line', async () => {
      mockApi(makeResponse({ noPrices: true }));
      await expect(adapter.getPrice(SKU)).rejects.toMatchObject({ code: 'PARSE_ERROR' });
    });
  });
});

