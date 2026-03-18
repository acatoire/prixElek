/**
 * src/adapters/materielelectrique.ts
 *
 * Adapter for materielelectrique.com.
 *
 * Strategy: prices are publicly visible without login.
 * The product page embeds a JSON-LD <script type="application/ld+json"> block
 * with full schema.org/Product + Offer data including price, currency,
 * availability and EAN. We fetch the HTML and parse that block.
 *
 * URL pattern: https://www.materielelectrique.com/search?q={reference}
 * redirects to the product page, or returns a listing page from which
 * we pick the first exact-SKU match.
 *
 * Confirmed from probe on 2026-03-18:
 *   JSON-LD offers.price       → 18.64
 *   JSON-LD offers.availability → "https://schema.org/InStock"
 *   JSON-LD sku                → "LEG067128"
 */

import axios from 'axios';
import { SupplierAdapter } from './base';
import { FetchError } from '@/types/error';
import type { SupplierPrice } from '@/types/price';

const BASE_URL = 'https://www.materielelectrique.com';

/**
 * When running in the browser, requests to materielelectrique.com are
 * blocked by CORS. We route them through the Vite dev-server proxy instead:
 *   /proxy/materielelectrique/... → https://www.materielelectrique.com/...
 *
 * In Node (CLI tools, tests), we call the site directly.
 */
function getBaseUrl(): string {
  if (typeof window !== 'undefined') {
    return '/proxy/materielelectrique';
  }
  return BASE_URL;
}

// ── Scraping config ───────────────────────────────────────────────────────────

export interface ScrapingConfig {
  delayBetweenRequestsMs: number;
  requestTimeoutMs: number;
  userAgent: string;
}

/** Safe conservative defaults — used when config file is absent or unreadable */
export const DEFAULT_SCRAPING_CONFIG: ScrapingConfig = {
  delayBetweenRequestsMs: 3_000,
  requestTimeoutMs: 15_000,
  userAgent:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36',
};

/**
 * Loads scraping configuration from config/scraping.config.json.
 * Falls back to DEFAULT_SCRAPING_CONFIG if the file is missing or invalid.
 * Accepts an optional override for testability.
 */
export function loadScrapingConfig(override?: Partial<ScrapingConfig>): ScrapingConfig {
  return { ...DEFAULT_SCRAPING_CONFIG, ...override };
}

// ── Schema.org types ──────────────────────────────────────────────────────────

/** Maps schema.org availability IRIs to stock status */
const AVAILABILITY_MAP: Record<string, string> = {
  'https://schema.org/InStock': 'InStock',
  'https://schema.org/OutOfStock': 'OutOfStock',
  'https://schema.org/LimitedAvailability': 'LimitedAvailability',
  'https://schema.org/BackOrder': 'BackOrder',
  'https://schema.org/PreOrder': 'PreOrder',
};

interface SchemaOffer {
  '@type': string;
  price?: number;
  priceCurrency?: string;
  availability?: string;
  gtin13?: string;
}

interface SchemaProduct {
  '@type': string;
  sku?: string;
  mpn?: string;
  name?: string;
  offers?: SchemaOffer;
}

export class MaterielElectriqueAdapter extends SupplierAdapter {
  readonly supplierId = 'materielelectrique';

  private readonly config: ScrapingConfig;
  private lastRequestAt = 0;

  /**
   * @param config - Optional scraping config override (useful in tests to set delay=0)
   */
  constructor(config?: Partial<ScrapingConfig>) {
    super();
    this.config = loadScrapingConfig(config);
  }

  /** Enforce a minimum delay between requests — configured via scraping.config.json */
  private async throttle(): Promise<void> {
    const elapsed = Date.now() - this.lastRequestAt;
    const delay = this.config.delayBetweenRequestsMs;
    if (elapsed < delay) {
      await new Promise((r) => setTimeout(r, delay - elapsed));
    }
    this.lastRequestAt = Date.now();
  }

  /**
   * Fetches the product page for the given reference and parses the JSON-LD block.
   *
   * @param reference - The supplier SKU (e.g. "LEG067128") used to match the JSON-LD block.
   * @param pageSlug  - Optional URL slug of the product page (e.g. the catalogue material id
   *                    "prise-de-courant-legrand-celiane-4x2p-t-p-297691").
   *                    When provided the adapter fetches /{pageSlug}.html directly, which is
   *                    far more reliable than the site's search endpoint.
   *                    Falls back to the search URL when absent.
   */
  async getPrice(reference: string, pageSlug?: string): Promise<SupplierPrice> {
    await this.throttle();

    // Use the direct product page URL when the slug contains the PrestaShop product-id
    // pattern (-p-<digits>), which means it was scraped and is reliable.
    // Fall back to the site's search for manually-entered slugs without a numeric id.
    const isRealSlug = pageSlug && /-p-\d+$/.test(pageSlug);
    const productUrl = isRealSlug
      ? `${getBaseUrl()}/${pageSlug}.html`
      : `${getBaseUrl()}/?product_search[term]=${encodeURIComponent(reference)}`;
    let html: string;

    try {
      const response = await axios.get<string>(productUrl, {
        headers: {
          'User-Agent': this.config.userAgent,
          Accept: 'text/html,application/xhtml+xml',
          'Accept-Language': 'fr-FR,fr;q=0.9',
        },
        timeout: this.config.requestTimeoutMs,
      });
      html = response.data;
    } catch (err) {
      if (axios.isAxiosError(err)) {
        const status = err.response?.status;
        if (status === 429) {
          throw new FetchError({
            code: 'RATE_LIMIT',
            supplierId: this.supplierId,
            message: 'Rate limited by materielelectrique.com',
            statusCode: 429,
            retryable: true,
          });
        }
        throw new FetchError({
          code: 'NETWORK_ERROR',
          supplierId: this.supplierId,
          message: err.message,
          statusCode: status,
          retryable: true,
        });
      }
      throw new FetchError({
        code: 'NETWORK_ERROR',
        supplierId: this.supplierId,
        message: String(err),
        retryable: true,
      });
    }

    return this.parseHtml(html, reference);
  }

  /**
   * Parses the first schema.org/Product JSON-LD block from the HTML.
   * Looks for an item whose sku or mpn matches the reference (case-insensitive).
   */
  parseHtml(html: string, reference: string): SupplierPrice {
    const blocks = html.match(
      /<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi
    );

    if (!blocks || blocks.length === 0) {
      throw new FetchError({
        code: 'PARSE_ERROR',
        supplierId: this.supplierId,
        message: 'No JSON-LD blocks found on page',
        retryable: false,
      });
    }

    const normalizedRef = reference.replace(/[^A-Z0-9]/gi, '').toUpperCase();

    for (const block of blocks) {
      const jsonText = block.replace(/<\/?script[^>]*>/gi, '').trim();
      let parsed: unknown;
      try {
        parsed = JSON.parse(jsonText);
      } catch {
        continue;
      }

      const product = this.findMatchingProduct(parsed, normalizedRef);
      if (product) {
        return this.extractPrice(product);
      }
    }

    throw new FetchError({
      code: 'NOT_FOUND',
      supplierId: this.supplierId,
      message: `Référence ${reference} introuvable sur la page (JSON-LD absent ou SKU non concordant)`,
      retryable: false,
    });
  }

  /** Recursively search a parsed JSON-LD object for a Product matching the reference */
  private findMatchingProduct(
    node: unknown,
    normalizedRef: string
  ): SchemaProduct | null {
    if (!node || typeof node !== 'object') return null;

    const obj = node as Record<string, unknown>;

    // Direct Product match
    if (obj['@type'] === 'Product') {
      const rawSku = obj['sku'] !== undefined ? String(obj['sku']) : '';
      const rawMpn = obj['mpn'] !== undefined ? String(obj['mpn']) : '';
      const sku = rawSku.replace(/[^A-Z0-9]/gi, '').toUpperCase();
      const mpn = rawMpn.replace(/[^A-Z0-9]/gi, '').toUpperCase();
      if (sku === normalizedRef || mpn === normalizedRef) {
        return obj as SchemaProduct;
      }
    }

    // Recurse into arrays and nested objects
    for (const value of Object.values(obj)) {
      if (Array.isArray(value)) {
        for (const item of value) {
          const found = this.findMatchingProduct(item, normalizedRef);
          if (found) return found;
        }
      } else if (typeof value === 'object' && value !== null) {
        const found = this.findMatchingProduct(value, normalizedRef);
        if (found) return found;
      }
    }

    return null;
  }

  /** Extract a SupplierPrice from a confirmed schema.org/Product node */
  private extractPrice(product: SchemaProduct): SupplierPrice {
    const offer = product.offers;
    if (!offer) {
      throw new FetchError({
        code: 'PARSE_ERROR',
        supplierId: this.supplierId,
        message: 'Product found but has no offers block',
        retryable: false,
      });
    }

    const price = typeof offer.price === 'number' ? offer.price : null;
    if (price === null) {
      throw new FetchError({
        code: 'PARSE_ERROR',
        supplierId: this.supplierId,
        message: 'Offer found but price is missing or not a number',
        retryable: false,
      });
    }

    const availabilityIri = offer.availability ?? '';
    const availability = AVAILABILITY_MAP[availabilityIri] ?? 'Unknown';
    const inStock = availability === 'InStock' || availability === 'LimitedAvailability';

    return {
      prix_ht: price,
      stock: inStock ? 1 : 0,
      unite: 'pièce',
      fetchedAt: new Date().toISOString(),
    };
  }
}





