/**
 * tools/probe-bricodepot-cookies.ts — test exact cookies from user
 */
import axios from 'axios';

const COOKIES = `frz-referrer=https://www.bricodepot.fr/?srsltid=AfmBOoqkta26XcZBHEagREOOSwB2CUSU1NNx0URtIO-9v5X1AaHOXm0T&search-term=3g1.5; frz-referrer=; f5avraaaaaaaaaaaaaaaa_session_=KPIJCCDECNHMGHAAKGKMMDJLPJJDGCBCHOBMCLIPJNNPJBPDDAMEGOIEGMDNOEAOOIEDNICIMHFHJEODBOFANGMAGIHNNCGPMOIGMOCGGIDMPJFLFCCHHOFDMLENDFNL; DYN_USER_ID=421460073; DYN_USER_CONFIRM=0640b1ede23c4bc0606b4af76d95e5ab; optimizelyEndUserId=oeu1761417253941r0.1879646146866727; BVImplmain_site=11355; f5avraaaaaaaaaaaaaaaa_session_=EMBGNNMKFKJLCOCBIFEEHPCFKGOHNGAOPFMCGGENDFNLJAJCOJHGICPBEGFICNKBHMKDGOAKOCJBGJFCJNIADBBBCIMOHOODIEDONMMOMGEDEIFMOEPLFGCPKEOLKFDK; restore=true; JSESSIONID=2DBE5753F791FE737DEE6CE1BB4F1A1B.node31; frz-referrer=https://www.google.com/; cart=OaZhfMsHAeubCMtbGYDDKDtWsKOuxsJ5/7wB4r/LhhQHoD2gE3LgnOouLbj2v5qNMfC8Pqhwf/A+LsUosRX5p1dygTGmLL+2acsMS0ZFqp4=`;

const URL =
  process.argv[2] ??
  'https://www.bricodepot.fr/catalogue/cable-electrique-rigide-r2v-3g15-mm-noir-100-m/prod10738';

async function probe(cookies: string, label: string) {
  console.log(`\n=== ${label} ===`);
  try {
    const res = await axios.get<ArrayBuffer>(URL, {
      responseType: 'arraybuffer',
      maxRedirects: 5,
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
        Priority: 'u=0, i',
        TE: 'trailers',
        ...(cookies ? { Cookie: cookies } : {}),
      },
      timeout: 20_000,
    });
    const html = new TextDecoder('utf-8').decode(res.data);
    console.log(`HTTP ${res.status} — ${html.length} chars`);
    // Check for price
    const blocks = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi) ?? [];
    for (const b of blocks) {
      try {
        const obj = JSON.parse(b.replace(/<\/?script[^>]*>/gi, '').trim()) as Record<
          string,
          unknown
        >;
        if (obj['@type'] === 'Product') {
          const offers = obj['offers'] as Record<string, unknown> | undefined;
          console.log(`PRICE: ${offers?.['price']} ${offers?.['priceCurrency']}`);
        }
      } catch {
        /* ignore */
      }
    }
    // Check for data-price
    const dp = html.match(/data-price="([\d.]+)"/);
    if (dp) console.log(`data-price: ${dp[1]}`);
    // Check response cookies
    const setCookies = res.headers['set-cookie'];
    if (setCookies) console.log('Set-Cookie headers:', setCookies.slice(0, 3));
  } catch (err) {
    if (axios.isAxiosError(err)) {
      console.log(`ERROR: HTTP ${err.response?.status} — ${err.message}`);
      // Show what cookies the server tried to set
      const setCookies = err.response?.headers?.['set-cookie'];
      if (setCookies) console.log('Set-Cookie on error:', setCookies.slice(0, 3));
    } else {
      console.log('ERROR:', err);
    }
  }
}

async function main() {
  await probe('', 'NO cookies');
  await probe(COOKIES, 'WITH cookies from curl');
}

main().catch(console.error);
