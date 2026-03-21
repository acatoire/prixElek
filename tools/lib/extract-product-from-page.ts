/**
 * tools/lib/extract-product-from-page.ts
 *
 * Fetches a materielelectrique.com product page URL and extracts
 * the structured product data needed to populate a catalogue entry.
 *
 * This is the shared logic used by add-to-catalogue.ts and its tests.
 */

import axios from 'axios';
import type { ScrapingConfig } from '../../src/adapters/materielelectrique';
import { DEFAULT_SCRAPING_CONFIG } from '../../src/adapters/materielelectrique';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ExtractedProduct {
  /** Slug derived from the URL slug portion */
  id: string;
  /** Product name from JSON-LD */
  nom: string;
  /** Brand name from JSON-LD */
  marque: string;
  /** Category derived from breadcrumb or GTM dataLayer */
  categorie: string;
  /** Supplier reference (SKU) for materielelectrique.com */
  reference: string;
  /** EAN-13 barcode if present */
  ean: string | null;
}

interface SchemaProduct {
  '@type': string;
  name?: string;
  sku?: string;
  mpn?: string;
  brand?: { name?: string } | string;
  offers?: { gtin13?: string };
  category?: string;
}

// ── Slug derivation ───────────────────────────────────────────────────────────

/**
 * Derives a stable catalogue id from a materielelectrique.com URL.
 * Input:  https://www.materielelectrique.com/prise-2p-t-legrand-p-123.html
 * Output: prise-2p-t-legrand-p-123
 */
export function slugFromUrl(url: string): string {
  const path = new URL(url).pathname;
  const filename = path.split('/').filter(Boolean).pop() ?? 'unknown';
  return filename.replace(/\.html?$/i, '');
}

// ── JSON-LD extraction ────────────────────────────────────────────────────────

/**
 * Finds the first schema.org/Product block in the HTML.
 * Returns null if none found.
 */
export function findProductInHtml(html: string): SchemaProduct | null {
  const blocks = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi) ?? [];
  for (const block of blocks) {
    const text = block.replace(/<\/?script[^>]*>/gi, '').trim();
    try {
      const obj = JSON.parse(text) as Record<string, unknown>;
      if (obj['@type'] === 'Product') return obj as unknown as SchemaProduct;
    } catch {
      continue;
    }
  }
  return null;
}

/**
 * Extracts category from dataLayer.push() GTM call if present.
 * Falls back to 'Appareillage'.
 */
export function extractCategoryFromHtml(html: string): string {
  const match = html.match(/"category"\s*:\s*"([^"]+)"/);
  if (!match) return 'Appareillage';
  // The GTM dataLayer often escapes non-ASCII as \uXXXX — unescape them
  return match[1].trim().replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) =>
    String.fromCharCode(parseInt(hex, 16))
  );
}

// ── Main extraction ───────────────────────────────────────────────────────────

/**
 * Fetches a product page URL and returns the extracted product data.
 * @throws Error if the page cannot be fetched or contains no Product JSON-LD
 */
export async function extractProductFromUrl(
  url: string,
  config: ScrapingConfig = DEFAULT_SCRAPING_CONFIG
): Promise<ExtractedProduct> {
  const response = await axios.get<ArrayBuffer>(url, {
    // Use arraybuffer so we control UTF-8 decoding — axios in Node defaults to
    // latin1 for text, which corrupts accented characters (é → Ã©, ® → Â®).
    responseType: 'arraybuffer',
    headers: {
      'User-Agent': config.userAgent,
      Accept: 'text/html,application/xhtml+xml',
      'Accept-Language': 'fr-FR,fr;q=0.9',
    },
    timeout: config.requestTimeoutMs,
  });

  const html = typeof response.data === 'string'
    ? response.data
    : new TextDecoder('utf-8').decode(response.data as ArrayBuffer);
  return extractProductFromHtml(html, url);
}

/**
 * Pure extraction from already-fetched HTML — used directly in tests.
 */
export function extractProductFromHtml(html: string, url: string): ExtractedProduct {
  const product = findProductInHtml(html);
  if (!product) {
    throw new Error(`No schema.org/Product JSON-LD found on page: ${url}`);
  }

  const name = product.name ?? '';
  if (!name) throw new Error(`Product JSON-LD has no name on: ${url}`);

  const sku = product.sku ?? product.mpn ?? '';
  if (!sku) throw new Error(`Product JSON-LD has no sku/mpn on: ${url}`);

  const brandRaw = product.brand;
  const marque =
    typeof brandRaw === 'string'
      ? brandRaw
      : typeof brandRaw === 'object' && brandRaw !== null
        ? (brandRaw.name ?? '')
        : '';

  const categorie = extractCategoryFromHtml(html);
  const ean = product.offers?.gtin13 ?? null;

  return {
    id: sku,
    nom: name,
    marque,
    categorie,
    reference: slugFromUrl(url),
    ean,
  };
}

