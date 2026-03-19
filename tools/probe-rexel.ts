/**
 * tools/probe-rexel.ts
 *
 * Probes the Rexel price API with several request body variants to find
 * which one returns 200. Run it with your Bearer token:
 *
 *   npx tsx tools/probe-rexel.ts <bearer-token> [sku]
 *
 * Default SKU: 70569480 (Legrand Céliane 4x2P+T)
 */

import axios from 'axios';

const API_URL = 'https://eu.dif.rexel.com/web/api/v3/product/priceandavailability';

async function probe(label: string, token: string, body: unknown): Promise<void> {
  const bodyStr = JSON.stringify(body);
  process.stdout.write(`\n[${label}] ${bodyStr.length} bytes → `);
  try {
    const res = await axios.post(API_URL, body, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Content-Language': 'fr',
        Accept: 'application/json, text/plain, */*',
        'Accept-Language': 'fr,fr-FR;q=0.9,en-US;q=0.8,en;q=0.7',
        'x-banner': 'frx',
        Origin: 'https://www.rexel.fr',
        Referer: 'https://www.rexel.fr/',
      },
      timeout: 15_000,
    });
    const price = (res.data as { lines?: Array<{ prices?: Array<{ price?: { amount?: number }; priceLabel?: string }> }> })
      .lines?.[0]?.prices?.find((p) => p.priceLabel === 'UNIT_LIST_PRICE')?.price?.amount;
    console.log(`✅  HTTP ${res.status} — UNIT_LIST_PRICE = ${price ?? '(not found)'}`);
    console.log('    Body:', JSON.stringify(res.data).slice(0, 200));
  } catch (err) {
    if (axios.isAxiosError(err)) {
      console.log(`❌  HTTP ${err.response?.status} — ${JSON.stringify(err.response?.data ?? err.message).slice(0, 300)}`);
    } else {
      console.log(`❌  ${String(err)}`);
    }
  }
}

async function main(): Promise<void> {
  const [token, sku = '70569480'] = process.argv.slice(2);
  if (!token) {
    console.error('Usage: npx tsx tools/probe-rexel.ts <bearer-token> [sku]');
    process.exit(1);
  }

  console.log(`\nProbing Rexel API for SKU: ${sku}`);
  console.log('='.repeat(60));

  // Variant 1 – minimal
  await probe('V1 minimal', token, {
    lines: [{ sku }],
  });

  // Variant 2 – with quantity
  await probe('V2 +quantity', token, {
    lines: [{ sku, quantity: 1 }],
  });

  // Variant 3 – with pricingQty (field seen in response)
  await probe('V3 +pricingQty', token, {
    lines: [{ sku, pricingQty: 1 }],
  });

  // Variant 4 – with quantity + priceCondition
  await probe('V4 +priceCondition', token, {
    lines: [{ sku, quantity: 1, priceCondition: { id: '0' } }],
  });

  // Variant 5 – with banner at root
  await probe('V5 +banner', token, {
    banner: 'frx',
    lines: [{ sku, quantity: 1, priceCondition: { id: '0' } }],
  });

  // Variant 6 – with webshopId
  await probe('V6 +webshopId', token, {
    banner: 'frx',
    webshopId: 'FRW',
    lines: [{ sku, quantity: 1, priceCondition: { id: '0' } }],
  });

  // Variant 7 – with unit PCE
  await probe('V7 +unit', token, {
    banner: 'frx',
    webshopId: 'FRW',
    lines: [{ sku, quantity: 1, unit: 'PCE', priceCondition: { id: '0' } }],
  });

  // Variant 8 – full bundle shape
  await probe('V8 full', token, {
    banner: 'frx',
    webshopId: 'FRW',
    lines: [{
      sku,
      quantity: 1,
      unit: 'PCE',
      priceCondition: { id: '0' },
      bundleComponents: [],
    }],
  });

  // Variant 9 – SAP Commerce "entries" shape
  await probe('V9 entries[]', token, {
    entries: [{ product: { code: sku }, quantity: 1 }],
  });

  // Variant 10 – productCodes array (another SAP pattern)
  await probe('V10 productCodes[]', token, {
    productCodes: [sku],
    quantity: 1,
  });

  // ── Round 2: accountId (from JWT) + quantity as STRING ──────────────────────

  // Extract accountId from the JWT payload
  function extractAccountId(jwt: string): string {
    try {
      const payload = jwt.split('.')[1];
      const pad = 4 - (payload.length % 4);
      const padded = pad !== 4 ? payload + '='.repeat(pad) : payload;
      const decoded = JSON.parse(Buffer.from(padded, 'base64').toString('utf-8')) as {
        ERPCustomerID?: { accountNumber?: string };
        api_key?: string;
      };
      return decoded.ERPCustomerID?.accountNumber ?? '';
    } catch { return ''; }
  }

  const accountId = extractAccountId(token);
  console.log(`\nExtracted accountId from JWT: "${accountId}"`);

  // V11 – accountId + quantity as string
  await probe('V11 accountId+qty string', token, {
    lines: [{ sku, quantity: '1', accountId }],
  });

  // V12 – accountId at root + quantity as string
  await probe('V12 accountId root', token, {
    accountId,
    lines: [{ sku, quantity: '1' }],
  });

  // V13 – accountId at root + quantity int (check if accountId alone fixes it)
  await probe('V13 accountId+qty int', token, {
    accountId,
    lines: [{ sku, quantity: 1 }],
  });

  // V14 – full real shape: accountId + qty string + priceCondition
  await probe('V14 full+accountId', token, {
    accountId,
    lines: [{ sku, quantity: '1', priceCondition: { id: '0' } }],
  });

  // V15 – with api_key header instead of body
  function extractApiKey(jwt: string): string {
    try {
      const payload = jwt.split('.')[1];
      const pad = 4 - (payload.length % 4);
      const padded = pad !== 4 ? payload + '='.repeat(pad) : payload;
      const decoded = JSON.parse(Buffer.from(padded, 'base64').toString('utf-8')) as { api_key?: string };
      return decoded.api_key ?? '';
    } catch { return ''; }
  }
  const apiKey = extractApiKey(token);
  console.log(`Extracted api_key from JWT: "${apiKey}"`);

  await probe('V15 accountId+apiKey header', token, {
    accountId,
    lines: [{ sku, quantity: '1' }],
  });

  // Extract webshopId from the JWT payload
  function extractWebshopId(jwt: string): string {
    try {
      const payload = jwt.split('.')[1];
      const pad = 4 - (payload.length % 4);
      const padded = pad !== 4 ? payload + '='.repeat(pad) : payload;
      const decoded = JSON.parse(Buffer.from(padded, 'base64').toString('utf-8')) as {
        WebshopID?: { webshopId?: string };
      };
      return decoded.WebshopID?.webshopId ?? '';
    } catch { return ''; }
  }
  const webshopId = extractWebshopId(token);
  console.log(`Extracted webshopId from JWT: "${webshopId}"`);

  // V16 – accountId + webshopId (from JWT) + quantity as int  ← current adapter body
  await probe('V16 accountId+webshopId+qty int', token, {
    accountId,
    ...(webshopId ? { webshopId } : {}),
    lines: [{ sku, quantity: 1 }],
  });

  // V17 – accountId + webshopId + quantity as string
  await probe('V17 accountId+webshopId+qty string', token, {
    accountId,
    ...(webshopId ? { webshopId } : {}),
    lines: [{ sku, quantity: '1' }],
  });

  // V18 – accountId + webshopId + banner + quantity int
  await probe('V18 accountId+webshopId+banner', token, {
    accountId,
    banner: 'frx',
    ...(webshopId ? { webshopId } : {}),
    lines: [{ sku, quantity: 1 }],
  });

  // ── Round 3: accountId as query parameter ──────────────────────────────────
  // Body-level accountId causes "Failed to read request", yet the API says
  // "accountId is mandatory" — so it likely belongs in the query string.

  async function probeWithParams(
    label: string,
    params: Record<string, string>,
    body: unknown
  ): Promise<void> {
    const url = new URL(API_URL);
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    const bodyStr = JSON.stringify(body);
    process.stdout.write(`\n[${label}] ${url.search} ${bodyStr.length} bytes → `);
    try {
      const res = await axios.post(url.toString(), body, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Content-Language': 'fr',
          Accept: 'application/json, text/plain, */*',
          'Accept-Language': 'fr,fr-FR;q=0.9,en-US;q=0.8,en;q=0.7',
          'x-banner': 'frx',
          Origin: 'https://www.rexel.fr',
          Referer: 'https://www.rexel.fr/',
        },
        timeout: 15_000,
      });
      const price = (res.data as { lines?: Array<{ prices?: Array<{ price?: { amount?: number }; priceLabel?: string }> }> })
        .lines?.[0]?.prices?.find((p) => p.priceLabel === 'UNIT_LIST_PRICE')?.price?.amount;
      console.log(`✅  HTTP ${res.status} — UNIT_LIST_PRICE = ${price ?? '(not found)'}`);
      console.log('    Body:', JSON.stringify(res.data).slice(0, 200));
    } catch (err) {
      if (axios.isAxiosError(err)) {
        console.log(`❌  HTTP ${err.response?.status} — ${JSON.stringify(err.response?.data ?? err.message).slice(0, 300)}`);
      } else {
        console.log(`❌  ${String(err)}`);
      }
    }
  }

  // V19 – accountId as query param + quantity as string in body
  await probeWithParams('V19 accountId=QP qty=str', { accountId }, {
    lines: [{ sku, quantity: '1' }],
  });

  // V20 – accountId as query param + quantity as int in body (int triggers "Failed to read" alone → expect fail)
  await probeWithParams('V20 accountId=QP qty=int', { accountId }, {
    lines: [{ sku, quantity: 1 }],
  });

  // V21 – accountId + webshopId as query params + quantity string
  await probeWithParams('V21 accountId+webshopId=QP qty=str', { accountId, webshopId }, {
    lines: [{ sku, quantity: '1' }],
  });

  // V22 – accountId as query param, no quantity in body (baseline: do we still get "quantity mandatory"?)
  await probeWithParams('V22 accountId=QP no-qty', { accountId }, {
    lines: [{ sku }],
  });

  // V23 – quantity in query param too
  await probeWithParams('V23 accountId+qty=QP', { accountId, quantity: '1' }, {
    lines: [{ sku }],
  });

  // V24 – accountId as query param, quantity string, + x-account-id header
  await probeWithParams('V24 accountId=QP+header qty=str', { accountId }, {
    lines: [{ sku, quantity: '1' }],
  });

  console.log('\n' + '='.repeat(60));
  console.log('Done. Use the ✅ variant to update src/adapters/rexel.ts');
}

main().catch((e) => { console.error(e); process.exit(1); });

