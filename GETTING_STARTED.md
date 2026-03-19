# Getting Started with prixElek Development

## 🎯 Quick Reference for Developers

Welcome to the prixElek project! This guide will help you set up your development environment and understand the project
structure.

---

## Prerequisites

- **OS:** Windows (primary), macOS/Linux (secondary)
- **Node.js:** v14+ ([Download](https://nodejs.org/))
- **npm:** v6+ (included with Node.js)
- **Browser:** Chrome, Firefox, or Edge (for testing)
- **Code Editor:** VS Code recommended with extensions

---

## 1. Initial Setup on Windows

### Step 1: Clone the Repository

```powershell
# Navigate to your workspace
cd C:\git  # or your preferred location

# Clone the repo
git clone https://github.com/yourusername/prixElek.git
cd prixElek
```

### Step 2: Install Dependencies

```powershell
# Install Node dependencies
npm install

# Verify installation
npm --version
node --version
```

### Step 3: Create Configuration Files

```powershell
# Create config directory if it doesn't exist
New-Item -ItemType Directory -Path config -ErrorAction SilentlyContinue

# Create catalogue.json (starter template)
@{
    materiaux = @(
        @{
            id = "prise-2p-t-legrand"
            nom = "Prise 2P+T"
            marque = "Legrand"
            categorie = "Appareillage"
            references_fournisseurs = @{
                rexel = "LEG-050430"
            }
        }
    )
} | ConvertTo-Json | Out-File config\catalogue.json -Encoding UTF8

# Create .env file (credentials NOT committed to git)
# Note: fournisseurs.json should also be in .gitignore
```

### Step 4: Start Development Server

```powershell
# Start the development server
npm run dev

# Expected output:
# ➜ Local: http://localhost:5173/
# ➜ press h to show help

# In browser: http://localhost:5173
```

---

## 2. Project Structure Overview

### Root Files

```
prixElek/
├── .copilot-instructions       # GitHub Copilot guidelines (READ THIS!)
├── README.md                   # Project overview
├── IMPROVEMENTS.md             # Documentation changes log
├── package.json                # Node.js dependencies
├── .env.example                # Environment variables template
├── .gitignore                  # Git ignore rules
└── LICENSE                     # MIT License
```

### Source Code

```
src/
├── components/                 # Reusable React/Vue components
│   ├── PriceTable.tsx
│   ├── CartView.tsx
│   └── LoadingSpinner.tsx
├── modules/                    # Feature modules
│   ├── priceComparator/
│   ├── cart/
│   └── ...
├── adapters/                   # Supplier-specific API adapters
│   ├── base.ts
│   ├── rexel.ts
│   ├── sonepar.ts
│   └── ...
├── services/                   # Core business logic
│   ├── PriceService.ts
│   ├── CatalogService.ts
│   ├── TokenService.ts
│   └── CacheService.ts
├── types/                      # TypeScript interfaces
│   ├── supplier.ts
│   ├── material.ts
│   └── price.ts
├── utils/                      # Utility functions
│   ├── logger.ts
│   ├── errorHandler.ts
│   └── formatters.ts
├── App.tsx                     # Main app component
└── index.tsx                   # Entry point
```

### Documentation

```
doc/
├── cdc.md                      # Main specification (French)
├── cdc-m1.md                   # Module 1: Price Comparator
├── cdc-m2.md                   # Module 2: Quote Editor (V2)
├── cdc-m3.md                   # Module 3: Discount Request (V2)
└── scraping.md                 # Technical: API access strategy
```

### Configuration

```
config/
├── catalogue.json              # Material catalog (user-maintained)
└── fournisseurs.json           # Supplier config (⚠️ NOT in git, use .env)
```

---

## 3. Core Concepts

### Adapter Pattern

Each supplier has an adapter that handles authentication and price fetching:

```typescript
// Example: src/adapters/base.ts
export abstract class FournisseurAdapter {
    abstract authenticate(login: string, password: string): Promise<{ success: boolean, token: string }>;

    abstract getPrice(reference: string, token: string): Promise<{ prix_ht: number, stock?: number, unite: string }>;
}

// Implementation: src/adapters/rexel.ts
export class RexelAdapter extends FournisseurAdapter {
    async authenticate(login, password) { /* implementation */
    }

    async getPrice(reference, token) { /* implementation */
    }
}
```

### Service Layer

Services orchestrate adapters and manage data:

```typescript
// src/services/PriceService.ts
export class PriceService {
    async fetchAllPrices(materials: Material[]): Promise<PriceMatrix> {
        // Calls all adapter.getPrice() methods
        // Handles errors gracefully
        // Returns organized price data
    }
}
```

### Components

React/Vue components display data and handle user interactions:

```typescript
// src/components/PriceTable.tsx
export const PriceTable: React.FC<PriceTableProps> = ({materials, loading}) => {
    // Render price comparison table
};
```

---

## 4. Development Workflow

### Starting a Feature

```powershell
# Create feature branch
git checkout -b feature/adapter-rexel

# Make changes, commit frequently
git add .
git commit -m "feat(adapters): implement Rexel authentication"

# Start dev server to test
npm run dev
```

### Running Tests

```powershell
# Run all tests
npm run test

# Run tests for specific file
npm run test -- adapters/rexel.test.ts

# Run tests in watch mode
npm run test -- --watch

# Generate coverage report
npm run test -- --coverage
```

### Code Quality

```powershell
# Check for linting errors
npm run lint

# Fix auto-fixable linting issues
npm run lint -- --fix

# Format code with Prettier
npm run format

# Type check (if TypeScript)
npm run type-check
```

### Build for Production

```powershell
# Create production build
npm run build

# Verify build output
Get-ChildItem dist/

# Preview production build locally
npm run preview
```

### Deploy on production

To deploy you need to have push `dist/` to your branch and got it merged on the main branch.
Create a new release on GitHub.
└── The release will trigger the rebase-prod workflow that will merge the main branch into the production branch
    └──This will trigger the web-deploy workflow that will deploy it to production using ftp.

---

## 5. Supplier Investigation (Scraping Phase)

### Discovering API Endpoints

1. **Open DevTools** (F12 in Chrome/Firefox)
2. **Go to Network tab** → Filter by "Fetch/XHR"
3. **Visit supplier website** and log in
4. **Inspect requests** to find price API endpoints
5. **Document findings** in `doc/scraping.md` Section 7

### Example DevTools Investigation

```
1. F12 (open DevTools)
2. Click "Network" tab
3. Filter: type in "Fetch/XHR"
4. Navigate to Rexel.fr
5. Log in with test account
6. Search for a product by reference
7. Look for request containing "price" or "product"
8. Right-click → Copy as fetch
9. Test the request in your adapter code
```

### Creating an Adapter

```powershell
# 1. Create adapter file
New-Item src/adapters/rexel.ts

# 2. Implement base class methods
# 3. Add unit tests
# 4. Document endpoint in scraping.md
# 5. Test with real supplier

npm run test -- adapters/rexel.test.ts
```

---

## 6. Debugging on Windows

### VS Code Debugging

1. Install "Debugger for Chrome" extension
2. Create `.vscode/launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "chrome",
      "request": "launch",
      "name": "prixElek Dev",
      "url": "http://localhost:5173",
      "webRoot": "${workspaceFolder}/src"
    }
  ]
}
```

3. Press F5 to start debugging

### PowerShell Debug Commands

```powershell
# Set debug environment
$env:DEBUG = "prixelek:*"

# Run with detailed logging
npm run dev

# In another PowerShell window, test adapter
npm test -- adapters/

# Kill dev server if stuck
Get-Process -Name "node" | Stop-Process -Force
```

### Browser Console Debugging

```javascript
// In browser console (F12)
// Check token storage
localStorage.getItem('prixelek_token_rexel');

// View cached prices
JSON.parse(localStorage.getItem('prixelek_cache'));

// Monitor network requests
// Use Network tab to inspect API calls
```

---

## 7. Important Security Notes

### ⚠️ Never Commit

- `config/fournisseurs.json` (contains tokens)
- `.env` or `.env.local` files
- API keys or passwords
- Session tokens

### ✅ Always

- Use `.gitignore` to exclude sensitive files
- Store credentials in `.env` (see `.env.example`)
- Use environment variables in code
- Review code before committing

---

## 8. Common Commands Reference

```powershell
# Development
npm run dev              # Start dev server (http://localhost:5173)
npm run build            # Build for production
npm run preview          # Preview production build

# Testing
npm run test             # Run all tests
npm run test -- --watch  # Run tests in watch mode
npm test -- --coverage   # Generate coverage report

# Code Quality
npm run lint             # Check for linting errors
npm run lint -- --fix    # Auto-fix linting issues
npm run format           # Format code with Prettier
npm run type-check       # Check TypeScript types

# Git
git status               # Show changes
git add .               # Stage all changes
git commit -m "msg"     # Commit with message
git push                # Push to remote
git branch              # List branches
```

---

## 9. Environment Variables (.env)

Create `.env` file in root directory:

```env
# API Development
VITE_API_BASE_URL=http://localhost:3000
NODE_ENV=development
DEBUG=prixelek:*

# Supplier Configuration
# NEVER commit actual tokens, use .env file only
REXEL_USERNAME=your_username
REXEL_PASSWORD=your_password

# Feature Flags
VITE_ENABLE_QUOTE_MODULE=false
VITE_ENABLE_DISCOUNT_MODULE=false
```

---

## 10. Troubleshooting

### Port 5173 Already in Use

```powershell
# Find process using port
netstat -ano | findstr :5173

# Kill the process (replace PID with actual process ID)
taskkill /PID 1234 /F

# Or just restart your terminal
```

### Module Not Found Error

```powershell
# Clear node_modules and reinstall
Remove-Item -Recurse -Force node_modules
npm install

# Clear npm cache
npm cache clean --force
```

### TypeScript Errors

```powershell
# Regenerate types
npm run type-check

# Rebuild TypeScript
npm run build -- --force
```

### CORS Issues in Development

- Already handled by dev server proxy
- See `vite.config.ts` for proxy configuration
- Production: ensure backend sets proper CORS headers

---

## 11. Next Steps

1. **Read `.copilot-instructions`** — Understand project guidelines
2. **Review documentation** — Start with `doc/cdc.md`
3. **Investigate supplier APIs** — Follow `doc/scraping.md`
4. **Create first adapter** — Start with Rexel or Sonepar
5. **Write tests** — Use test structure provided
6. **Submit PR** — Follow git workflow

---

## Resources

| Resource             | Link                                             |
|----------------------|--------------------------------------------------|
| Project Spec         | [doc/cdc.md](doc/cdc.md)                         |
| Module 1             | [doc/cdc-m1.md](doc/cdc-m1.md)                   |
| API Guide            | [doc/scraping.md](doc/scraping.md)               |
| Copilot Instructions | [.copilot-instructions](.copilot-instructions)   |
| Contributing         | [README.md#contributing](README.md#contributing) |

---

## Questions?

- Check documentation in `/doc`
- Review `.copilot-instructions` for code standards
- Look at existing code in `src/` for examples
- Open an issue on GitHub

---

**Version:** 1.0  
**Last Updated:** 2026-03-18  
**Compatible with:** Node.js 14+, Windows 10/11, PowerShell 5.1+

