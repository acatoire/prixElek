# GitHub Copilot Instructions — prixElek

> AI assistant guidelines. Stay **KISS** (Keep It Simple, Stupid).
> Generate code files only — no extra report files unless explicitly requested.

## Development OS

- Primary: Windows 10/11

Be careful to use windows command line syntax in scripts and documentation, and test on Windows to avoid cross-platform
issues. On powershell, use `Get-ChildItem` instead of `ls` or `dir`, and `Copy-Item` instead of `cp`. Avoid
Unix-specific commands like `rm`, `tail`,  or `mv`.

---

## Stack

- **React 18** + **TypeScript** (strict)
- **Vite** for bundling, **Vitest** for tests, **Tailwind CSS** for styles
- Path alias `@/` maps to `src/`
- HTTP client: **Axios**
- Testing: **Vitest** + **@testing-library/react** + **MSW**

## After every code change

**Always run the following three commands after making changes**, in order:

1. **Prettier** — auto-format all edited files:
   ```bash
   npx prettier --write "src/**/*.{ts,tsx,css}" "tools/**/*.ts"
   ```
2. **Build** — strict type-check + bundle (`tsc -b` then `vite build`). Tests alone do not catch TypeScript errors in test files:
   ```bash
   npm run build   # must pass with 0 errors before considering a task done
   ```
3. **Tests** — all must pass:
   ```bash
   npx vitest run
   ```

## Project structure

| Path              | Purpose                                                      |
|-------------------|--------------------------------------------------------------|
| `src/adapters/`   | One adapter per supplier — `getPrice(ref)` → `SupplierPrice` |
| `src/hooks/`      | React hooks (`usePriceScan`, `useRexelAuth`, …)              |
| `src/components/` | UI components                                                |
| `src/types/`      | Shared TypeScript interfaces                                 |
| `tools/`          | CLI dev tools (`probe-rexel.ts`, `add-to-catalogue.ts`, …)   |
| `catalogue/`      | Static JSON catalogues                                       |
| `config/`         | Scraping config                                              |

## Language & code standards

- All code (variable names, function names, comments) in **English**
- French only in `doc/` folder and for French business-context terms in parentheses
- Named exports only — no default exports
- Functional React components with explicit TypeScript props interfaces
- No class components

## Architecture

- **Adapter pattern** for suppliers — base class `SupplierAdapter`, one file per supplier in `src/adapters/`
- Each adapter implements `getPrice(reference): Promise<SupplierPrice>`
- Services in `src/services/` handle business logic
- React `useState`/`useReducer` for local state, `Context` for global state — no external state library

## Security

- Tokens stored **only** in `localStorage` under `prixelek_*` keys
- Tokens must never be logged, committed, or sent to external servers
- `config/scraping.config.json` — OK to commit; supplier credentials — **never** commit

## Error handling

```typescript
// FetchError codes: 'AUTH_ERROR' | 'NETWORK_ERROR' | 'NOT_FOUND' | 'RATE_LIMIT' | 'PARSE_ERROR'
// retryable: true → exponential backoff (1 s, 2 s, 4 s), max 3 retries
// 429 status → back off 60 s
// Request timeout: 15 s
// Min delay between supplier calls: 500 ms
```

## Testing

- Co-locate tests: `src/adapters/rexel.ts` → `src/adapters/rexel.test.ts`
- Mock all HTTP calls with **MSW** (`setupServer`)
- Mock `localStorage` where needed
- Every new file needs a corresponding test file

## Git commit format

```
feat(adapters): implement Rexel adapter with bearer token auth
fix(service): correct cache invalidation on price refresh
type(scope): subject
```

---

## Rexel adapter notes

The Rexel price API (`/web/api/v3/product/priceandavailability`) requires:

- `quantity` as an **object** `{ number: 1 }` — a primitive (string or int) triggers `"Failed to read request"` (400)
- `accountId` from `ERPCustomerID.accountNumber` in the JWT — in the **body**, not a query param
- `branchId`, `zipcode`, `city` — the user's local agency info, **not** in the JWT, stored in `localStorage`
- Full body shape captured from F12 DevTools:

```json
{
  "accountId": "...",
  "branchId": "4413",
  "pickupOptions": {
    "branchCode": "4413"
  },
  "deliveryOptions": {
    "branchCode": "4413",
    "location": {
      "country": "FR",
      "zipcode": "44880",
      "city": "SAUTRON"
    }
  },
  "stockReturnedOptions": {
    "includeDCStock": true,
    "includeBranchStock": true,
    "includeDelay": true
  },
  "includeLeasePrice": true,
  "lines": [
    {
      "sku": "71041542",
      "quantity": {
        "number": 1
      }
    }
  ]
}
```

Use `npx tsx tools/probe-rexel.ts <token> [sku] [branchId] [zipcode] [city]` to re-validate if the API changes again.
