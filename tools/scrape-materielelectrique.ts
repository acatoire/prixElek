/**
 * tools/scrape-materielelectrique.ts
 *
 * Research tool: discovers the price API endpoint used by materielelectrique.com.
 *
 * Prices are publicly visible without login — we can call the internal API
 * directly by replaying the same XHR requests the site makes.
 *
 * Usage (PowerShell):
 *   npx tsx tools/scrape-materielelectrique.ts
 *   npx tsx tools/scrape-materielelectrique.ts LEG-050430
 *
 * What it does:
 *  1. Fetches the product search page for a known reference
 *  2. Tries a set of known internal API patterns used by Magento-based sites
 *  3. Prints the full response so you can document the real endpoint
 *
 * Fill in CONFIRMED_ENDPOINT once discovered and commit to doc/scraping.md.
 */

import axios from 'axios';

const DEFAULT_REF = 'LEG-050430';
const ref = process.argv[2] ?? DEFAULT_REF;
const BASE = 'https://www.materielelectrique.com';

// ─── Known candidate endpoints on Magento / custom shops ──────────────────────
// Update this list after inspecting Network tab in DevTools (F12)
const CANDIDATES: Array<{ label: string; url: string; method?: string }> = [
  {
    label: 'REST product by SKU (Magento 2)',
    url: `${BASE}/rest/V1/products/${encodeURIComponent(ref)}`,
  },
  {
    label: 'REST product search (Magento 2)',
    url: `${BASE}/rest/V1/products?searchCriteria[filterGroups][0][filters][0][field]=sku&searchCriteria[filterGroups][0][filters][0][value]=${encodeURIComponent(ref)}`,
  },
  {
    label: 'GraphQL product price (Magento 2)',
    url: `${BASE}/graphql`,
    method: 'POST',
  },
  {
    label: 'Product page HTML (parse price from meta)',
    url: `${BASE}/catalogsearch/result/?q=${encodeURIComponent(ref)}`,
  },
];

const GRAPHQL_QUERY = {
  query: `{
    products(filter: { sku: { eq: "${ref}" } }) {
      items {
        sku
        name
        price_range {
          minimum_price {
            regular_price { value currency }
            final_price { value currency }
          }
        }
        stock_status
      }
    }
  }`,
};

const HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36',
  Accept: 'application/json, text/html',
  'Accept-Language': 'fr-FR,fr;q=0.9',
};

async function tryEndpoint(candidate: (typeof CANDIDATES)[0]): Promise<void> {
  console.log(`\n${'─'.repeat(60)}`);
  console.log(`🔍  ${candidate.label}`);
  console.log(`    ${candidate.method ?? 'GET'} ${candidate.url}`);

  try {
    const response =
      candidate.method === 'POST'
        ? await axios.post(candidate.url, GRAPHQL_QUERY, {
            headers: { ...HEADERS, 'Content-Type': 'application/json' },
            timeout: 10_000,
          })
        : await axios.get(candidate.url, { headers: HEADERS, timeout: 10_000 });

    console.log(`    ✅  HTTP ${response.status}`);
    const data = response.data;

    if (typeof data === 'string') {
      // HTML — look for price patterns
      const priceMatch = data.match(/["']price["']\s*:\s*([\d.]+)/);
      const skuMatch = data.match(/["']sku["']\s*:\s*["']([^"']+)["']/);
      console.log(`    📄  HTML response (${data.length} chars)`);
      if (skuMatch) console.log(`    🏷️  SKU found: ${skuMatch[1]}`);
      if (priceMatch) console.log(`    💶  Price found: ${priceMatch[1]} €`);
    } else {
      console.log(`    📦  JSON response:`);
      console.log(JSON.stringify(data, null, 2).split('\n').slice(0, 40).join('\n'));
    }
  } catch (err: unknown) {
    if (axios.isAxiosError(err)) {
      console.log(`    ❌  HTTP ${err.response?.status ?? 'no response'} — ${err.message}`);
      if (err.response?.status === 404) {
        console.log(`        (endpoint does not exist on this site)`);
      }
    } else {
      console.log(`    ❌  ${String(err)}`);
    }
  }
}

async function main(): Promise<void> {
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`prixElek — MaterielElectrique.com endpoint discovery`);
  console.log(`Reference tested: ${ref}`);
  console.log(`${'═'.repeat(60)}`);

  for (const candidate of CANDIDATES) {
    await tryEndpoint(candidate);
    // Polite delay between requests
    await new Promise((r) => setTimeout(r, 600));
  }

  console.log(`\n${'═'.repeat(60)}`);
  console.log(`NEXT STEPS:`);
  console.log(`  1. Open https://www.materielelectrique.com in Chrome`);
  console.log(`  2. F12 → Network → Filter: Fetch/XHR`);
  console.log(`  3. Search for reference "${ref}"`);
  console.log(`  4. Find the XHR request that returns price data`);
  console.log(`  5. Right-click → "Copy as fetch"`);
  console.log(`  6. Document the confirmed endpoint in doc/scraping.md`);
  console.log(`${'═'.repeat(60)}\n`);
}

main().catch(console.error);

