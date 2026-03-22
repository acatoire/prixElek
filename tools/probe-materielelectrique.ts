/**
 * tools/probe-materielelectrique.ts
 *
 * Deep probe of a known product page on materielelectrique.com.
 * Extracts price, SKU, platform hints, JSON-LD, and API endpoints.
 *
 * Usage:
 *   npx tsx tools/probe-materielelectrique.ts
 */

import axios from 'axios';

const PRODUCT_URL =
  'https://www.materielelectrique.com/prise-de-courant-legrand-celiane-4x2p-t-compacte-precablee-standard-francais-p-297691.html';

const HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8',
};

function section(title: string): void {
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`  ${title}`);
  console.log('═'.repeat(60));
}

async function main(): Promise<void> {
  console.log('prixElek — materielelectrique.com deep probe');
  console.log(`URL: ${PRODUCT_URL}\n`);

  const response = await axios.get<string>(PRODUCT_URL, {
    headers: HEADERS,
    timeout: 15_000,
  });

  const html = response.data;
  console.log(`HTTP ${response.status} — page length: ${html.length} chars`);

  // ── 1. Platform detection ─────────────────────────────────────────────────
  section('1. Platform / Generator');
  const generator = html.match(/<meta[^>]+name=["']generator["'][^>]*>/i)?.[0] ?? 'not found';
  console.log(generator);
  // PrestaShop signature
  if (html.includes('prestashop') || html.includes('PrestaShop'))
    console.log('→ PrestaShop detected');
  if (html.includes('woocommerce') || html.includes('WooCommerce'))
    console.log('→ WooCommerce detected');
  if (html.includes('magento') || html.includes('Magento')) console.log('→ Magento detected');

  // ── 2. JSON-LD structured data (most reliable for price) ─────────────────
  section('2. JSON-LD structured data');
  const jsonldBlocks =
    html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi) ?? [];
  console.log(`Found ${jsonldBlocks.length} JSON-LD block(s)`);
  for (const block of jsonldBlocks) {
    const inner = block.replace(/<\/?script[^>]*>/gi, '').trim();
    try {
      const obj = JSON.parse(inner);
      console.log('\n', JSON.stringify(obj, null, 2));
    } catch {
      console.log('(unparseable)', inner.slice(0, 200));
    }
  }

  // ── 3. dataLayer / gtm push (often contains price) ───────────────────────
  section('3. dataLayer / GTM price data');
  const dataLayers = html.match(/dataLayer\.push\(\{[\s\S]*?\}\)/g) ?? [];
  const dlVar = html.match(/var dataLayer\s*=\s*\[[\s\S]*?\]/g) ?? [];
  [...dataLayers, ...dlVar].forEach((dl) => console.log(dl.slice(0, 500)));

  // ── 4. Inline product JS variables ───────────────────────────────────────
  section('4. Inline JS product/price variables');
  const jsVars =
    html.match(
      /(?:var|const|let)\s+\w*(?:product|price|prix|sku|ref)\w*\s*=\s*['"`\{][\s\S]{0,300}/gi
    ) ?? [];
  jsVars.slice(0, 8).forEach((v) => console.log(v.slice(0, 200)));

  // ── 5. Price in HTML (itemprop / class / data-attr) ───────────────────────
  section('5. HTML price elements');
  const itemprops = html.match(/<[^>]+itemprop=["'](?:price|offers)[^>]*>[\s\S]{0,100}/gi) ?? [];
  const dataPrice = html.match(/<[^>]+data-price[^>]*>/gi) ?? [];
  const classPrix =
    html.match(/<[^>]+class=["'][^"']*(?:prix|price)[^"']*["'][^>]*>[\s\S]{0,80}/gi) ?? [];
  [...itemprops, ...dataPrice, ...classPrix].slice(0, 10).forEach((el) => console.log(el.trim()));

  // ── 6. AJAX / XHR endpoint candidates ────────────────────────────────────
  section('6. AJAX endpoint candidates');
  const ajaxUrls =
    html.match(/['"]([^'"]*(?:ajax|api|price|product|catalog)[^'"]{0,80})['"]/gi) ?? [];
  const phpEndpoints = html.match(/['"]([^'"]+\.php[^'"]{0,60})['"]/gi) ?? [];
  [...new Set([...ajaxUrls, ...phpEndpoints])].slice(0, 15).forEach((u) => console.log(u));

  // ── 7. Product reference / SKU confirmation ───────────────────────────────
  section('7. Reference / SKU on page');
  const refPatterns =
    html.match(/(?:référence|reference|sku|ref\.?)\s*:?\s*<[^>]*>?\s*([A-Z0-9-]{4,20})/gi) ?? [];
  refPatterns.slice(0, 5).forEach((r) => console.log(r));
  // Confirm our known ref
  if (html.includes('067128')) console.log('✅  Ref 067128 confirmed present in HTML');
  if (html.includes('3245060671280')) console.log('✅  EAN 3245060671280 confirmed present');

  // ── 8. PrestaShop-specific AJAX ───────────────────────────────────────────
  section('8. PrestaShop-specific endpoints');
  const psAjax =
    html.match(/['"]([^'"]*(?:getproduct|productinfo|prices?|modules)[^'"]{0,80})['"]/gi) ?? [];
  psAjax.slice(0, 10).forEach((u) => console.log(u));

  // save raw HTML for manual inspection
  const fs = await import('fs/promises');
  await fs.writeFile('tools/product-page-dump.html', html);
  console.log('\n✅  Full HTML saved to tools/product-page-dump.html');
  console.log('   → Open in VS Code and search for "067128" or "price" to find the data structure');
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
