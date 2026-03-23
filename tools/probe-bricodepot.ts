/**
 * tools/probe-bricodepot.ts
 *
 * Probes a Bricodepot product page to identify price extraction strategy.
 * Usage: npx tsx tools/probe-bricodepot.ts [url]
 */
import axios from 'axios';

const DEFAULT_URL =
  'https://www.bricodepot.fr/catalogue/cable-electrique-r2v-3g25-mm-noir-100-m/prod10739';

const url = process.argv[2] ?? DEFAULT_URL;

const HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'fr-FR,fr;q=0.9',
};

function section(title: string): void {
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`  ${title}`);
  console.log('═'.repeat(60));
}

async function main(): Promise<void> {
  console.log('prixElek — bricodepot.fr probe');
  console.log(`URL: ${url}\n`);

  const response = await axios.get<ArrayBuffer>(url, {
    responseType: 'arraybuffer',
    headers: HEADERS,
    timeout: 15_000,
  });

  const html = new TextDecoder('utf-8').decode(response.data as ArrayBuffer);
  console.log(`HTTP ${response.status} — page length: ${html.length} chars`);

  section('1. JSON-LD blocks');
  const jsonldBlocks =
    html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi) ?? [];
  console.log(`Found ${jsonldBlocks.length} JSON-LD block(s)`);
  for (const block of jsonldBlocks) {
    const inner = block.replace(/<\/?script[^>]*>/gi, '').trim();
    try {
      const obj = JSON.parse(inner);
      console.log('\n', JSON.stringify(obj, null, 2).slice(0, 1200));
    } catch {
      console.log('(unparseable)', inner.slice(0, 300));
    }
  }

  section('2. itemprop price');
  const itemprops = html.match(/<[^>]+itemprop=["']price["'][^>]*>/gi) ?? [];
  itemprops.slice(0, 5).forEach((t) => console.log(t));

  section('3. data-price / data-product-price');
  const dataPrice = html.match(/<[^>]+data-(?:price|product-price)[^>]*>/gi) ?? [];
  dataPrice.slice(0, 5).forEach((t) => console.log(t));

  section('4. OG / meta price');
  const metaTags = html.match(/<meta[^>]+(?:price|product)[^>]*>/gi) ?? [];
  metaTags.slice(0, 10).forEach((t) => console.log(t));

  section('5. dataLayer / GTM');
  const dataLayers = html.match(/dataLayer\.push\(\{[\s\S]*?\}\)/g) ?? [];
  const dlVar = html.match(/var dataLayer\s*=\s*\[[\s\S]*?\]/g) ?? [];
  [...dataLayers.slice(0, 3), ...dlVar.slice(0, 2)].forEach((dl) => console.log(dl.slice(0, 600)));

  section('6. Inline JS price variables');
  const jsVars =
    html.match(/(?:var|const|let)\s+\w*(?:price|prix|product|sku)\w*\s*=\s*['"`{][^;]{0,200}/gi) ??
    [];
  jsVars.slice(0, 8).forEach((v) => console.log(v.slice(0, 200)));

  section('7. __NEXT_DATA__ / __NUXT__ / window.__');
  const nextData = html.match(/__NEXT_DATA__[\s\S]{0,2000}/)?.[0]?.slice(0, 1000) ?? 'not found';
  console.log(nextData.slice(0, 500));
  const nuxt = html.match(/__NUXT__[\s\S]{0,500}/)?.[0] ?? 'not found';
  console.log(nuxt.slice(0, 300));

  section('8. Raw price text around "€"');
  const euroMatches = html.match(/.{0,40}\d+[,.]\d{2}\s*€.{0,20}/g) ?? [];
  euroMatches.slice(0, 8).forEach((m) => console.log(m.replace(/\s+/g, ' ').trim()));
}

main().catch((err) => {
  console.error('Error:', err instanceof Error ? err.message : err);
  process.exit(1);
});
