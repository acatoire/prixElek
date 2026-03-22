/**
 * src/adapters/bricodepot.ts
 *
 * Adapter for bricodepot.fr (ATG Web Commerce CMS).
 *
 * Anti-scraping — ATG Web Commerce requires session cookies (JSESSIONID,
 * DYN_USER_ID, f5avr*).  The user pastes the Cookie: header value from a
 * working browser request once; stored in localStorage under
 * prixelek_bricodepot_cookies and injected on every request.
 */

import axios from 'axios';
import { SupplierAdapter } from './base';
import { FetchError } from '@/types/error';
import type { SupplierPrice } from '@/types/price';
import type { ScrapingConfig } from './materielelectrique';
import { loadScrapingConfig } from './materielelectrique';

const BASE_URL = 'https://www.bricodepot.fr';

function getProductUrl(reference: string): string {
  if (typeof window !== 'undefined') {
    // Browser: use the Vite dev-server plugin endpoint which fetches Node-side
    // (the Vite proxy triggers 403 on Bricodepot's WAF; direct Node fetch works).
    return `/api/bricodepot-page?path=${encodeURIComponent(reference)}`;
  }
  return `${BASE_URL}/${reference}`;
}

export const BRICODEPOT_VAT_RATE = 0.2;

const BROWSER_HEADERS = {
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'fr,fr-FR;q=0.9,en-US;q=0.8,en;q=0.7',
  'Accept-Encoding': 'gzip, deflate, br, zstd',
  Connection: 'keep-alive',
  'Upgrade-Insecure-Requests': '1',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'none',
  Priority: 'u=0, i',
  TE: 'trailers',
} as const;

interface SchemaOffer {
  '@type'?: string;
  price?: number | string;
  priceCurrency?: string;
  availability?: string;
}

interface SchemaProduct {
  '@type': string;
  sku?: string;
  name?: string;
  offers?: SchemaOffer;
}

/** Constructor options */
export interface BricodepotConfig extends Partial<ScrapingConfig> {
  /** Raw Cookie: header value from a working browser session */
  cookies?: string;
  /** Kept for test backwards-compat — no longer used */
  skipSessionSeed?: boolean;
}

export class BricodepotAdapter extends SupplierAdapter {
  readonly supplierId = 'bricodepot';

  private readonly config: ScrapingConfig;
  private readonly cookies: string;
  private lastRequestAt = 0;

  constructor(config?: BricodepotConfig) {
    super();
    const { skipSessionSeed: _skip, cookies, ...rest } = config ?? {};
    this.config = loadScrapingConfig(rest);
    this.cookies = cookies?.trim() ?? '';
  }

  private async throttle(): Promise<void> {
    const elapsed = Date.now() - this.lastRequestAt;
    const delay = this.config.delayBetweenRequestsMs;
    if (elapsed < delay) {
      await new Promise((r) => setTimeout(r, delay - elapsed));
    }
    this.lastRequestAt = Date.now();
  }

  async getPrice(reference: string): Promise<SupplierPrice> {
    await this.throttle();

    const isBrowser = typeof window !== 'undefined';
    const productUrl = getProductUrl(reference);

    const headers: Record<string, string> = {
      'User-Agent': this.config.userAgent,
      ...BROWSER_HEADERS,
      Referer: `${BASE_URL}/`,
      'Sec-Fetch-Site': 'same-origin',
    };

    // Cookie injection kept for Node CLI usage if ever needed — not required in practice
    if (!isBrowser && this.cookies) headers['Cookie'] = this.cookies;

    let html: string;
    try {
      const response = await axios.get<ArrayBuffer | string>(productUrl, {
        // Browser calls /api/bricodepot-page which returns decoded text.
        // Node calls bricodepot.fr directly — use arraybuffer for UTF-8 safety.
        responseType: isBrowser ? 'text' : 'arraybuffer',
        headers: isBrowser ? {} : headers, // browser endpoint handles its own headers
        timeout: this.config.requestTimeoutMs,
        maxRedirects: 5,
      });
      html =
        typeof response.data === 'string'
          ? response.data
          : new TextDecoder('utf-8').decode(response.data as ArrayBuffer);
    } catch (err) {
      if (axios.isAxiosError(err)) {
        const status = err.response?.status;
        if (status === 429 || status === 403) {
          throw new FetchError({
            code: 'RATE_LIMIT',
            supplierId: this.supplierId,
            message:
              status === 403
                ? 'Bricodepot 403 — session expirée, recollectez les cookies via le bouton 🍪'
                : 'Rate limited by bricodepot.fr',
            statusCode: status,
            retryable: false,
          });
        }
        if (status === 404) {
          throw new FetchError({
            code: 'NOT_FOUND',
            supplierId: this.supplierId,
            message: `Page introuvable : ${reference}`,
            statusCode: 404,
            retryable: false,
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

  parseHtml(html: string, reference: string): SupplierPrice {
    const jsonLdPrice = this.extractPriceFromJsonLd(html);
    if (jsonLdPrice !== null) return this.buildSupplierPrice(jsonLdPrice, html);
    const dataPrice = this.extractPriceFromDataAttr(html);
    if (dataPrice !== null) return this.buildSupplierPrice(dataPrice, html);
    throw new FetchError({
      code: 'PARSE_ERROR',
      supplierId: this.supplierId,
      message: `Prix introuvable sur la page Bricodepot : ${reference}`,
      retryable: false,
    });
  }

  extractPriceFromJsonLd(html: string): number | null {
    const blocks = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi) ?? [];
    for (const block of blocks) {
      const text = block.replace(/<\/?script[^>]*>/gi, '').trim();
      let obj: unknown;
      try {
        obj = JSON.parse(text);
      } catch {
        continue;
      }
      if (!obj || typeof obj !== 'object') continue;
      const product = obj as SchemaProduct;
      if (product['@type'] !== 'Product') continue;
      const offer = product.offers;
      if (!offer) continue;
      const raw = offer.price;
      if (raw === undefined || raw === null) continue;
      const parsed = typeof raw === 'number' ? raw : parseFloat(String(raw));
      if (!isNaN(parsed) && parsed > 0) return parsed;
    }
    return null;
  }

  extractPriceFromDataAttr(html: string): number | null {
    const m = html.match(
      /class="bd-Product-price[^"]*bd-Product-price-national"[\s\S]*?data-price="([\d.]+)"/
    );
    if (m) {
      const parsed = parseFloat(m[1]);
      if (!isNaN(parsed) && parsed > 0) return parsed;
    }
    return null;
  }

  private buildSupplierPrice(priceTtc: number, html: string): SupplierPrice {
    const prix_ht = Math.round((priceTtc / (1 + BRICODEPOT_VAT_RATE)) * 100) / 100;
    const outOfStock =
      html.includes('bd-Stock--unavailable') ||
      html.includes('Rupture de stock') ||
      html.includes('IndisponibleEnLigne');
    return {
      prix_ht,
      prix_ttc: priceTtc,
      stock: outOfStock ? 0 : 1,
      unite: 'pièce',
      fetchedAt: new Date().toISOString(),
    };
  }
}
