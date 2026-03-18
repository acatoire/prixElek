# prixElek Project Structure & Architecture

## Directory Layout

```
prixElek/
│
├── 📄 Root Configuration Files
│   ├── README.md                    # Project overview & quick start
│   ├── GETTING_STARTED.md           # Developer onboarding guide
│   ├── IMPROVEMENTS.md              # Documentation changes summary
│   ├── COMPLETION_REPORT.md         # Project setup completion report
│   ├── .copilot-instructions        # GitHub Copilot developer guidelines
│   ├── LICENSE                      # MIT License
│   ├── .gitignore                   # Git ignore rules
│   │
│   ├── 🔧 Build & Development Configuration
│   ├── package.json                 # npm dependencies & scripts
│   ├── tsconfig.json                # TypeScript configuration
│   ├── vite.config.ts               # Vite bundler configuration
│   ├── eslint.config.js             # ESLint code quality rules
│   ├── prettier.config.js           # Prettier code formatting
│   └── .env.example                 # Environment variables template
│
├── 📁 config/
│   ├── 📋 User Configuration Files
│   ├── catalogue.json               # Material catalog (user-maintained)
│   ├── catalogue.example.json       # Example catalog with sample items
│   ├── fournisseurs.json            # ⚠️ Supplier config (in .gitignore - not committed)
│   └── fournisseurs.example.json    # Example supplier configuration
│
├── 📁 src/ (Application Source Code)
│   ├── 📁 components/               # Reusable React/Vue components
│   │   ├── PriceTable.tsx/.vue      # Main price comparison table
│   │   ├── CartView.tsx/.vue        # Shopping cart display
│   │   ├── LoadingSpinner.tsx/.vue  # Loading indicator
│   │   ├── SupplierColumn.tsx/.vue  # Individual supplier column
│   │   ├── ErrorBoundary.tsx/.vue   # Error handling component
│   │   └── ...
│   │
│   ├── 📁 modules/                  # Feature modules (modular architecture)
│   │   │
│   │   ├── priceComparator/         # Module 1: Price Comparison
│   │   │   ├── index.ts             # Module exports
│   │   │   ├── PriceComparatorView.tsx
│   │   │   ├── useComparison.ts     # Custom hook
│   │   │   └── store.ts             # State management (Pinia)
│   │   │
│   │   ├── cart/                    # Module 1 Phase 2: Comparative Cart
│   │   │   ├── index.ts
│   │   │   ├── CartView.tsx
│   │   │   ├── useCart.ts
│   │   │   └── store.ts
│   │   │
│   │   ├── quoteEditor/             # Module 2: Quote Editor (V2)
│   │   │   ├── index.ts
│   │   │   ├── QuoteEditorView.tsx
│   │   │   └── store.ts
│   │   │
│   │   └── discountRequest/         # Module 3: Discount Request (V2)
│   │       ├── index.ts
│   │       ├── DiscountRequestView.tsx
│   │       └── store.ts
│   │
│   ├── 📁 adapters/                 # Supplier-specific API adapters
│   │   ├── base.ts                  # Base adapter (abstract class)
│   │   │   └── Exports: FournisseurAdapter (interface)
│   │   │
│   │   ├── rexel.ts                 # Rexel supplier adapter
│   │   │   ├── RexelAdapter class
│   │   │   ├── authenticate()
│   │   │   └── getPrice()
│   │   │
│   │   ├── sonepar.ts               # Sonepar supplier adapter
│   │   ├── yesss.ts                 # YESSS Électrique adapter
│   │   ├── materielelectrique.ts    # MaterielElectrique.com adapter
│   │   │
│   │   └── __tests__/               # Adapter unit tests
│   │       ├── rexel.test.ts
│   │       ├── sonepar.test.ts
│   │       └── ...
│   │
│   ├── 📁 services/                 # Core business logic services
│   │   ├── PriceService.ts          # Orchestrates all adapters
│   │   │   └── fetchAllPrices()
│   │   │   └── refreshPrices()
│   │   │
│   │   ├── CatalogService.ts        # Loads & manages catalogue.json
│   │   │   └── loadCatalog()
│   │   │   └── getMaterialById()
│   │   │   └── filterMaterials()
│   │   │
│   │   ├── TokenService.ts          # Manages supplier tokens
│   │   │   └── saveToken()
│   │   │   └── getToken()
│   │   │   └── clearToken()
│   │   │
│   │   ├── CacheService.ts          # Price caching with TTL
│   │   │   └── getPrice()
│   │   │   └── setPrice()
│   │   │   └── clearCache()
│   │   │
│   │   ├── ErrorService.ts          # Error handling & logging
│   │   └── ...
│   │
│   ├── 📁 types/                    # TypeScript interfaces & types
│   │   ├── supplier.ts              # Supplier interfaces
│   │   │   ├── Supplier interface
│   │   │   └── SupplierConfig
│   │   │
│   │   ├── material.ts              # Material interfaces
│   │   │   ├── Material interface
│   │   │   └── MaterialReference
│   │   │
│   │   ├── price.ts                 # Price interfaces
│   │   │   ├── Price interface
│   │   │   └── PriceMatrix
│   │   │
│   │   ├── error.ts                 # Error types
│   │   │   └── FetchError interface
│   │   │
│   │   └── ...
│   │
│   ├── 📁 utils/                    # Utility functions & helpers
│   │   ├── logger.ts                # Logging utility
│   │   │   ├── log()
│   │   │   ├── error()
│   │   │   └── debug()
│   │   │
│   │   ├── errorHandler.ts          # Error handling utilities
│   │   │   ├── handleFetchError()
│   │   │   └── getErrorMessage()
│   │   │
│   │   ├── formatters.ts            # Data formatting
│   │   │   ├── formatPrice()
│   │   │   ├── formatDate()
│   │   │   └── ...
│   │   │
│   │   ├── constants.ts             # Application constants
│   │   │   ├── SUPPLIER_IDS
│   │   │   ├── API_TIMEOUT
│   │   │   └── CACHE_TTL
│   │   │
│   │   ├── validators.ts            # Input validation
│   │   └── helpers.ts               # Helper functions
│   │
│   ├── 📁 store/                    # Global state management (Pinia)
│   │   ├── index.ts                 # Store configuration
│   │   ├── app.ts                   # Application state
│   │   ├── prices.ts                # Price data state
│   │   ├── cart.ts                  # Cart state
│   │   └── ui.ts                    # UI state
│   │
│   ├── 📄 App.vue                   # Main app component
│   ├── 📄 index.ts                  # Application entry point
│   └── 📄 main.ts                   # Vue app initialization
│
├── 📁 doc/ (Documentation)
│   ├── cdc.md                       # Main specification (Cahier des Charges)
│   │   └── Contains all requirements, architecture, security
│   │
│   ├── cdc-m1.md                    # Module 1: Price Comparator
│   │   └── Catalog structure, UI design, implementation details
│   │
│   ├── cdc-m2.md                    # Module 2: Quote Editor (V2)
│   │   └── Quote generation, margin calculation, PDF export
│   │
│   ├── cdc-m3.md                    # Module 3: Discount Request (V2)
│   │   └── Discount request generation, competitor analysis
│   │
│   └── scraping.md                  # Technical guide: Accessing supplier data
│       └── API discovery, adapter pattern, Windows development
│
└── 📁 .vscode/ (Optional: VS Code Configuration)
    ├── launch.json                  # Debug configuration
    ├── settings.json                # Editor settings
    └── extensions.json              # Recommended extensions
```

---

## Core Concepts

### 1. Adapter Pattern (Suppliers)

```
Supplier APIs
    ↓
Adapters (RexelAdapter, SoneParAdapter, etc.)
    ↓
PriceService (orchestrator)
    ↓
State Management (Pinia)
    ↓
Components (PriceTable, Cart, etc.)
    ↓
User Interface
```

### 2. Module Architecture

Each module is self-contained with:
- **View Component** — UI presentation
- **Store** — State management (Pinia)
- **Services** — Business logic
- **Types** — TypeScript interfaces
- **Tests** — Unit tests

### 3. Data Flow

```
catalogue.json (User Materials)
    ↓
CatalogService (Load & Filter)
    ↓
PriceService (Fetch Prices)
    ↓
Adapters (Call Supplier APIs)
    ↓
TokenService (Manage Auth)
    ↓
CacheService (Store Results)
    ↓
State (Pinia Store)
    ↓
Components (Render UI)
```

---

## File Naming Conventions

### TypeScript Files
- **Services:** `ServiceName.ts` (e.g., `PriceService.ts`)
- **Adapters:** `SupplierNameAdapter.ts` (e.g., `RexelAdapter.ts`)
- **Types:** `typeName.ts` (e.g., `supplier.ts`, `material.ts`)
- **Utils:** `functionName.ts` (e.g., `logger.ts`, `formatters.ts`)

### Vue Components
- **Single-file:** `ComponentName.vue`
- **Composition API:** Uses `<script setup lang="ts">`
- **Custom Hooks:** `useFeatureName.ts` (e.g., `useComparison.ts`)

### Tests
- **Unit tests:** `component.test.ts` or `service.test.ts`
- **Location:** `__tests__/` folder in same directory
- **Framework:** Vitest + Vue Test Utils

---

## Configuration Files Explained

| File | Purpose | Edit By |
|------|---------|---------|
| `package.json` | npm dependencies & scripts | Developers (Git) |
| `tsconfig.json` | TypeScript configuration | Developers (Git) |
| `vite.config.ts` | Build configuration | Developers (Git) |
| `eslint.config.js` | Code quality rules | Developers (Git) |
| `prettier.config.js` | Code formatting | Developers (Git) |
| `.env.example` | Environment template | Reference only (Git) |
| `.env` | Actual credentials | ⚠️ Local only, NOT Git |
| `catalogue.json` | Material list | Users (Local, NOT Git) |
| `fournisseurs.json` | Supplier config | Users (Local, NOT Git) |

---

## Environment Setup

```powershell
# 1. Install dependencies
npm install

# 2. Create local .env from template
Copy-Item .env.example .env

# 3. Edit .env with actual credentials
# DO NOT commit .env to git

# 4. Create config files
Copy-Item config\catalogue.example.json config\catalogue.json
Copy-Item config\fournisseurs.example.json config\fournisseurs.json

# 5. Start development
npm run dev
```

---

## Build Process

```
Source Code (TypeScript/Vue)
    ↓
ESLint (Code Quality Check)
    ↓
TypeScript Compiler (Type Check)
    ↓
Vite Bundler (Bundle & Optimize)
    ↓
Terser (Minify)
    ↓
dist/ (Production Ready)
```

---

## Testing Structure

```
src/
├── components/
│   ├── PriceTable.vue
│   └── __tests__/
│       └── PriceTable.test.ts
├── services/
│   ├── PriceService.ts
│   └── __tests__/
│       └── PriceService.test.ts
└── adapters/
    ├── base.ts
    └── __tests__/
        ├── rexel.test.ts
        └── sonepar.test.ts
```

---

## Dependencies Overview

### Core Dependencies
- **vue** (3.3+) — UI framework
- **pinia** (2.1+) — State management
- **axios** (1.6+) — HTTP requests

### Development Dependencies
- **typescript** — Type checking
- **vite** — Build tool
- **vitest** — Test framework
- **eslint** — Code quality
- **prettier** — Code formatting
- **tailwindcss** — Styling

---

## Security Architecture

```
Supplier Credentials
    ↓
Environment Variables (.env)
    ↓
TokenService (Encrypted localStorage)
    ↓
Adapters (Use token for auth)
    ↓
No external servers receive credentials
```

---

## Performance Optimization

- **Caching:** Price cache with 15-min TTL
- **Lazy Loading:** Load modules on demand
- **Code Splitting:** Vite auto-splits bundles
- **Tree Shaking:** Remove unused code
- **Minification:** Terser compresses output

---

## Version Control Strategy

```
main (production)
    ↑
    ├── feature/adapter-rexel (development)
    ├── feature/price-comparator
    └── bugfix/token-expiration

Commit: git commit -m "type(scope): description"
Example: git commit -m "feat(adapters): implement Rexel authentication"
```

---

## Next Steps for Development

1. **Create adapters** — Implement supplier APIs in `src/adapters/`
2. **Build services** — Orchestrate adapters in `src/services/`
3. **Design components** — Create UI in `src/components/`
4. **Setup state** — Configure Pinia stores in `src/store/`
5. **Add tests** — Write unit tests in `__tests__/` folders
6. **Deploy** — Build and deploy from `dist/`

---

## Resource Links

- **Typescript:** https://www.typescriptlang.org/
- **Vue 3:** https://vuejs.org/
- **Pinia:** https://pinia.vuejs.org/
- **Vite:** https://vitejs.dev/
- **Vitest:** https://vitest.dev/

---

**Architecture Version:** 1.0  
**Last Updated:** 2026-03-18  
**Status:** Ready for Phase 1 Development ✨

