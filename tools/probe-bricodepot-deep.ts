/**
 * tools/probe-bricodepot-deep.ts
 *
 * Deeper probe to understand the data-price structure and availability signals.
 */
import axios from 'axios';

const DEFAULT_URL =
  'https://www.bricodepot.fr/catalogue/cable-electrique-r2v-3g25-mm-noir-100-m/prod10739';

const url = process.argv[2] ?? DEFAULT_URL;

async function main(): Promise<void> {
  const response = await axios.get<ArrayBuffer>(url, {
    responseType: 'arraybuffer',
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'fr-FR,fr;q=0.9',
    },
    timeout: 15_000,
  });

  const html = new TextDecoder('utf-8').decode(response.data as ArrayBuffer);

  // Show full context around each data-price div
  console.log('=== data-price contexts ===');
  const re = /[\s\S]{0,300}data-price="[\d.]+[\s\S]{0,300}/g;
  const matches = html.match(re) ?? [];
  matches.slice(0, 3).forEach((m, i) => {
    console.log(`\n--- match ${i} ---`);
    console.log(m.replace(/\s+/g, ' ').trim().slice(0, 600));
  });

  // Full JSON-LD block 0
  console.log('\n=== Full JSON-LD block 0 ===');
  const blocks = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi) ?? [];
  if (blocks[0]) {
    const inner = blocks[0].replace(/<\/?script[^>]*>/gi, '').trim();
    try {
      console.log(JSON.stringify(JSON.parse(inner), null, 2));
    } catch {
      console.log(inner);
    }
  }

  // Availability signals
  console.log('\n=== availability / stock signals ===');
  const avail = html.match(/(?:stock|availability|disponib)[^"<]{0,200}/gi) ?? [];
  avail.slice(0, 10).forEach((a) => console.log(a.slice(0, 150)));

  // Check for bd-Price--main or similar class
  console.log('\n=== bd-Price classes ===');
  const bdPrice = html.match(/class="[^"]*bd-Price[^"]*"[^>]*>/gi) ?? [];
  bdPrice.slice(0, 10).forEach((p) => console.log(p));

  // Check product page structure near the price
  console.log('\n=== section with product main price ===');
  const mainPriceIdx = html.indexOf('bd-ProductMainInfos');
  if (mainPriceIdx > -1) {
    console.log(html.slice(mainPriceIdx, mainPriceIdx + 1000).replace(/\s+/g, ' '));
  } else {
    console.log('bd-ProductMainInfos not found, trying bd-Product');
    const idx2 = html.indexOf('bd-Product__price');
    if (idx2 > -1) console.log(html.slice(idx2, idx2 + 500).replace(/\s+/g, ' '));
    else console.log('not found either');
  }
}

main().catch((err) => {
  console.error('Error:', err instanceof Error ? err.message : err);
  process.exit(1);
});
