/**
 * src/services/extractProduct.test.ts
 *
 * Unit tests for the browser-safe extraction logic.
 * These are the same cases as tools/lib/extract-product-from-page.test.ts
 * (minus extractProductFromUrl which lives in the tools layer).
 */

import { describe, it, expect } from 'vitest';
import {
  slugFromUrl,
  findProductInHtml,
  extractCategoryFromHtml,
  extractProductFromHtml,
} from './extractProduct';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const PRODUCT_URL =
  'https://www.materielelectrique.com/prise-de-courant-legrand-celiane-4x2p-t-compacte-precablee-standard-francais-p-297691.html';

function makeHtml(overrides?: {
  name?: string;
  sku?: string;
  mpn?: string;
  brand?: string | { name: string };
  gtin13?: string;
  category?: string;
  noProduct?: boolean;
}): string {
  const o = {
    name: 'Prise Céliane 4x2P+T',
    sku: 'LEG067128',
    mpn: '067128',
    brand: { name: 'Legrand' },
    gtin13: '3245060671280',
    category: 'Prise de Courant, Prise Usb',
    noProduct: false,
    ...overrides,
  };

  const productJson = o.noProduct
    ? JSON.stringify({ '@type': 'BreadcrumbList' })
    : JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'Product',
        name: o.name,
        sku: o.sku,
        mpn: o.mpn,
        brand: o.brand,
        offers: { '@type': 'Offer', price: 18.64, gtin13: o.gtin13 },
      });

  const gtmPush = `dataLayer.push({"event":"detail","ecommerce":{"detail":{"product":[{"name":"${o.name}","category":"${o.category}"}]}}})`;

  return `<html><head>
    <script type="application/ld+json">${productJson}</script>
  </head><body><script>${gtmPush}</script></body></html>`;
}

// ── slugFromUrl ───────────────────────────────────────────────────────────────

describe('slugFromUrl', () => {
  it('strips the .html extension', () => {
    expect(slugFromUrl(PRODUCT_URL)).toBe(
      'prise-de-courant-legrand-celiane-4x2p-t-compacte-precablee-standard-francais-p-297691'
    );
  });

  it('handles URLs without an extension', () => {
    expect(slugFromUrl('https://www.materielelectrique.com/produit-test')).toBe('produit-test');
  });

  it('returns "unknown" for root URL with no path', () => {
    expect(slugFromUrl('https://www.materielelectrique.com/')).toBe('unknown');
  });

  it('returns "unknown" for an invalid URL', () => {
    expect(slugFromUrl('not-a-url')).toBe('unknown');
  });
});

// ── findProductInHtml ─────────────────────────────────────────────────────────

describe('findProductInHtml', () => {
  it('returns the Product JSON-LD object', () => {
    const result = findProductInHtml(makeHtml());
    expect(result?.['@type']).toBe('Product');
    expect(result?.sku).toBe('LEG067128');
  });

  it('returns null when no JSON-LD is present', () => {
    expect(findProductInHtml('<html><body>nothing</body></html>')).toBeNull();
  });

  it('returns null when JSON-LD exists but is not a Product', () => {
    expect(findProductInHtml(makeHtml({ noProduct: true }))).toBeNull();
  });

  it('skips malformed JSON-LD and returns null', () => {
    const html = `<html><script type="application/ld+json">{ INVALID </script></html>`;
    expect(findProductInHtml(html)).toBeNull();
  });
});

// ── extractCategoryFromHtml ───────────────────────────────────────────────────

describe('extractCategoryFromHtml', () => {
  it('extracts category from dataLayer push', () => {
    expect(extractCategoryFromHtml(makeHtml({ category: 'Prise de Courant, Prise Usb' }))).toBe(
      'Prise de Courant, Prise Usb'
    );
  });

  it('falls back to "Appareillage" when no category found', () => {
    expect(extractCategoryFromHtml('<html></html>')).toBe('Appareillage');
  });

  it('unescapes \\uXXXX sequences emitted by GTM', () => {
    const html = makeHtml({ category: '\\u00c9clairage' });
    expect(extractCategoryFromHtml(html)).toBe('Éclairage');
  });
});

// ── extractProductFromHtml ────────────────────────────────────────────────────

describe('extractProductFromHtml', () => {
  it('returns a complete ExtractedProduct from a valid page', () => {
    const result = extractProductFromHtml(makeHtml(), PRODUCT_URL);
    expect(result.id).toBe('LEG067128');
    expect(result.nom).toBe('Prise Céliane 4x2P+T');
    expect(result.marque).toBe('Legrand');
    expect(result.reference).toBe(
      'prise-de-courant-legrand-celiane-4x2p-t-compacte-precablee-standard-francais-p-297691'
    );
    expect(result.ean).toBe('3245060671280');
    expect(result.categorie).toBe('Prise de Courant, Prise Usb');
  });

  it('uses mpn as id when sku is absent', () => {
    const html = makeHtml({ sku: undefined as unknown as string, mpn: '067128' });
    expect(extractProductFromHtml(html, PRODUCT_URL).id).toBe('067128');
  });

  it('handles brand as a plain string', () => {
    expect(extractProductFromHtml(makeHtml({ brand: 'Schneider' }), PRODUCT_URL).marque).toBe(
      'Schneider'
    );
  });

  it('handles missing brand gracefully', () => {
    expect(
      extractProductFromHtml(makeHtml({ brand: undefined as unknown as string }), PRODUCT_URL)
        .marque
    ).toBe('');
  });

  it('handles brand as object with no name field', () => {
    expect(
      extractProductFromHtml(makeHtml({ brand: {} as { name: string } }), PRODUCT_URL).marque
    ).toBe('');
  });

  it('returns null ean when gtin13 is absent', () => {
    expect(
      extractProductFromHtml(makeHtml({ gtin13: undefined as unknown as string }), PRODUCT_URL).ean
    ).toBeNull();
  });

  it('throws when no Product JSON-LD is found', () => {
    expect(() =>
      extractProductFromHtml('<html><body>empty</body></html>', PRODUCT_URL)
    ).toThrow('No schema.org/Product JSON-LD found');
  });

  it('throws when product name is empty', () => {
    expect(() => extractProductFromHtml(makeHtml({ name: '' }), PRODUCT_URL)).toThrow('no name');
  });

  it('throws when sku and mpn are both absent', () => {
    const html = makeHtml({
      sku: undefined as unknown as string,
      mpn: undefined as unknown as string,
    });
    expect(() => extractProductFromHtml(html, PRODUCT_URL)).toThrow('no sku/mpn');
  });
});

