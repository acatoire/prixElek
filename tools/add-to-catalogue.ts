/**
 * tools/add-to-catalogue.ts
 *
 * CLI tool: fetches a materielelectrique.com product page and appends
 * the product to the specified catalogue file.
 *
 * Usage (PowerShell from project root):
 *   npx tsx tools/add-to-catalogue.ts <catalogue-name> <url>
 *
 * Examples:
 *   npx tsx tools/add-to-catalogue.ts catalogue.prises.legrand https://www.materielelectrique.com/prise-de-courant-legrand-celiane-2x2p-t-precablee-standard-francais-p-297670.html
 *   npx tsx tools/add-to-catalogue.ts catalogue.prises.legrand https://www.materielelectrique.com/prise-de-courant-legrand-celiane-4x2p-t-compacte-precablee-standard-francais-p-297691.html
 *
 * The catalogue file is created in config/ if it does not exist.
 * Duplicates (same id) are silently skipped.
 * Rate-limit delay is read from config/scraping.config.json.
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { extractProductFromUrl } from './lib/extract-product-from-page';
import { cataloguePath, readCatalogue, writeCatalogue, buildMaterial, addMaterialToCatalogue } from './lib/catalogue-io';
import type { ScrapingConfig } from '../src/adapters/materielelectrique';
import { DEFAULT_SCRAPING_CONFIG } from '../src/adapters/materielelectrique';

// ── Load scraping config from file ────────────────────────────────────────────

function loadScrapingConfigFromFile(): ScrapingConfig {
  const configFile = join(process.cwd(), 'config', 'scraping.config.json');
  if (!existsSync(configFile)) {
    console.warn('⚠  config/scraping.config.json not found — using defaults');
    return DEFAULT_SCRAPING_CONFIG;
  }
  try {
    const raw = readFileSync(configFile, 'utf-8');
    const parsed = JSON.parse(raw) as Partial<ScrapingConfig>;
    const config = { ...DEFAULT_SCRAPING_CONFIG, ...parsed };
    return config;
  } catch {
    console.warn('⚠  Failed to parse config/scraping.config.json — using defaults');
    return DEFAULT_SCRAPING_CONFIG;
  }
}

// ── CLI ───────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const [catalogueName, url] = process.argv.slice(2);

  if (!catalogueName || !url) {
    console.error('Usage: npx tsx tools/add-to-catalogue.ts <catalogue-name> <url>');
    console.error('');
    console.error('Example:');
    console.error('  npx tsx tools/add-to-catalogue.ts catalogue.prises.legrand https://www.materielelectrique.com/...');
    process.exit(1);
  }

  if (!url.startsWith('https://www.materielelectrique.com/')) {
    console.error('❌  Only materielelectrique.com URLs are supported at this time.');
    process.exit(1);
  }

  const config = loadScrapingConfigFromFile();
  const filePath = cataloguePath(catalogueName);

  console.log(`📂  Catalogue : ${filePath}`);
  console.log(`🌐  URL       : ${url}`);
  console.log(`⏱   Delay     : ${config.delayBetweenRequestsMs}ms between requests`);
  console.log('');
  console.log('⏳  Fetching product page...');

  let product;
  try {
    product = await extractProductFromUrl(url, config);
  } catch (err) {
    console.error(`❌  Failed to fetch/parse product: ${String(err)}`);
    process.exit(1);
  }

  console.log(`✅  Found: ${product.nom}`);
  console.log(`   Brand     : ${product.marque}`);
  console.log(`   Reference : ${product.reference}`);
  console.log(`   Category  : ${product.categorie}`);
  if (product.ean) console.log(`   EAN       : ${product.ean}`);
  console.log('');

  const catalogue = await readCatalogue(filePath);
  const material = buildMaterial(product);
  const added = addMaterialToCatalogue(catalogue, material);

  if (!added) {
    console.log(`⏭   Already in catalogue (id: ${material.id}) — skipped.`);
    return;
  }

  await writeCatalogue(filePath, catalogue);
  console.log(`✅  Added to ${filePath} (${catalogue.length} item(s) total)`);
}

main().catch((err) => {
  console.error('Unexpected error:', err);
  process.exit(1);
});

