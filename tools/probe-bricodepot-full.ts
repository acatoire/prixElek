/**
 * tools/probe-bricodepot-full.ts — show full JSON-LD + column visibility issue
 */
import axios from 'axios';

const url =
  process.argv[2] ??
  'https://www.bricodepot.fr/catalogue/cable-electrique-rigide-r2v-3g15-mm-noir-100-m/prod10738';

async function main(): Promise<void> {
  const res = await axios.get<ArrayBuffer>(url, {
    responseType: 'arraybuffer',
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:148.0) Gecko/20100101 Firefox/148.0',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'fr,fr-FR;q=0.9,en-US;q=0.8,en;q=0.7',
      'Accept-Encoding': 'gzip, deflate, br, zstd',
      Connection: 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
    },
    timeout: 20_000,
  });
  const html = new TextDecoder('utf-8').decode(res.data as ArrayBuffer);
  console.log('STATUS:', res.status, '  LENGTH:', html.length);

  // Print full JSON-LD blocks
  const blocks = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi) ?? [];
  console.log(`\nFound ${blocks.length} JSON-LD block(s)\n`);
  blocks.forEach((b, i) => {
    const inner = b.replace(/<\/?script[^>]*>/gi, '').trim();
    console.log(`--- Block ${i} (${inner.length} chars) ---`);
    try {
      console.log(JSON.stringify(JSON.parse(inner), null, 2));
    } catch {
      // Show raw truncated to find where it breaks
      console.log('PARSE ERROR. Raw:');
      console.log(inner.slice(0, 2000));
    }
  });

  // All data-price attributes
  console.log('\n--- All data-price attrs ---');
  const dp = html.match(/<[^>]+data-price="[\d.]+[^>]*>/gi) ?? [];
  dp.forEach((d) => console.log(d.slice(0, 200)));

  // Check for bd-Product-price-national
  console.log('\n--- bd-Product-price context ---');
  const idx = html.indexOf('bd-Product-price-national');
  if (idx > -1) console.log(html.slice(idx - 50, idx + 400).replace(/\s+/g, ' '));
  else console.log('NOT FOUND');
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
