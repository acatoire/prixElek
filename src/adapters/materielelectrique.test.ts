/**
 * src/adapters/materielelectrique.test.ts
 *
 * Unit tests for MaterielElectriqueAdapter.
 * All HTTP calls are intercepted by MSW — no real network traffic.
 */

import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import axios from 'axios';
import { MaterielElectriqueAdapter, loadScrapingConfig, DEFAULT_SCRAPING_CONFIG } from './materielelectrique';
import { FetchError } from '@/types/error';

// ── Test fixtures ─────────────────────────────────────────────────────────────

const REF = 'LEG067128';
const REAL_SLUG = 'prise-de-courant-legrand-celiane-4x2p-t-p-297691';
// Direct product page URL pattern
const DIRECT_URL = `https://www.materielelectrique.com/${REAL_SLUG}.html`;

function makeHtml(overrides?: Partial<{
  sku: string;
  mpn: string;
  price: number | string;
  availability: string;
  hasOffer: boolean;
  hasProduct: boolean;
}>): string {
  const o = {
    sku: REF,
    mpn: '067128',
    price: 18.64,
    availability: 'https://schema.org/InStock',
    hasOffer: true,
    hasProduct: true,
    ...overrides,
  };

  const offerBlock = o.hasOffer
    ? `"offers": {
        "@type": "Offer",
        "price": ${JSON.stringify(o.price)},
        "priceCurrency": "EUR",
        "availability": "${o.availability}"
      }`
    : '';

  const productBlock = o.hasProduct
    ? JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'Product',
        sku: o.sku,
        mpn: o.mpn,
        name: 'Test product',
        ...(o.hasOffer
          ? {
              offers: {
                '@type': 'Offer',
                price: o.price,
                priceCurrency: 'EUR',
                availability: o.availability,
              },
            }
          : {}),
      })
    : '{"@type":"BreadcrumbList"}';

  // Suppress offerBlock warning — it's used via productBlock stringification above
  void offerBlock;

  return `<html><head>
    <script type="application/ld+json">${productBlock}</script>
  </head><body></body></html>`;
}

// ── MSW server ────────────────────────────────────────────────────────────────

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function mockDirect(html: string, status = 200): void {
  server.use(
    http.get(DIRECT_URL, () =>
      status === 200
        ? HttpResponse.text(html, { status: 200 })
        : new HttpResponse(null, { status })
    )
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('MaterielElectriqueAdapter', () => {
  let adapter: MaterielElectriqueAdapter;

  beforeAll(() => {
    // delay=0 keeps tests fast; timeout small enough to catch hangs
    adapter = new MaterielElectriqueAdapter({ delayBetweenRequestsMs: 0, requestTimeoutMs: 5_000 });
  });

  it('has correct supplierId', () => {
    expect(adapter.supplierId).toBe('materielelectrique');
  });

  describe('loadScrapingConfig', () => {
    it('returns defaults when called with no overrides', () => {
      const cfg = loadScrapingConfig();
      expect(cfg).toEqual(DEFAULT_SCRAPING_CONFIG);
    });

    it('merges partial overrides over defaults', () => {
      const cfg = loadScrapingConfig({ delayBetweenRequestsMs: 0 });
      expect(cfg.delayBetweenRequestsMs).toBe(0);
      expect(cfg.requestTimeoutMs).toBe(DEFAULT_SCRAPING_CONFIG.requestTimeoutMs);
    });
  });

  describe('getBaseUrl (via getPrice URL)', () => {
    it('uses the direct URL in Node (no window object)', async () => {
      // Adapter tests run in Node environment — window is undefined
      const spy = vi.spyOn(axios, 'get').mockResolvedValueOnce({ data: makeHtml() });
      await adapter.getPrice(REF, REAL_SLUG).catch(() => {/* ignore parse result */});
      const calledUrl = spy.mock.calls[0][0] as string;
      expect(calledUrl).toContain('materielelectrique.com');
      expect(calledUrl).not.toContain('/proxy/');
      spy.mockRestore();
    });

    it('uses the direct product page URL when a valid pageSlug is provided', async () => {
      const spy = vi.spyOn(axios, 'get').mockResolvedValueOnce({ data: makeHtml() });
      await adapter.getPrice(REF, REAL_SLUG).catch(() => {});
      const calledUrl = spy.mock.calls[0][0] as string;
      expect(calledUrl).toContain(`/${REAL_SLUG}.html`);
      spy.mockRestore();
    });

    it('falls back to search URL when pageSlug has no -p-<digits> suffix', async () => {
      const spy = vi.spyOn(axios, 'get').mockResolvedValueOnce({ data: makeHtml() });
      await adapter.getPrice(REF, 'some-manual-slug-without-id').catch(() => {});
      const calledUrl = spy.mock.calls[0][0] as string;
      expect(calledUrl).toContain('product_search');
      spy.mockRestore();
    });
  });

  describe('authenticate', () => {
    it('returns success without credentials (public site)', async () => {
      const result = await adapter.authenticate('', '');
      expect(result).toEqual({ success: true, token: '' });
    });
  });

  describe('getPrice — happy path', () => {
    it('parses price from JSON-LD for exact SKU match (direct page URL)', async () => {
      mockDirect(makeHtml());
      const price = await adapter.getPrice(REF, REAL_SLUG);
      expect(price.prix_ht).toBe(18.64);
      expect(price.unite).toBe('pièce');
      expect(price.stock).toBe(1);
      expect(price.fetchedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it('matches by mpn when sku does not match', async () => {
      mockDirect(makeHtml({ sku: 'SOMETHING-ELSE', mpn: '067128' }));
      const price = await adapter.getPrice('067128', REAL_SLUG);
      expect(price.prix_ht).toBe(18.64);
    });

    it('handles LimitedAvailability as in-stock', async () => {
      mockDirect(makeHtml({ availability: 'https://schema.org/LimitedAvailability' }));
      const price = await adapter.getPrice(REF, REAL_SLUG);
      expect(price.stock).toBe(1);
    });

    it('handles OutOfStock → stock 0', async () => {
      mockDirect(makeHtml({ availability: 'https://schema.org/OutOfStock' }));
      const price = await adapter.getPrice(REF, REAL_SLUG);
      expect(price.stock).toBe(0);
    });

    it('handles BackOrder → stock 0', async () => {
      mockDirect(makeHtml({ availability: 'https://schema.org/BackOrder' }));
      const price = await adapter.getPrice(REF, REAL_SLUG);
      expect(price.stock).toBe(0);
    });

    it('handles unknown availability → stock 0', async () => {
      mockDirect(makeHtml({ availability: 'https://schema.org/Unknown' }));
      const price = await adapter.getPrice(REF, REAL_SLUG);
      expect(price.stock).toBe(0);
    });
  });

  describe('getPrice — error cases', () => {
    it('throws NOT_FOUND when reference is absent from JSON-LD', async () => {
      mockDirect(makeHtml({ sku: 'OTHER-REF', mpn: 'OTHER' }));
      await expect(adapter.getPrice(REF, REAL_SLUG)).rejects.toMatchObject({
        code: 'NOT_FOUND',
        supplierId: 'materielelectrique',
        retryable: false,
      });
    });

    it('throws PARSE_ERROR when no JSON-LD blocks present', async () => {
      mockDirect('<html><body>no structured data</body></html>');
      await expect(adapter.getPrice(REF, REAL_SLUG)).rejects.toMatchObject({
        code: 'PARSE_ERROR',
      });
    });

    it('throws PARSE_ERROR when product has no offers block', async () => {
      mockDirect(makeHtml({ hasOffer: false }));
      await expect(adapter.getPrice(REF, REAL_SLUG)).rejects.toMatchObject({
        code: 'PARSE_ERROR',
      });
    });

    it('throws PARSE_ERROR when price is not a number', async () => {
      mockDirect(makeHtml({ price: 'contact us' }));
      await expect(adapter.getPrice(REF, REAL_SLUG)).rejects.toMatchObject({
        code: 'PARSE_ERROR',
      });
    });

    it('throws RATE_LIMIT on HTTP 429', async () => {
      mockDirect('', 429);
      await expect(adapter.getPrice(REF, REAL_SLUG)).rejects.toMatchObject({
        code: 'RATE_LIMIT',
        retryable: true,
        statusCode: 429,
      });
    });

    it('throws NETWORK_ERROR on HTTP 503', async () => {
      mockDirect('', 503);
      await expect(adapter.getPrice(REF, REAL_SLUG)).rejects.toMatchObject({
        code: 'NETWORK_ERROR',
        retryable: true,
        statusCode: 503,
      });
    });

    it('throws NETWORK_ERROR on connection failure', async () => {
      server.use(
        http.get(DIRECT_URL, () => HttpResponse.error())
      );
      await expect(adapter.getPrice(REF, REAL_SLUG)).rejects.toMatchObject({
        code: 'NETWORK_ERROR',
        retryable: true,
      });
    });

    it('throws NETWORK_ERROR when a non-Axios error is thrown', async () => {
      // Bypass MSW — spy on axios.get directly to throw a plain (non-Axios) Error
      const spy = vi.spyOn(axios, 'get').mockRejectedValueOnce(new TypeError('plain non-axios error'));
      await expect(adapter.getPrice(REF, REAL_SLUG)).rejects.toMatchObject({
        code: 'NETWORK_ERROR',
        retryable: true,
      });
      spy.mockRestore();
    });
  });

  describe('parseHtml — edge cases', () => {
    it('skips malformed JSON-LD blocks and continues', () => {
      const html = `<html>
        <script type="application/ld+json">{ INVALID JSON </script>
        <script type="application/ld+json">${JSON.stringify({
          '@type': 'Product',
          sku: REF,
          offers: { '@type': 'Offer', price: 9.99, priceCurrency: 'EUR', availability: 'https://schema.org/InStock' },
        })}</script>
      </html>`;
      const result = adapter.parseHtml(html, REF);
      expect(result.prix_ht).toBe(9.99);
    });

    it('finds product nested inside an ItemList block', () => {
      const html = `<html><script type="application/ld+json">${JSON.stringify({
        '@type': 'ItemList',
        itemListElement: [
          {
            '@type': 'ListItem',
            item: {
              '@type': 'Product',
              sku: REF,
              offers: { '@type': 'Offer', price: 7.5, priceCurrency: 'EUR', availability: 'https://schema.org/InStock' },
            },
          },
        ],
      })}</script></html>`;
      const result = adapter.parseHtml(html, REF);
      expect(result.prix_ht).toBe(7.5);
    });

    it('is case-insensitive for reference matching', () => {
      const html = `<html><script type="application/ld+json">${JSON.stringify({
        '@type': 'Product',
        sku: 'leg067128',
        offers: { '@type': 'Offer', price: 5.0, priceCurrency: 'EUR', availability: 'https://schema.org/InStock' },
      })}</script></html>`;
      const result = adapter.parseHtml(html, 'LEG067128');
      expect(result.prix_ht).toBe(5.0);
    });
  });

  describe('parseHtml — branch coverage', () => {
    it('matches a product with no sku field (sku is undefined → falls back to empty string)', () => {
      // sku field absent: rawSku branch is ''
      const html = `<html><script type="application/ld+json">${JSON.stringify({
        '@type': 'Product',
        mpn: '067128',
        offers: { '@type': 'Offer', price: 3.0, priceCurrency: 'EUR', availability: 'https://schema.org/InStock' },
      })}</script></html>`;
      const result = adapter.parseHtml(html, '067128');
      expect(result.prix_ht).toBe(3.0);
    });

    it('matches a product with no mpn field (mpn is undefined → falls back to empty string)', () => {
      // mpn field absent: rawMpn branch is '' — match happens via sku
      const html = `<html><script type="application/ld+json">${JSON.stringify({
        '@type': 'Product',
        sku: REF,
        // mpn intentionally absent
        offers: { '@type': 'Offer', price: 4.0, priceCurrency: 'EUR', availability: 'https://schema.org/InStock' },
      })}</script></html>`;
      const result = adapter.parseHtml(html, REF);
      expect(result.prix_ht).toBe(4.0);
    });

    it('matches sku when both sku and mpn are present but only sku matches', () => {
      // Exercises the sku===ref branch while mpn !== '' (both branches of the ternary on lines 171-172)
      const html = `<html><script type="application/ld+json">${JSON.stringify({
        '@type': 'Product',
        sku: REF,
        mpn: 'WRONG-MPN',
        offers: { '@type': 'Offer', price: 5.5, priceCurrency: 'EUR', availability: 'https://schema.org/InStock' },
      })}</script></html>`;
      const result = adapter.parseHtml(html, REF);
      expect(result.prix_ht).toBe(5.5);
    });

    it('continues past a non-matching nested object and finds match in a later sibling', () => {
      // First nested object value does NOT match → object-recursion returns null (line 192 null branch) → loop continues
      const html = `<html><script type="application/ld+json">${JSON.stringify({
        '@type': 'WebPage',
        irrelevant: {
          '@type': 'Organization',
          name: 'something else',
        },
        mainEntity: {
          '@type': 'Product',
          sku: REF,
          offers: { '@type': 'Offer', price: 77.0, priceCurrency: 'EUR', availability: 'https://schema.org/InStock' },
        },
      })}</script></html>`;
      const result = adapter.parseHtml(html, REF);
      expect(result.prix_ht).toBe(77.0);
    });

    it('returns the first match when multiple products exist in an array (early-return branch in array loop)', () => {
      // Two matching products in an array — must return the first one found (line 177 early return)
      const html = `<html><script type="application/ld+json">${JSON.stringify({
        '@type': 'ItemList',
        itemListElement: [
          {
            '@type': 'ListItem',
            item: {
              '@type': 'Product',
              sku: REF,
              offers: { '@type': 'Offer', price: 11.11, priceCurrency: 'EUR', availability: 'https://schema.org/InStock' },
            },
          },
          {
            '@type': 'ListItem',
            item: {
              '@type': 'Product',
              sku: REF,
              offers: { '@type': 'Offer', price: 22.22, priceCurrency: 'EUR', availability: 'https://schema.org/InStock' },
            },
          },
        ],
      })}</script></html>`;
      const result = adapter.parseHtml(html, REF);
      expect(result.prix_ht).toBe(11.11); // first match wins
    });

    it('returns a match found via recursive plain-object traversal (early-return branch for object values)', () => {
      // Product is nested inside a plain object property (not an array), triggers line 190 branch
      const html = `<html><script type="application/ld+json">${JSON.stringify({
        '@type': 'WebPage',
        mainEntity: {
          '@type': 'Product',
          sku: REF,
          offers: { '@type': 'Offer', price: 55.5, priceCurrency: 'EUR', availability: 'https://schema.org/InStock' },
        },
      })}</script></html>`;
      const result = adapter.parseHtml(html, REF);
      expect(result.prix_ht).toBe(55.5);
    });

    it('treats missing availability as Unknown → stock 0 (availability ?? "" branch)', () => {
      // offer.availability is absent — hits the ?? '' nullish branch (line 222)
      const html = `<html><script type="application/ld+json">${JSON.stringify({
        '@type': 'Product',
        sku: REF,
        offers: { '@type': 'Offer', price: 6.0, priceCurrency: 'EUR' /* no availability field */ },
      })}</script></html>`;
      const result = adapter.parseHtml(html, REF);
      expect(result.stock).toBe(0); // 'Unknown' availability → out of stock
    });
  });

  describe('FetchError properties', () => {
    it('is an instance of Error', () => {
      const err = new FetchError({ code: 'TIMEOUT', supplierId: 'test', message: 'timed out' });
      expect(err).toBeInstanceOf(Error);
      expect(err.name).toBe('FetchError');
      expect(err.statusCode).toBeNull();
      expect(err.retryable).toBe(false);
    });
  });
});










