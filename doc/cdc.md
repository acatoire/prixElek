# Cahier des Charges
> Outil métier pour électriciens indépendants · Application web · Architecture modulaire

---

## 1. Contexte & Objectifs

### 1.1 Contexte

Un électricien indépendant travaille quotidiennement avec plusieurs fournisseurs (grossistes électricité, distributeurs spécialisés) et doit jongler entre des catalogues volumineux, des tarifs variables et des remises négociées propres à chaque compte. Aujourd'hui, la comparaison de prix est souvent manuelle, chronophage, et source d'erreurs.

**Déter** est une application web légère, pensée pour être utilisée seul depuis un navigateur, qui centralise ces problématiques en commençant par le sujet le plus immédiat : la comparaison de prix du matériel.

### 1.2 Objectifs généraux

- Gagner du temps sur la recherche et la comparaison de prix fournisseurs
- Réduire les erreurs de commande en ayant une vue claire du matériel et de ses références
- Poser les bases d'un outil métier évolutif, adapté à la réalité terrain de l'artisan électricien

---

## 2. Utilisateurs cibles

| Profil | Description |
|---|---|
| **Électricien indépendant** | Utilisateur unique, artisan, travaille seul ou avec 1-2 compagnons. Pas forcément à l'aise avec des outils complexes. A besoin d'efficacité et de rapidité. |

L'application est mono-utilisateur dans un premier temps. La notion de compte, d'authentification multi-utilisateurs ou de partage n'est pas dans le périmètre de la v1.

---

## 3. Plateforme & Contraintes techniques

- **Type** : Application web, accessible depuis un navigateur desktop (Chrome, Firefox, Edge)
- **Hébergement** : Local ou hébergement simple (pas de serveur complexe en v1)
- **Données** : Fichiers JSON locaux en v1, potentiellement migrables vers une base de données légère (SQLite, IndexedDB) en v2
- **Connectivité** : L'application doit idéalement fonctionner offline pour les fonctions de base (consultation catalogue, panier), et en ligne pour les appels API fournisseurs
- **Technologies suggérées** : React ou Vue.js côté front, Node.js ou Python (FastAPI) côté back si nécessaire pour les appels API fournisseurs

---

## 4. Architecture — Approche modulaire

L'application est construite autour d'une **architecture modulaire par plugins**. Chaque module est indépendant, activable/désactivable, et communique avec le reste de l'application via une interface commune.

### 4.1 Principes architecturaux

- **Découplage** : Chaque module expose une interface standard (entrées/sorties définies)
- **Extensibilité** : Un nouveau module peut être ajouté sans modifier le cœur de l'application
- **Partage de données** : Un contexte applicatif central (catalogue matériel, fournisseurs configurés) est accessible à tous les modules
- **Navigation** : Menu latéral ou barre de navigation avec les modules actifs

### 4.2 Modules prévus

| Module | Statut | Description courte |
|---|---|---|
| **Comparateur de prix** | ✅ V1 — prioritaire | Consulter et comparer les prix du matériel courant chez plusieurs fournisseurs |
| **Panier comparatif** | ✅ V1 — phase 2 | Composer un panier, comparer son coût total entre fournisseurs |
| **Édition de devis** | 🔜 V2 | Générer un devis client à partir d'une sélection de matériel |
| **Demande de remise fournisseur** | 🔜 V2 | Générer automatiquement une demande d'ajustement de prix vers un fournisseur |

---

#### 4.2.1 Module 1 — Comparateur de prix
[Page dédiéz](cdc-m1.md)

#### 4.2.2  Module 2 — Édition de devis *(V2, à affiner)*
[Page dédiéz](cdc-m2.md)

#### 4.2.3  Module 3 — Demande de remise fournisseur *(V2, à affiner)*
[Page dédiéz](cdc-m3.md)

## 8. Gestion des données

### 8.1 Fichiers de configuration (v1)

| Fichier | Rôle | Édition |
|---|---|---|
| `catalogue.json` | Liste du matériel suivi | Manuelle (éditeur texte ou future IHM) |
| `fournisseurs.json` | Fournisseurs et credentials API | Manuelle |

### 8.2 Évolutions futures

- Interface d'administration dans l'app pour modifier le catalogue sans toucher au JSON
- Import/export CSV du catalogue
- Historique des prix (avec courbe d'évolution)
- Base de données locale (SQLite via Electron, ou IndexedDB) pour les paniers sauvegardés et l'historique

---

## 9. Expérience utilisateur

### 9.1 Principes directeurs

- **Rapidité** : L'info clé (meilleur prix) doit être visible en moins de 3 secondes
- **Simplicité** : Pas d'onboarding complexe, l'utilisateur configure ses fichiers JSON une fois et l'app fonctionne
- **Résilience** : Si un fournisseur ne répond pas, afficher une erreur claire sur la colonne concernée sans bloquer le reste

### 9.2 États à gérer dans l'interface

| État | Affichage attendu |
|---|---|
| Chargement des prix en cours | Spinner par colonne fournisseur |
| Prix récupéré | Prix affiché avec horodatage |
| API fournisseur en erreur | "Indisponible" + icône d'avertissement |
| Article non référencé chez ce fournisseur | "—" ou "Non référencé" |
| Aucun fournisseur configuré | Message d'aide avec lien vers la configuration |

---

## 10. Roadmap & Phases de développement

```
Phase 1 — MVP Comparateur
│
├── Chargement du catalogue depuis catalogue.json
├── Appel API multi-fournisseurs (ou saisie manuelle en fallback)
├── Affichage tableau comparatif avec mise en évidence du meilleur prix
└── Filtres basiques (catégorie, marque) + recherche

Phase 2 — Panier comparatif
│
├── Sélection d'articles avec quantités
├── Vue panier avec totaux par fournisseur
└── Export basique (CSV / impression)

Phase 3 — Modules V2
│
├── Module Devis (édition + PDF)
└── Module Demande de remise fournisseur
```

---

## 11. Points ouverts & Décisions à prendre

| # | Question | Impact |
|---|---|---|
| 1 | Les fournisseurs visés (Rexel, Sonepar, Cédéo…) disposent-ils d'APIs accessibles aux comptes clients ? | Critique pour la Phase 1 automatisée |
| 2 | En l'absence d'API, accepte-t-on un mode de saisie/import manuel des prix ? | Conditionne le périmètre du MVP |
| 3 | Faut-il gérer les remises négociées par compte (prix net vs prix catalogue) ? | Complexifie les appels API |
| 4 | L'application tourne-t-elle en local (Electron) ou est-elle hébergée ? | Impact sur la gestion des tokens API et la sécurité |
| 5 | Interface d'édition du catalogue dans l'app dès la v1, ou fichier JSON suffit ? | Scope UX |

---

*Document version 0.1 — à réviser après validation des points ouverts*
