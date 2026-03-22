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

import type { PriceTier } from '@/types/price';
import { MATERIELELECTRIQUE_VAT_RATE } from '@/config/vatRates';

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
  /** Quantity discount tiers, undefined when no tiered pricing exists */
  tiers?: PriceTier[];
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

// ── Tiered pricing extraction ─────────────────────────────────────────────────

/**
 * Parses the quantity-discount table inside `id="decreasing-prices"` if present.
 *
 * HTML pattern (materielelectrique.com):
 *   <tbody>
 *     <tr><td>1+</td><td><span class="ex-vat">1,2083€</span><span class="inc-vat">1,45€</span></td><td>-</td></tr>
 *     <tr><td>20+</td><td><span class="ex-vat">1,1333€</span><span class="inc-vat">1,36€</span></td><td>6 %</td></tr>
 *   </tbody>
 *
 * Returns undefined when the section is absent.
 */
export function extractTiersFromHtml(html: string): PriceTier[] | undefined {
  const sectionMatch = html.match(/id="decreasing-prices"[\s\S]*?<\/table>/i);
  if (!sectionMatch) return undefined;

  const section = sectionMatch[0];
  // Each tier row: <tr>...<td>QTY+</td>...<span class="ex-vat">PRICE€</span>...<td>DISC</td>...</tr>
  const rowRegex = /<tr[\s\S]*?<\/tr>/gi;
  const rows = section.match(rowRegex);
  if (!rows || rows.length < 2) return undefined; // header row only → no tiers

  const tiers: PriceTier[] = [];

  for (const row of rows) {
    // Skip the header row (contains "Quantité" or "Vous gagnez")
    if (/Quantit|Prix unitaire|Vous gagnez/i.test(row)) continue;

    // Min quantity: "20+" or "1+"
    const qtyMatch = row.match(/<td[^>]*>\s*(\d+)\+?\s*<\/td>/i);
    if (!qtyMatch) continue;
    const minQty = parseInt(qtyMatch[1], 10);

    // HT price from ex-vat span: "1,1333 €" or "1,1333€" → 1.1333
    const htMatch = row.match(/class="ex-vat"[^>]*>([\d,\.]+)\s*€/i);
    // TTC price from inc-vat span
    const ttcMatch = row.match(/class="inc-vat"[^>]*>([\d,\.]+)\s*€/i);

    if (!htMatch && !ttcMatch) continue;

    let prix_ht: number;
    let prix_ttc: number;

    if (htMatch) {
      prix_ht = parseFloat(htMatch[1].replace(',', '.'));
      prix_ttc = ttcMatch
        ? parseFloat(ttcMatch[1].replace(',', '.'))
        : Math.round(prix_ht * (1 + MATERIELELECTRIQUE_VAT_RATE) * 100) / 100;
    } else {
      prix_ttc = parseFloat(ttcMatch![1].replace(',', '.'));
      prix_ht = Math.round((prix_ttc / (1 + MATERIELELECTRIQUE_VAT_RATE)) * 10000) / 10000;
    }

    // Discount percentage — last <td> of the row, "-" for the base tier
    const discMatch = row.match(/<td[^>]*>\s*(\d+)\s*%\s*<\/td>/i);
    const discountPct = discMatch ? parseInt(discMatch[1], 10) : 0;

    tiers.push({ minQty, prix_ht, prix_ttc, discountPct });
  }

  if (tiers.length === 0) return undefined;
  // Sort ascending by minQty so callers can walk them in order
  tiers.sort((a, b) => a.minQty - b.minQty);
  return tiers;
}

/**
 * Given a list of tiers and a quantity, returns the best applicable tier.
 * Falls back to the first tier when quantity is below all thresholds.
 */
export function bestTierForQty(tiers: PriceTier[], qty: number): PriceTier {
  let best = tiers[0];
  for (const tier of tiers) {
    if (qty >= tier.minQty) best = tier;
  }
  return best;
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
  return match[1]
    .trim()
    .replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
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
  const tiers = extractTiersFromHtml(html);

  return {
    id: sku,
    nom: name,
    marque,
    categorie,
    reference: slugFromUrl(url),
    ean,
    ...(tiers ? { tiers } : {}),
  };
}
