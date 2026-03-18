# prixElek — Document Technique : Accès aux données fournisseurs

> Stratégie d'intégration des prix · Version 0.1

---

## 1. Contexte

Aucun des quatre fournisseurs ciblés ne propose d'API publique accessible à un électricien indépendant. L'accès aux
données de prix doit donc être obtenu par une approche alternative, présentée dans ce document.

| Fournisseur            | API publique | E-procurement B2B                 | Espace pro connecté            |
|------------------------|--------------|-----------------------------------|--------------------------------|
| Rexel                  | ❌            | EDI/ERP grands comptes uniquement | ✅ rexel.fr (compte requis)     |
| Sonepar                | ❌            | API sur demande commerciale, ERP  | ✅ sonepar.fr (compte requis)   |
| YESSS Électrique       | ❌            | ❌                                 | ✅ YESSSPRO (compte requis)     |
| MaterielElectrique.com | ❌            | ❌                                 | ✅ prix visibles sans connexion |

---

## 2. Stratégie retenue : interception des requêtes internes

### 2.1 Principe

Les sites modernes (React, Vue, Angular) ne chargent pas les prix dans le HTML initial. Ils font des appels **XHR /
Fetch** en arrière-plan vers leurs propres APIs internes pour charger dynamiquement les données produit (prix, stock,
disponibilité).

Ces appels internes sont :

- Non documentés publiquement
- Mais entièrement visibles dans l'onglet **Réseau** des DevTools du navigateur
- Reproductibles via un simple appel `fetch` ou `axios` depuis un backend Node.js, à condition de transmettre les bons
  headers et cookies de session

C'est l'approche la plus propre techniquement : on ne parse pas du HTML fragile, on consomme directement du **JSON
structuré** comme le ferait le front du site lui-même.

### 2.2 Pourquoi demander à l'utilisateur de se connecter

Les prix affichés sur ces sites sont **des prix personnalisés** (remises négociées par compte, tarifs pro). Pour obtenir
les vrais prix de l'utilisateur — et non des prix catalogue publics — il faut que la session soit authentifiée.

L'approche est donc :

1. L'utilisateur se connecte **une fois** sur chaque fournisseur depuis prixElek (ou depuis son navigateur)
2. prixElek récupère le **cookie de session** ou le **token JWT** issu de cette connexion
3. Ce token est stocké localement (jamais envoyé à un serveur tiers)
4. Toutes les requêtes de prix sont jouées avec ce token → les prix retournés sont les prix réels du compte

---

## 3. Méthode de découverte des endpoints

### 3.1 Outillage nécessaire

- **Chrome / Firefox DevTools** → onglet Réseau (Network)
- Filtre : `Fetch/XHR` pour ne voir que les appels API
- Extension optionnelle : **ModHeader** (Chrome) pour rejouer des requêtes avec headers modifiés

### 3.2 Procédure type (à reproduire pour chaque fournisseur)

**Étape 1 — Ouvrir les DevTools avant de naviguer**

```
F12 → Onglet "Réseau" → Filtre "Fetch/XHR" → Cocher "Préserver le journal"
```

**Étape 2 — Se connecter sur le site fournisseur**

Observer les requêtes lors du login. Repérer :

- L'URL du endpoint d'authentification (ex: `/api/auth/login`, `/oauth/token`)
- Le format du body envoyé (JSON, form-data)
- Le type de token retourné (cookie `session_id`, header `Authorization: Bearer xxx`, etc.)

**Étape 3 — Naviguer vers une fiche produit**

Chercher un produit par sa référence. Observer les requêtes XHR et repérer :

- L'endpoint qui retourne le **prix** (chercher les mots `price`, `prix`, `tarif`, `product` dans les URLs)
- Les **paramètres** de la requête (référence produit, code agence, quantité)
- Les **headers** nécessaires (Authorization, Cookie, X-CSRF-Token, etc.)

**Étape 4 — Reproduire la requête**

Dans l'onglet Réseau, clic droit sur la requête → **"Copier en tant que fetch"** (ou cURL).

Exemple de ce qu'on obtient :

```javascript
fetch("https://www.example-fournisseur.fr/api/products/price", {
    method: "POST",
    headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer eyJhbGciOiJSUzI1NiJ9...",
        "X-Session-Id": "abc123def456"
    },
    body: JSON.stringify({
        reference: "LEG-050430",
        agencyCode: "NAN001",
        quantity: 1
    })
})
```

**Étape 5 — Valider et documenter**

Rejouer la requête dans un script Node.js ou via Postman. Si le prix retourné est correct → endpoint validé → documenter
dans `adapters/[fournisseur]/config.js`.

---

## 4. Architecture côté prixElek

### 4.1 Principe du pattern Adapter

Chaque fournisseur a son propre **adapter** : un module qui encapsule la logique d'authentification et de récupération
de prix, et expose une interface commune.

```
prixElek/
├── adapters/
│   ├── base.js           ← Interface commune (classe abstraite)
│   ├── rexel.js          ← Adapter Rexel
│   ├── sonepar.js        ← Adapter Sonepar
│   ├── yesss.js          ← Adapter YESSS
│   └── materielelectrique.js
├── services/
│   └── priceService.js   ← Orchestre les appels à tous les adapters
└── config/
    └── fournisseurs.json ← Tokens/cookies stockés localement
```

### 4.2 Interface commune (base.js)

Chaque adapter doit implémenter ces deux méthodes :

```javascript
class FournisseurAdapter {
    /**
     * Authentifie l'utilisateur et stocke le token/cookie
     * @param {string} login
     * @param {string} password
     * @returns {Promise<{success: boolean, token: string}>}
     */
    async authenticate(login, password) {
        throw new Error("Non implémenté");
    }

    /**
     * Récupère le prix d'un article par sa référence fournisseur
     * @param {string} reference  - Référence chez ce fournisseur
     * @param {string} token      - Token de session
     * @returns {Promise<{prix_ht: number, stock: number|null, unite: string}>}
     */
    async getPrice(reference, token) {
        throw new Error("Non implémenté");
    }
}
```

### 4.3 Exemple d'adapter (schéma générique)

```javascript
// adapters/rexel.js
class RexelAdapter extends FournisseurAdapter {

    async authenticate(login, password) {
        const res = await fetch("https://www.rexel.fr/[endpoint-auth-a-découvrir]", {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({username: login, password})
        });
        const data = await res.json();
        return {
            success: res.ok,
            token: data.token // ou extraire le cookie Set-Cookie
        };
    }

    async getPrice(reference, token) {
        const res = await fetch(`https://www.rexel.fr/[endpoint-prix-a-découvrir]/${reference}`, {
            headers: {
                "Authorization": `Bearer ${token}`,
                "Accept": "application/json"
            }
        });
        const data = await res.json();
        return {
            prix_ht: data.price?.net ?? null,
            stock: data.availability?.quantity ?? null,
            unite: data.salesUnit ?? "pièce"
        };
    }
}
```

### 4.4 Stockage des tokens (sécurité)

Les tokens/cookies de session sont stockés **localement uniquement** :

- En mode web local → `localStorage` chiffré (via `crypto-js`) ou `electron-store` si Electron
- Jamais envoyés à un serveur prixElek
- Durée de vie limitée à celle de la session fournisseur (en général 24h à 7 jours)
- Si le token expire → prixElek signale à l'utilisateur de se reconnecter

```javascript
// Stockage local simplifié
const tokenStore = {
    save: (fournisseurId, token) => {
        localStorage.setItem(`prixelek_token_${fournisseurId}`, token);
    },
    get: (fournisseurId) => {
        return localStorage.getItem(`prixelek_token_${fournisseurId}`);
    },
    clear: (fournisseurId) => {
        localStorage.removeItem(`prixelek_token_${fournisseurId}`);
    }
};
```

---

## 5. Gestion des cas d'erreur

| Cas                                 | Comportement attendu                                               |
|-------------------------------------|--------------------------------------------------------------------|
| Token expiré (401)                  | Afficher "Session expirée — reconnectez-vous" + bouton reconnexion |
| Endpoint modifié (404/500)          | Afficher "Fournisseur indisponible" + date dernière récup OK       |
| Rate limiting (429)                 | Attente exponentielle (1s, 2s, 4s…) puis retry × 3                 |
| Article non référencé (404 produit) | Afficher "—" dans le tableau, ne pas bloquer les autres            |
| Timeout réseau                      | Timeout à 10s par requête, puis erreur non bloquante               |

---

## 6. Considérations légales et éthiques

### Ce qui est fait ici

- L'utilisateur se connecte avec **ses propres identifiants** sur le site du fournisseur
- Les prix récupérés sont **ses propres prix négociés** — il y a légitimement accès
- Les données ne sont **pas revendues** ni partagées
- L'application est à usage **strictement personnel**

### Points de vigilance

- Les **CGU** de ces sites interdisent généralement le scraping automatisé. Cet usage reste dans une zone grise :
  l'utilisateur accède à ses propres données, via son propre compte, pour un usage privé
- Ne pas effectuer de **requêtes en masse** sur le catalogue entier : limiter aux articles du fichier `catalogue.json`
  de l'utilisateur
- Respecter des **délais entre requêtes** (ex : 500ms entre chaque appel) pour ne pas surcharger les serveurs
- Prévoir une **mise à jour manuelle** comme fallback si un fournisseur bloque les requêtes

### Recommandation à terme

Si prixElek prend de l'ampleur, contacter les fournisseurs pour régulariser l'accès via un accord commercial ou un accès
API officiel (Sonepar en particulier semble ouvert à cette démarche).

---

## 7. Endpoints confirmés & TODO

### ✅ MaterielElectrique.com — CONFIRMED (2026-03-18)

**Strategy:** HTML parsing — no authentication required. Prices are public.

**Method:** `GET https://www.materielelectrique.com/catalogsearch/result/?q={reference}`

**Price source:** `<script type="application/ld+json">` — schema.org `Product` block embedded in the HTML.

```json
{
  "@type": "Product",
  "sku": "LEG067128",
  "mpn": "067128",
  "offers": {
    "@type": "Offer",
    "price": 18.64,
    "priceCurrency": "EUR",
    "availability": "https://schema.org/InStock"
  }
}
```

**Matching logic:** normalize ref to `[A-Z0-9]` uppercase, compare against `sku` and `mpn` fields.

**Adapter:** `src/adapters/materielelectrique.ts`

**Availability mapping:**

| Schema.org IRI | Meaning | stock value |
|---|---|---|
| `InStock` | Available | 1 |
| `LimitedAvailability` | Low stock | 1 |
| `OutOfStock` | Unavailable | 0 |
| `BackOrder` | Orderable, delayed | 0 |

---

## 8. Travail de découverte à réaliser (TODO)

Pour chaque fournisseur, investiguer et documenter les points suivants avant de coder l'adapter :

- [x] **MaterielElectrique.com** — ✅ JSON-LD parsing, no auth needed (`src/adapters/materielelectrique.ts`)
- [ ] **Rexel** — Identifier endpoint auth + endpoint prix par référence
- [ ] **Sonepar** — Identifier endpoint auth + endpoint prix par référence
- [ ] **YESSS** — Identifier endpoint auth + endpoint prix par référence
- [ ] Pour chaque site : noter les headers obligatoires, le format de référence attendu, la structure JSON de réponse

---

## 8. Development on Windows

### 8.1 DevTools Setup on Windows

```powershell
# Open Chrome DevTools (Windows shortcut)
F12

# If using Firefox
Ctrl+Shift+K  # Console
Ctrl+Shift+I  # Developer Tools (Inspector)

# Network inspection is available in both browsers under "Network" tab
```

### 8.2 Testing Adapters on Windows

```powershell
# Create a test script in PowerShell
$adapter = [YourAdapter]::new()
$result = await $adapter.authenticate("user@example.com", "password")

# Or use Node.js directly from terminal
node --version  # Verify Node is installed

# Run adapter tests
npm test -- --testPathPattern=adapters

# For debugging with VS Code
npm run debug -- adapters/rexel.js
```

### 8.3 File Paths on Windows

Always use cross-platform compatible paths:

```javascript
// ❌ WRONG — Windows-only
const tokenPath = "C:\\Users\\electrician\\prixelek\\tokens";

// ✅ CORRECT — Cross-platform
const path = require('path');
const tokenPath = path.join(process.env.USERPROFILE, 'prixelek', 'tokens');

// Store in localStorage instead (recommended for web app)
const tokenKey = `prixelek_token_${supplierId}`;
localStorage.setItem(tokenKey, token);
```

### 8.4 PowerShell Commands for Development

```powershell
# Development workflow
npm run dev                    # Start dev server
npm run build                  # Build production
npm run test                   # Run tests
npm run lint                   # Check code style

# Environment setup (Windows)
$env:NODE_ENV = "development"
$env:DEBUG = "prixelek:*"

# Clear Node cache if needed
rm -Recurse -Force node_modules
npm install

# Kill process on port 3000 if stuck
Get-Process | Where-Object { $_.Port -eq 3000 } | Stop-Process -Force
# Or better: netstat -ano | findstr :3000
```

---

*Document version 0.1 — Les endpoints réels seront complétés après investigation dans les DevTools*