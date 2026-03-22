/**
 * tools/scrape-materielelectrique.ts
 *
 * Fetches the real price for a reference from materielelectrique.com
 * using the same strategy as MaterielElectriqueAdapter:
 *   1. Look up the catalogue to find the product page slug (id ending in -p-<digits>)
 *   2. Fetch /{slug}.html directly → parse JSON-LD for price + stock
 *   3. Fall back to /?product_search[term]=<ref> when no slug is found
 *
 * Usage (PowerShell):
 *   npx tsx tools/scrape-materielelectrique.ts
 *   npx tsx tools/scrape-materielelectrique.ts NEX01272240N
 *   npx tsx tools/scrape-materielelectrique.ts LEG067128
 */

import axios from 'axios';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { MaterielElectriqueAdapter } from '../src/adapters/materielelectrique';
import type { Material } from '../src/types/material';

const DEFAULT_REF = 'LEG067128';
const ref = process.argv[2] ?? DEFAULT_REF;
const BASE = 'https://www.materielelectrique.com';

// ── Load all catalogue files to resolve a page slug from the reference ────────

function loadAllMaterials(): Material[] {
  const configDir = join(process.cwd(), 'catalogue');
  const files = readdirSync(configDir).filter(
    (f) => f.startsWith('catalogue.') && f.endsWith('.json')
  );
  const all: Material[] = [];
  for (const file of files) {
    const raw = readFileSync(join(configDir, file), 'utf-8');
    const items = JSON.parse(raw) as Material[];
    all.push(...items);
  }
  return all;
}

function findSlugForRef(ref: string): string | undefined {
  const materials = loadAllMaterials();
  const match = materials.find((m) => m.references_fournisseurs['materielelectrique'] === ref);
  // Only return the slug if it contains -p-<digits> (real product page)
  if (match && /-p-\d+$/.test(match.id)) return match.id;
  return undefined;
}

// ── Resolve URL ───────────────────────────────────────────────────────────────

const pageSlug = findSlugForRef(ref);
const productUrl = pageSlug
  ? `${BASE}/${pageSlug}.html`
  : `${BASE}/?product_search[term]=${encodeURIComponent(ref)}`;

const HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml',
  'Accept-Language': 'fr-FR,fr;q=0.9',
};

// ── Main ──────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`prixElek — materielelectrique.com price fetch`);
  console.log(`Reference : ${ref}`);
  if (pageSlug) {
    console.log(`Slug      : ${pageSlug}  (direct product page)`);
  } else {
    console.log(`Slug      : not found in catalogue → using search URL`);
  }
  console.log(`URL       : ${productUrl}`);
  console.log(`${'═'.repeat(60)}\n`);

  // ── Fetch page ──────────────────────────────────────────────────────────────
  let html: string;
  try {
    const response = await axios.get<string>(productUrl, {
      headers: HEADERS,
      timeout: 15_000,
    });
    console.log(`✅  HTTP ${response.status} — ${response.data.length} chars received\n`);
    html = response.data;
  } catch (err: unknown) {
    if (axios.isAxiosError(err)) {
      console.error(`❌  HTTP ${err.response?.status ?? 'no response'} — ${err.message}`);
      if (!pageSlug) {
        console.error(
          `\n💡  Tip: add this product to the catalogue first with:\n` +
            `     npx tsx tools/add-to-catalogue.ts <product-page-url>\n` +
            `   Then re-run this script — it will use the direct page URL.`
        );
      }
    } else {
      console.error(`❌  ${String(err)}`);
    }
    process.exit(1);
  }

  // ── Parse JSON-LD via adapter ───────────────────────────────────────────────
  const adapter = new MaterielElectriqueAdapter({ delayBetweenRequestsMs: 0 });

  console.log(`${'─'.repeat(60)}`);
  console.log(`Parsing JSON-LD for reference "${ref}"…`);

  try {
    const price = adapter.parseHtml(html, ref);
    console.log(`\n✅  Price found!`);
    console.log(`   Prix HT   : ${price.prix_ht} €`);
    console.log(
      `   Stock     : ${price.stock === 1 ? '✅ En stock' : '❌ Sur commande / Indisponible'}`
    );
    console.log(`   Unité     : ${price.unite}`);
    console.log(`   Fetched at: ${price.fetchedAt}`);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`\n❌  Parse failed: ${msg}`);

    // Show all JSON-LD blocks found for debugging
    const blocks = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi) ?? [];
    console.log(`\n📄  Found ${blocks.length} JSON-LD block(s) on the page:`);
    for (const block of blocks) {
      const text = block.replace(/<\/?script[^>]*>/gi, '').trim();
      try {
        const obj = JSON.parse(text);
        console.log(JSON.stringify(obj, null, 2).split('\n').slice(0, 20).join('\n'));
        console.log('   …');
      } catch {
        console.log('  (unparseable JSON-LD block)');
      }
    }

    if (blocks.length === 0) {
      // Dump a snippet of the HTML to help diagnose
      console.log('\n📄  Page HTML snippet (first 2000 chars):');
      console.log(html.slice(0, 2000));
    }
  }

  console.log(`\n${'═'.repeat(60)}\n`);
}

main().catch(console.error);
