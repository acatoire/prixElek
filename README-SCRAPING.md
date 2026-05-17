# README-SCRAPING — Adapter Smoke Tests

Non-regression smoke tests that hit **live supplier endpoints** with real credentials to verify scraping still works.
One test per adapter, one known product per supplier — predictable price range checked every run.

---

## Quick start

```powershell
# 1. Copy the sample config
Copy-Item tests\integration\test-config.sample.json tests\integration\test-config.json

# 2. Fill in your credentials (see §Credentials below)
notepad tests\integration\test-config.json

# 3. Run
npm run test:integration
```

Expected output (all three suppliers configured):

```
✅  Rexel  SKU:70569480  →  21.05 € HT  (stock: En stock)
✅  Bricodepot  "catalogue/cable-electrique-…/prod10739"  →  195.00 € HT  /  234.00 € TTC  (stock: En stock)
✅  MaterielElectrique  LEG067128  →  18.64 € HT  /  22.37 € TTC  (stock: En stock)
```

> Missing a supplier key in `test-config.json`? That adapter's test is **silently skipped** — you can run
> with partial credentials safely.

---

## Credentials

### Rexel

The Rexel price API requires a bearer JWT from an authenticated session.

1. Log in on [rexel.fr](https://www.rexel.fr) in your browser.
2. Open DevTools → **Network** tab → filter by `priceandavailability`.
3. Click any request → **Headers** → copy the value after `Authorization: Bearer `.
4. Paste it into `test-config.json → rexel.token`.

Also fill in your local agency details:

| Key        | Description                  | Example     |
| ---------- | ---------------------------- | ----------- |
| `branchId` | Your Rexel branch code       | `"4413"`    |
| `zipcode`  | Your branch ZIP code         | `"44880"`   |
| `city`     | Your branch city (uppercase) | `"SAUTRON"` |

The `sku` is the Rexel internal product code (visible in the URL or request body).

**Token lifetime:** JWTs typically expire after 1–2 hours. Re-run step 1–4 if you get `AUTH_ERROR`.

---

### Bricodepot

Bricodepot uses session cookies (ATG Web Commerce CMS). Cookies expire after a few hours.

#### First-time setup

1. Start prixElek (`npm run dev`).
2. Click the **🍪 Cookies Bricodepot** button in the UI.
3. Follow the on-screen instructions — the UI opens bricodepot.fr in a pop-up;
   copy the `Cookie:` header value from DevTools → Network → any request to bricodepot.fr.
4. Paste the full cookie string into `test-config.json → bricodepot.cookies`.

#### When the test fails with `RATE_LIMIT` or `AUTH_ERROR`

Cookies have expired. Repeat steps 2–4 above.

The test runner prints a reminder with these steps every time the Bricodepot suite runs.

The `pageSlug` is the URL path of a product on bricodepot.fr (without the domain), e.g.:

```
catalogue/cable-electrique-r2v-3g25-mm-noir-100-m/prod10739
```

---

### MaterielElectrique

No authentication needed — prices are publicly visible.

The `pageSlug` is the URL path on materielelectrique.com (without the domain).
It **must** end with `-p-<digits>` (the PrestaShop product ID), otherwise the adapter rejects it.

Example:

```
prise-de-courant-legrand-celiane-4x2p-t-p-297691
```

Navigate to the product page in your browser and copy the path segment from the URL bar.

The `reference` is the manufacturer reference (e.g. `LEG067128`) — used to match the JSON-LD `sku` field.

---

## Expected price ranges

The `expectedPriceMin` / `expectedPriceMax` values in `test-config.json` are **HT (excl. VAT) prices in €**.

Set them to ±30 % of the current real price as a starting bracket. Tighten them once you have confirmed
a stable baseline. If a supplier changes their pricing significantly, update these bounds — that is a
**deliberate, auditable change** rather than a silent test skip.

---

## File reference

| File                                             | Purpose                              | Committed |
| ------------------------------------------------ | ------------------------------------ | --------- |
| `tests/integration/test-config.sample.json`      | Template — placeholder values        | ✅ Yes    |
| `tests/integration/test-config.json`             | Your real credentials                | ❌ **No** |
| `tests/integration/adapters.smoke.test.ts`       | The smoke test suite                 | ✅ Yes    |
| `tests/integration/vitest.config.integration.ts` | Vitest config for real-network tests | ✅ Yes    |

> ⚠ `test-config.json` is listed in `.gitignore`. Never force-add it.
> Tokens and cookies must never be logged, committed, or sent to external servers.

---

## Running in CI

These tests require live credentials and are **not** run in the standard CI pipeline (`npm test`).
Run them manually before a release or when a supplier reports pricing issues:

```powershell
npm run test:integration
```

If you want to add them to CI, inject credentials as environment variables and write a small script
that builds `test-config.json` from `$env:REXEL_TOKEN`, `$env:BRICODEPOT_COOKIES`, etc. before running.
