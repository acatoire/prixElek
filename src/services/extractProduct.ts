/**
 * src/services/extractProduct.ts
 *
 * Pure, browser-safe HTML extraction logic for materielelectrique.com product pages.
 * No Node.js or axios dependencies — safe to import in both the React app and CLI tools.
 *
 * Used by:
 *   - src/components/AddFromUrlModal.tsx  (browser, via Vite proxy)
 *   - tools/lib/extract-product-from-page.ts  (Node CLI, re-exports these + adds axios fetch)
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ExtractedProduct {
  /** SKU / product identifier from JSON-LD */
  id: string;
  /** Product name from JSON-LD */
  nom: string;
  /** Brand name from JSON-LD */
  marque: string;
  /** Category derived from GTM dataLayer */
  categorie: string;
  /** Supplier reference (URL slug) for materielelectrique.com */
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
 * Derives a stable catalogue reference from a materielelectrique.com URL.
 * Input:  https://www.materielelectrique.com/prise-2p-t-legrand-p-123.html
 * Output: prise-2p-t-legrand-p-123
 */
export function slugFromUrl(url: string): string {
  try {
    const path = new URL(url).pathname;
    const filename = path.split('/').filter(Boolean).pop() ?? 'unknown';
    return filename.replace(/\.html?$/i, '');
  } catch {
    return 'unknown';
  }
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
 * Unescapes \uXXXX sequences that GTM often emits for non-ASCII characters.
 */
export function extractCategoryFromHtml(html: string): string {
  const match = html.match(/"category"\s*:\s*"([^"]+)"/);
  if (!match) return 'Appareillage';
  return match[1].trim().replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) =>
    String.fromCharCode(parseInt(hex, 16))
  );
}

// ── Main pure extraction ──────────────────────────────────────────────────────

/**
 * Extracts structured product data from already-fetched HTML.
 * Throws if no Product JSON-LD is found or required fields are missing.
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

