# prixElek 🔌💰

> A lightweight business tool for independent electricians · Web application · Modular architecture

---

## Table of Contents

- [Overview](#overview)
- [Quick Start](#quick-start)
- [Project Structure](#project-structure)
- [Documentation](#documentation)
- [Roadmap](#roadmap)
- [Technology Stack](#technology-stack)
- [Contributing](#contributing)

---

## Overview

**prixElek** is a web application designed to help independent electricians save time comparing electrical material
prices across multiple suppliers.

### Key Features

- 🔍 **Price Comparison** — Compare prices across your suppliers at a glance
- 🛒 **Comparative Cart** — Build a shopping cart and compare total costs
- 📊 **Centralized Catalog** — Manage your material references in one place
- ⚡ **Fast & Simple** — Lightweight, no complex onboarding needed
- 🔌 **Modular Architecture** — Extensible design, plug-in based modules

### Target Users

- Independent electricians working solo or with 1-2 technicians
- Users who need efficiency without complexity
- Professionals managing multiple supplier accounts

---

## Quick Start

### Prerequisites

- A modern web browser (Chrome, Firefox, Edge)
- Node.js (v14+) and npm (if developing/running locally)
- Basic knowledge of JSON file editing

### Installation

```powershell
# Clone the repository
git clone https://github.com/yourusername/prixElek.git
cd prixElek

# Install dependencies (when backend is set up)
npm install

# Start development server
npm run dev
```

### Configuration

1. **Create your catalog** — Edit `config/catalogue.json` with your materials:
   ```json
   {
     "materiaux": [
       {
         "id": "prise-2p-t-legrand",
         "nom": "Prise 2P+T",
         "marque": "Legrand",
         "categorie": "Appareillage",
         "references_fournisseurs": {
           "rexel": "LEG-050430"
         }
       }
     ]
   }
   ```

2. **Configure suppliers** — Edit `config/fournisseurs.json` with your accounts and credentials

3. **Access the app** — Open your browser and start comparing prices

---

## Project Structure

```
prixElek/
├── doc/                          # Project documentation
│   ├── cdc.md                    # Main specification document (Cahier des Charges)
│   ├── cdc-m1.md                 # Module 1: Price Comparator
│   ├── cdc-m2.md                 # Module 2: Quote Editor (V2)
│   ├── cdc-m3.md                 # Module 3: Discount Request (V2)
│   └── scraping.md               # Technical guide: Accessing supplier data
├── config/
│   ├── catalogue.json            # Your material catalog
│   └── fournisseurs.json         # Supplier configurations & tokens
├── src/                          # Application source code (frontend + backend)
│   ├── adapters/                 # Supplier-specific adapters
│   ├── modules/                  # Feature modules
│   ├── services/                 # Core services
│   └── components/               # UI components
├── README.md                     # This file
└── LICENSE                       # MIT License
```

---

## Documentation

For detailed information, refer to the project documentation:

| Document                           | Purpose                                                                             |
|------------------------------------|-------------------------------------------------------------------------------------|
| [**cdc.md**](doc/cdc.md)           | Complete specification including context, objectives, architecture, and roadmap     |
| [**cdc-m1.md**](doc/cdc-m1.md)     | Price Comparator module — catalog structure, UI design, implementation details      |
| [**cdc-m2.md**](doc/cdc-m2.md)     | Quote Editor module (planned for V2)                                                |
| [**cdc-m3.md**](doc/cdc-m3.md)     | Discount Request module (planned for V2)                                            |
| [**scraping.md**](doc/scraping.md) | Technical deep-dive on accessing supplier data, endpoint discovery, adapter pattern |

---

## Roadmap

### Phase 1 — MVP Price Comparator (Current)

- [ ] Material catalog loading
- [ ] Multi-supplier price fetching
- [ ] Comparative table display with best price highlight
- [ ] Basic filters (category, brand) + search
- [ ] Refresh mechanism

### Phase 2 — Comparative Cart

- [ ] Article selection with quantities
- [ ] Cart view with totals by supplier
- [ ] Export to CSV / Print
- [ ] Basic analytics

### Phase 3 — V2 Modules

- [ ] Quote Editor (generate & PDF export)
- [ ] Discount Request generator
- [ ] Admin panel for catalog management

---

## Technology Stack

### Frontend

- **Framework** — Vue 3 (`<script setup lang="ts">`, Composition API)
- **State Management** — Pinia
- **Styling** — TailwindCSS
- **HTTP Client** — Axios

### Backend

- None in V1 — all supplier calls made directly from the browser via the adapter layer

### Build & Deployment

- **Bundler** — Vite
- **Testing** — Vitest + @vue/test-utils (100% coverage enforced)
- **Linting** — ESLint + Prettier
- **Hosting** — Local (`npm run dev`) or any static host

---

## Configuration Files

### `catalogue.json`

Your material reference database. Manually maintained, source of truth for tracked items.

### `fournisseurs.json`

Supplier configurations including API endpoints, authentication tokens, and UI settings.

**⚠️ Security**: Never commit credentials to version control. Use environment variables or `.gitignore` protected files.

---

## Security & Privacy

- All tokens and credentials are stored **locally only** — never sent to external servers
- Prices fetched are your account-specific prices — you have legitimate access
- The application respects supplier CGU but operates in a personal use context
- Implement rate limiting and delays between requests to avoid overloading suppliers

For legal and ethical considerations, see [scraping.md#section-6](doc/scraping.md#6-considérations-légales-et-éthiques).

---

## Contributing

Contributions are welcome! Please follow these guidelines:

1. **Code Style** — Use English for all code comments and variable names
2. **Documentation** — Update docs when adding features
3. **Commits** — Use clear, descriptive commit messages
4. **Testing** — Write tests for new modules

---

## License

MIT License — see [LICENSE](LICENSE) file for details

---

## Troubleshooting

### Price fetch fails

- Verify your supplier credentials are correctly entered in `fournisseurs.json`
- Check that tokens haven't expired (most expire after 7 days)
- Review browser console for detailed error messages

### Material catalog not loading

- Ensure `catalogue.json` is valid JSON
- Verify the file path is correct
- Check file permissions

### Windows PowerShell Commands

All commands in this project support PowerShell. Examples:

```powershell
# Run dev server
npm run dev

# Build production
npm run build

# Run tests
npm run test
```

---

**Questions?** See the documentation in `/doc` or open an issue on GitHub.

**Last updated:** 2026-03-18
