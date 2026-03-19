/**
 * tools/probe-rexel.ts
 *
 * Probes the Rexel price API.
 *
 * Usage:
 *   npx tsx tools/probe-rexel.ts <bearer-token> [sku] [branchId]
 *
 * Default SKU:      70569480 (Legrand Céliane 4x2P+T)
 * Default branchId: 4413
 *
 * The correct body shape (discovered from F12 DevTools on rexel.fr):
 *   {
 *     accountId,           ← from ERPCustomerID.accountNumber in JWT
 *     branchId,            ← user's local agency code, NOT in JWT
 *     pickupOptions:   { branchCode: branchId },
 *     deliveryOptions: { branchCode: branchId },
 *     stockReturnedOptions: { includeDCStock: true, includeBranchStock: true, includeDelay: true },
 *     includeLeasePrice: true,
 *     lines: [{ sku, quantity: { number: 1 } }],   ← quantity is an OBJECT
 *   }
 */

import axios from 'axios';

const API_URL = 'https://eu.dif.rexel.com/web/api/v3/product/priceandavailability';

// ── helpers ───────────────────────────────────────────────────────────────────

function extractFromJwt(jwt: string): { accountId: string; webshopId: string; apiKey: string } {
  try {
    const seg = jwt.split('.')[1] ?? '';
    const pad = (4 - (seg.length % 4)) % 4;
    const b64 = (seg + '='.repeat(pad)).replace(/-/g, '+').replace(/_/g, '/');
    const decoded = JSON.parse(Buffer.from(b64, 'base64').toString('utf-8')) as {
      ERPCustomerID?: { accountNumber?: string };
      WebshopID?: { webshopId?: string };
      api_key?: string;
    };
    return {
      accountId: decoded.ERPCustomerID?.accountNumber ?? '',
      webshopId: decoded.WebshopID?.webshopId ?? '',
      apiKey:    decoded.api_key ?? '',
    };
  } catch { return { accountId: '', webshopId: '', apiKey: '' }; }
}

async function probe(label: string, token: string, body: unknown): Promise<boolean> {
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
    console.log('    Body:', JSON.stringify(res.data).slice(0, 300));
    return true;
  } catch (err) {
    if (axios.isAxiosError(err)) {
      console.log(`❌  HTTP ${err.response?.status} — ${JSON.stringify(err.response?.data ?? err.message).slice(0, 300)}`);
    } else {
      console.log(`❌  ${String(err)}`);
    }
    return false;
  }
}

// ── main ──────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const [token, sku = '70569480', branchId = '4413', zipcode = '44880', city = 'SAUTRON'] = process.argv.slice(2);
  if (!token) {
    console.error('Usage: npx tsx tools/probe-rexel.ts <bearer-token> [sku] [branchId] [zipcode] [city]');
    process.exit(1);
  }

  const { accountId, webshopId, apiKey } = extractFromJwt(token);
  console.log(`\nProbing Rexel API`);
  console.log(`  SKU:        ${sku}`);
  console.log(`  accountId:  ${accountId || '(not found in JWT)'}`);
  console.log(`  webshopId:  ${webshopId || '(not found in JWT)'}`);
  console.log(`  apiKey:     ${apiKey || '(not found in JWT)'}`);
  console.log(`  branchId:   ${branchId}`);
  console.log(`  zipcode:    ${zipcode}`);
  console.log(`  city:       ${city}`);
  console.log('='.repeat(60));

  const ok = await probe('V_REAL (correct shape)', token, {
    accountId,
    branchId,
    pickupOptions:   { branchCode: branchId },
    deliveryOptions: {
      branchCode: branchId,
      location: { country: 'FR', zipcode, city },
    },
    stockReturnedOptions: {
      includeDCStock:     true,
      includeBranchStock: true,
      includeDelay:       true,
    },
    includeLeasePrice: true,
    lines: [{ sku, quantity: { number: 1 } }],
  });

  if (!ok) {
    console.log('\n── Fallback variants ──────────────────────────────────────');

    // V_F1 – without optional wrapper fields
    await probe('V_F1 minimal+accountId+branchId', token, {
      accountId,
      branchId,
      lines: [{ sku, quantity: { number: 1 } }],
    });

    // V_F2 – quantity as plain int (in case API changed again)
    await probe('V_F2 qty=int', token, {
      accountId,
      branchId,
      lines: [{ sku, quantity: 1 }],
    });

    // V_F3 – quantity as string (original attempt)
    await probe('V_F3 qty=str', token, {
      accountId,
      branchId,
      lines: [{ sku, quantity: '1' }],
    });

    // V_F4 – no branchId, just accountId + quantity object
    await probe('V_F4 no-branchId', token, {
      accountId,
      lines: [{ sku, quantity: { number: 1 } }],
    });
  }

  console.log('\n' + '='.repeat(60));
  console.log('Done.');
}

main().catch((e) => { console.error(e); process.exit(1); });

