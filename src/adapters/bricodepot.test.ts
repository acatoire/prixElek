/**
 * src/adapters/bricodepot.test.ts
 *
 * Unit tests for BricodepotAdapter.
 * All HTTP calls are intercepted by MSW — no real network traffic.
 */

import { describe, it, expect, beforeAll, beforeEach, afterAll, afterEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { BricodepotAdapter, BRICODEPOT_VAT_RATE, type BricodepotConfig } from './bricodepot';
import { FetchError } from '@/types/error';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const REF = 'catalogue/cable-electrique-r2v-3g25-mm-noir-100-m/prod10739';
const PRODUCT_URL = `https://www.bricodepot.fr/${REF}`;

/** Build a minimal Bricodepot product page HTML */
function makeHtml(opts?: {
  price?: number | string | null;
  hasProduct?: boolean;
  hasOffer?: boolean;
  outOfStock?: boolean;
  dataPrice?: string | null;
}): string {
  const o = {
    price: 116.0,
    hasProduct: true,
    hasOffer: true,
    outOfStock: false,
    dataPrice: undefined as string | null | undefined,
    ...opts,
  };

  const offerBlock =
    o.hasOffer && o.price !== null
      ? `"offers": { "@type": "Offer", "price": ${JSON.stringify(o.price)}, "priceCurrency": "EUR" }`
      : '';

  const jsonLd = o.hasProduct
    ? JSON.stringify({
        '@context': 'http://schema.org',
        '@type': 'Product',
        sku: '811743',
        name: 'Câble électrique R2V 3G2,5 mm² noir - 100 m',
        ...(o.hasOffer && o.price !== null
          ? {
              offers: {
                '@type': 'Offer',
                price: o.price,
                priceCurrency: 'EUR',
              },
            }
          : {}),
      })
    : '{"@type":"BreadcrumbList"}';

  void offerBlock; // satisfied by jsonLd stringification above

  const stockClass = o.outOfStock ? 'bd-Stock--unavailable' : 'bd-Stock--available';
  const dataAttr =
    o.dataPrice !== null && o.dataPrice !== undefined
      ? `<div class="bd-Price bd-Price-no-operation" data-price="${o.dataPrice}">`
      : '';

  return `<html><head>
    <script type="application/ld+json">${jsonLd}</script>
  </head><body>
    <div class="${stockClass}"></div>
    <div class="bd-Product-price bd-Product-price-national">
      ${dataAttr}
    </div>
  </body></html>`;
}

// ── MSW server ────────────────────────────────────────────────────────────────

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function mockPage(html: string, status = 200): void {
  server.use(
    http.get(PRODUCT_URL, () =>
      HttpResponse.text(html, { status })
    )
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('BricodepotAdapter', () => {
  let adapter: BricodepotAdapter;

  // Fresh adapter before each test — resets throttle state so tests don't wait 10 s each
  beforeEach(() => {
    // skipSessionSeed: true prevents the homepage fetch from triggering MSW
    const opts: BricodepotConfig = { delayBetweenRequestsMs: 0, requestTimeoutMs: 5_000, skipSessionSeed: true };
    adapter = new BricodepotAdapter(opts);
  });

  // ── getPrice happy path ──────────────────────────────────────────────────

  it('returns correct HT price from JSON-LD numeric price', async () => {
    mockPage(makeHtml({ price: 116.0 }));
    const result = await adapter.getPrice(REF);
    const expectedHt = Math.round((116.0 / (1 + BRICODEPOT_VAT_RATE)) * 100) / 100;
    expect(result.prix_ht).toBeCloseTo(expectedHt);
    expect(result.prix_ttc).toBe(116.0);
    expect(result.stock).toBe(1);
    expect(result.unite).toBe('pièce');
    expect(result.fetchedAt).toBeTruthy();
  });

  it('parses JSON-LD price when given as a string', async () => {
    mockPage(makeHtml({ price: '116.0' }));
    const result = await adapter.getPrice(REF);
    expect(result.prix_ttc).toBe(116.0);
  });

  it('returns stock=0 when out-of-stock class is present', async () => {
    mockPage(makeHtml({ outOfStock: true }));
    const result = await adapter.getPrice(REF);
    expect(result.stock).toBe(0);
  });

  // ── Fallback: data-price attr ────────────────────────────────────────────

  it('falls back to data-price attr when JSON-LD has no offer', async () => {
    mockPage(makeHtml({ hasOffer: false, dataPrice: '116.00' }));
    const result = await adapter.getPrice(REF);
    expect(result.prix_ttc).toBe(116.0);
  });

  // ── Error cases ──────────────────────────────────────────────────────────

  it('throws PARSE_ERROR when no price found anywhere', async () => {
    mockPage(makeHtml({ hasOffer: false, dataPrice: null }));
    await expect(adapter.getPrice(REF)).rejects.toMatchObject({
      code: 'PARSE_ERROR',
    });
  });

  it('throws NOT_FOUND on HTTP 404', async () => {
    mockPage('', 404);
    await expect(adapter.getPrice(REF)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  it('throws RATE_LIMIT on HTTP 429', async () => {
    mockPage('', 429);
    await expect(adapter.getPrice(REF)).rejects.toMatchObject({ code: 'RATE_LIMIT' });
  });

  it('throws RATE_LIMIT on HTTP 403 (anti-scraping block)', async () => {
    mockPage('', 403);
    await expect(adapter.getPrice(REF)).rejects.toMatchObject({ code: 'RATE_LIMIT' });
  });

  it('throws NETWORK_ERROR on HTTP 500', async () => {
    mockPage('', 500);
    await expect(adapter.getPrice(REF)).rejects.toMatchObject({
      code: 'NETWORK_ERROR',
    });
  });

  it('throws NETWORK_ERROR on connection refused', async () => {
    // No handler registered → MSW will throw
    server.use(
      http.get(PRODUCT_URL, () => HttpResponse.error())
    );
    await expect(adapter.getPrice(REF)).rejects.toBeInstanceOf(FetchError);
  });

  // ── parseHtml unit tests ─────────────────────────────────────────────────

  describe('parseHtml', () => {
    it('ignores non-Product JSON-LD blocks', () => {
      const html = `<script type="application/ld+json">{"@type":"Organization"}</script>
        <div class="bd-Product-price bd-Product-price-national">
          <div class="bd-Price bd-Price-no-operation" data-price="99.00">
        </div>`;
      const result = adapter.parseHtml(html, REF);
      expect(result.prix_ttc).toBe(99.0);
    });

    it('converts TTC to HT at 20%', () => {
      const result = adapter.parseHtml(makeHtml({ price: 120.0 }), REF);
      expect(result.prix_ht).toBeCloseTo(100.0);
    });
  });

  // ── extractPriceFromJsonLd unit tests ────────────────────────────────────

  describe('extractPriceFromJsonLd', () => {
    it('returns null for HTML with no JSON-LD', () => {
      expect(adapter.extractPriceFromJsonLd('<html></html>')).toBeNull();
    });

    it('returns null when price is 0 or negative', () => {
      const html = `<script type="application/ld+json">
        {"@type":"Product","offers":{"price":0}}</script>`;
      expect(adapter.extractPriceFromJsonLd(html)).toBeNull();
    });

    it('handles numeric price field', () => {
      const html = `<script type="application/ld+json">
        {"@type":"Product","offers":{"price":77.9}}</script>`;
      expect(adapter.extractPriceFromJsonLd(html)).toBe(77.9);
    });
  });
});

