/**
 * tools/add-to-catalogue.ts
 *
 * CLI tool: fetches a materielelectrique.com product page and appends
 * the product to the specified catalogue file.
 *
 * Usage (PowerShell from project root):
 *   npx tsx tools/add-to-catalogue.ts <url>
 *   npx tsx tools/add-to-catalogue.ts <catalogue-name> <url>
 *
 * When <catalogue-name> is omitted the tool prompts you to:
 *   1. Pick an existing catalogue from catalogue/ by number, or
 *   2. Type a new catalogue name to create.
 *
 * Examples:
 *   npx tsx tools/add-to-catalogue.ts https://www.materielelectrique.com/...
 *   npx tsx tools/add-to-catalogue.ts catalogue.prises.legrand https://www.materielelectrique.com/...
 *
 * The catalogue file is created in catalogue/ if it does not exist.
 * Duplicates (same id) are silently skipped.
 * Rate-limit delay is read from config/scraping.config.json.
 */

import { readFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';
import * as readline from 'readline';
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

// ── Interactive catalogue picker ──────────────────────────────────────────────

function ask(rl: readline.Interface, question: string): Promise<string> {
  return new Promise((resolve) => rl.question(question, resolve));
}

/** Lists existing catalogue JSON files from the catalogue/ directory. */
function listExistingCatalogues(): string[] {
  const dir = join(process.cwd(), 'catalogue');
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => f.replace(/\.json$/i, ''));
}

/**
 * Prompts the user to pick an existing catalogue or create a new one.
 * Returns the chosen catalogue name (without .json).
 */
async function promptCatalogueName(): Promise<string> {
  const existing = listExistingCatalogues();

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  try {
    console.log('');
    console.log('📚  Which catalogue do you want to add this product to?');
    console.log('');

    if (existing.length > 0) {
      existing.forEach((name, i) => {
        console.log(`  [${i + 1}] ${name}`);
      });
      console.log(`  [N] Create a new catalogue`);
      console.log('');

      while (true) {
        const answer = (await ask(rl, `  Your choice (1-${existing.length} or N): `)).trim();

        if (answer.toLowerCase() === 'n') {
          break; // fall through to new-name prompt below
        }

        const index = parseInt(answer, 10);
        if (!isNaN(index) && index >= 1 && index <= existing.length) {
          rl.close();
          return existing[index - 1];
        }

        console.log(`  ⚠  Please enter a number between 1 and ${existing.length}, or N.`);
      }
    } else {
      console.log('  (No existing catalogues found — you will create a new one.)');
      console.log('');
    }

    // New catalogue name prompt
    while (true) {
      const name = (await ask(rl, '  New catalogue name (e.g. catalogue.disjoncteurs): ')).trim();
      if (name.length > 0) {
        rl.close();
        return name;
      }
      console.log('  ⚠  Name cannot be empty.');
    }
  } catch (err) {
    rl.close();
    throw err;
  }
}

// ── CLI ───────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  // Support both: <url>  and  <catalogue-name> <url>
  let catalogueName: string | undefined;
  let url: string | undefined;

  if (args.length === 1 && args[0].startsWith('https://')) {
    // Only URL provided — prompt for catalogue
    url = args[0];
  } else if (args.length >= 2) {
    // Both catalogue name and URL provided
    [catalogueName, url] = args;
  }

  if (!url) {
    console.error('Usage: npx tsx tools/add-to-catalogue.ts <url>');
    console.error('       npx tsx tools/add-to-catalogue.ts <catalogue-name> <url>');
    console.error('');
    console.error('Example:');
    console.error('  npx tsx tools/add-to-catalogue.ts https://www.materielelectrique.com/...');
    console.error('  npx tsx tools/add-to-catalogue.ts catalogue.prises.legrand https://www.materielelectrique.com/...');
    process.exit(1);
  }

  if (!url.startsWith('https://www.materielelectrique.com/')) {
    console.error('❌  Only materielelectrique.com URLs are supported at this time.');
    process.exit(1);
  }

  // Prompt for catalogue name if not given on the command line
  if (!catalogueName) {
    catalogueName = await promptCatalogueName();
    console.log('');
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

