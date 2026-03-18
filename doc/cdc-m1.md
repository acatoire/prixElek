#  Module 1 — Comparateur de prix

## 1 Description générale

Ce module permet à l'électricien de consulter en un coup d'œil les prix de son matériel courant chez tous ses fournisseurs, et de les comparer côte à côte.

## 2 Catalogue matériel (fichier JSON)

Le catalogue est maintenu manuellement par l'utilisateur dans un fichier `catalogue.json`. C'est la source de vérité pour la liste du matériel suivi.

### Structure du fichier `catalogue.json`

```json
{
  "materiaux": [
    {
      "id": "prise-2p-t-legrand",
      "nom": "Prise 2P+T",
      "marque": "Legrand",
      "categorie": "Appareillage",
      "references_fournisseurs": {
        "rexel": "LEG-050430",
        "sonepar": "LG050430",
        "cedeo": "REF-CEDEO-4421"
      }
    },
    {
      "id": "interrupteur-va-et-vient-schneider",
      "nom": "Interrupteur va-et-vient",
      "marque": "Schneider",
      "categorie": "Appareillage",
      "references_fournisseurs": {
        "rexel": "SCH-CCT15262",
        "sonepar": "SN-CCT15262",
        "cedeo": null
      }
    }
  ]
}
```

**Champs :**
- `id` : identifiant unique interne (slug)
- `nom` : libellé lisible
- `marque` : marque du produit
- `categorie` : catégorie libre (pour filtrage futur)
- `references_fournisseurs` : objet clé/valeur, une entrée par fournisseur configuré (valeur `null` si non référencé chez ce fournisseur)

### 3 Configuration des fournisseurs

Les fournisseurs sont configurés dans un fichier `fournisseurs.json` séparé.

### Structure de `fournisseurs.json`

```json
{
  "fournisseurs": [
    {
      "id": "rexel",
      "nom": "Rexel",
      "couleur": "#E30613",
      "api": {
        "type": "rest",
        "base_url": "https://api.rexel.fr/v1",
        "auth": "bearer",
        "token": "MON_TOKEN_REXEL"
      }
    },
    {
      "id": "sonepar",
      "nom": "Sonepar",
      "couleur": "#0066CC",
      "api": {
        "type": "rest",
        "base_url": "https://api.sonepar.fr/v2",
        "auth": "api_key",
        "token": "MON_TOKEN_SONEPAR"
      }
    },
    {
      "id": "cedeo",
      "nom": "Cédéo",
      "couleur": "#FF6600",
      "api": {
        "type": "rest",
        "base_url": "https://api.cedeo.fr",
        "auth": "bearer",
        "token": "MON_TOKEN_CEDEO"
      }
    }
  ]
}
```

> **Note v1** : Si aucune API fournisseur n'est disponible (accès restreint, absence d'API publique), prévoir un mode de **saisie manuelle des prix** avec horodatage de la dernière mise à jour, comme fallback.

## 4 Phase 1 — Vue catalogue comparatif

### Fonctionnalités

- **Chargement** : Au lancement du module, l'application interroge l'API de chaque fournisseur configuré pour récupérer le prix de chaque article du catalogue
- **Affichage** : Tableau avec une ligne par article, une colonne par fournisseur + colonne "meilleur prix"
- **Indicateurs visuels** :
  - 🟢 Meilleur prix mis en évidence
  - 🔴 Prix manquant ou article non référencé chez ce fournisseur
  - ⏱️ Horodatage de la dernière récupération des prix
- **Rafraîchissement** : Bouton "Actualiser les prix" pour relancer tous les appels API
- **Filtres** : Filtrer par catégorie, par marque
- **Recherche** : Barre de recherche sur le nom ou la marque

#### Maquette fonctionnelle (vue tableau)

```
┌────────────────────────────────┬──────────┬──────────┬──────────┬────────────┐
│ Matériel                       │ Rexel    │ Sonepar  │ Cédéo    │ Meilleur   │
├────────────────────────────────┼──────────┼──────────┼──────────┼────────────┤
│ Prise 2P+T — Legrand           │  4,20 €  │ 🟢 3,85€ │  4,10 €  │ Sonepar    │
│ Interrupteur V-V — Schneider   │ 🟢 2,95€ │  3,20 €  │  —       │ Rexel      │
│ Disjoncteur 20A — Hager        │  8,40 €  │  8,40 €  │ 🟢 7,90€ │ Cédéo      │
└────────────────────────────────┴──────────┴──────────┴──────────┴────────────┘
                                               ⏱️ Prix mis à jour il y a 3 min
```

## Phase 2 — Panier comparatif

#### Fonctionnalités

- **Sélection** : Depuis le tableau catalogue, l'utilisateur coche les articles qu'il souhaite comparer (avec quantité)
- **Vue panier** : Page ou panneau latéral affichant :
  - Liste des articles sélectionnés avec quantité
  - Pour chaque article : prix unitaire chez chaque fournisseur × quantité
  - **Total du panier** par fournisseur
  - Mise en évidence du fournisseur le moins cher sur le total
- **Interactions** :
  - Modifier la quantité d'un article directement dans le panier
  - Retirer un article du panier
  - Réinitialiser le panier
  - Exporter le panier (CSV ou impression) — optionnel v1

### Maquette fonctionnelle (vue panier)

```
PANIER — 3 articles
─────────────────────────────────────────────────────────────────
Article                  Qté   Rexel      Sonepar    Cédéo
─────────────────────────────────────────────────────────────────
Prise 2P+T Legrand        10   42,00 €   🟢 38,50€   41,00 €
Interrupteur V-V Sch.      5   14,75 €    16,00 €     —
Disjoncteur 20A Hager      3   25,20 €    25,20 €   🟢 23,70€
─────────────────────────────────────────────────────────────────
TOTAL                         81,95 €   🏆 79,70€   64,70€*
─────────────────────────────────────────────────────────────────
* Cédéo ne référence pas l'interrupteur — total partiel
```
