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
  extractTiersFromHtml,
  bestTierForQty,
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

// ── extractTiersFromHtml ──────────────────────────────────────────────────────

/** Minimal HTML with the real `#decreasing-prices` table structure */
function makeTierHtml(rows: Array<{ qty: number; exVat: string; incVat: string; disc: string }>): string {
  const rowsHtml = rows.map(r => `
    <tr>
      <td class="bg-lightorange">${r.qty}+</td>
      <td class="bg-lightorange">
        <span class="ex-vat">${r.exVat}</span>
        <span class="inc-vat">${r.incVat}</span>
      </td>
      <td class="bg-lightorange">${r.disc}</td>
    </tr>`).join('');

  return `<html><body>
    <div id="decreasing-prices">
      <table role="presentation">
        <thead>
          <tr>
            <td>Quantité</td>
            <td>Prix unitaire</td>
            <td>Vous gagnez</td>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>
    </div>
  </body></html>`;
}

describe('extractTiersFromHtml', () => {
  it('returns undefined when no #decreasing-prices section exists', () => {
    expect(extractTiersFromHtml('<html><body>no tiers here</body></html>')).toBeUndefined();
  });

  it('returns undefined when table has only a header row', () => {
    const html = `<html><body><div id="decreasing-prices">
      <table><thead><tr><td>Quantité</td><td>Prix unitaire</td><td>Vous gagnez</td></tr></thead>
      <tbody></tbody></table></div></body></html>`;
    expect(extractTiersFromHtml(html)).toBeUndefined();
  });

  it('parses two tiers correctly from real-world structure', () => {
    const html = makeTierHtml([
      { qty: 1,  exVat: '1,2083€', incVat: '1,45€', disc: '-' },
      { qty: 20, exVat: '1,1333€', incVat: '1,36€', disc: '6 %' },
    ]);
    const tiers = extractTiersFromHtml(html);
    expect(tiers).toHaveLength(2);
    expect(tiers![0]).toMatchObject({ minQty: 1,  prix_ht: 1.2083, prix_ttc: 1.45,  discountPct: 0 });
    expect(tiers![1]).toMatchObject({ minQty: 20, prix_ht: 1.1333, prix_ttc: 1.36,  discountPct: 6 });
  });

  it('parses tiers when there is a space before the € sign (real site format)', () => {
    const html = makeTierHtml([
      { qty: 1,  exVat: '1,2083 €', incVat: '1,45 €', disc: '-' },
      { qty: 20, exVat: '1,1333 €', incVat: '1,36 €', disc: '6 %' },
    ]);
    const tiers = extractTiersFromHtml(html);
    expect(tiers).toHaveLength(2);
    expect(tiers![0]).toMatchObject({ minQty: 1,  prix_ht: 1.2083, prix_ttc: 1.45,  discountPct: 0 });
    expect(tiers![1]).toMatchObject({ minQty: 20, prix_ht: 1.1333, prix_ttc: 1.36,  discountPct: 6 });
  });

  it('sorts tiers ascending by minQty', () => {
    const html = makeTierHtml([
      { qty: 50, exVat: '1,00€', incVat: '1,20€', disc: '10 %' },
      { qty: 1,  exVat: '1,12€', incVat: '1,34€', disc: '-' },
      { qty: 20, exVat: '1,05€', incVat: '1,26€', disc: '5 %' },
    ]);
    const tiers = extractTiersFromHtml(html);
    expect(tiers!.map(t => t.minQty)).toEqual([1, 20, 50]);
  });

  it('parses three tiers', () => {
    const html = makeTierHtml([
      { qty: 1,   exVat: '2,00€', incVat: '2,40€', disc: '-' },
      { qty: 10,  exVat: '1,80€', incVat: '2,16€', disc: '10 %' },
      { qty: 100, exVat: '1,60€', incVat: '1,92€', disc: '20 %' },
    ]);
    const tiers = extractTiersFromHtml(html);
    expect(tiers).toHaveLength(3);
    expect(tiers![2]).toMatchObject({ minQty: 100, discountPct: 20 });
  });
});

// ── bestTierForQty ────────────────────────────────────────────────────────────

describe('bestTierForQty', () => {
  const TIERS = [
    { minQty: 1,  prix_ht: 1.2083, prix_ttc: 1.45, discountPct: 0 },
    { minQty: 20, prix_ht: 1.1333, prix_ttc: 1.36, discountPct: 6 },
    { minQty: 50, prix_ht: 1.05,   prix_ttc: 1.26, discountPct: 13 },
  ];

  it('returns first tier for qty = 1', () => {
    expect(bestTierForQty(TIERS, 1).minQty).toBe(1);
  });

  it('returns first tier for qty below all thresholds', () => {
    expect(bestTierForQty(TIERS, 0).minQty).toBe(1);
  });

  it('returns the second tier when qty exactly hits its threshold', () => {
    expect(bestTierForQty(TIERS, 20).minQty).toBe(20);
  });

  it('returns the second tier for qty between second and third tier', () => {
    expect(bestTierForQty(TIERS, 35).minQty).toBe(20);
  });

  it('returns the third tier when qty >= 50', () => {
    expect(bestTierForQty(TIERS, 50).minQty).toBe(50);
    expect(bestTierForQty(TIERS, 200).minQty).toBe(50);
  });
});

