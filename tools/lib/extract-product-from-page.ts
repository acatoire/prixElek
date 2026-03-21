/**
 * tools/lib/extract-product-from-page.ts
 *
 * Fetches a materielelectrique.com product page URL and extracts
 * the structured product data needed to populate a catalogue entry.
 *
 * Pure extraction logic lives in src/services/extractProduct.ts and is
 * shared with the React app — this file only adds the Node/axios fetch layer.
 */

import axios from 'axios';
import type { ScrapingConfig } from '../../src/adapters/materielelectrique';
import { DEFAULT_SCRAPING_CONFIG } from '../../src/adapters/materielelectrique';

// Re-export everything so existing importers (catalogue-io, tests, add-to-catalogue)
// don't need to change their import paths.
export type { ExtractedProduct } from '@/services/extractProduct';
export {
  slugFromUrl,
  findProductInHtml,
  extractCategoryFromHtml,
  extractProductFromHtml,
} from '@/services/extractProduct';

import { extractProductFromHtml } from '@/services/extractProduct';
import type { ExtractedProduct } from '@/services/extractProduct';

// ── Node/axios fetch layer ────────────────────────────────────────────────────

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
