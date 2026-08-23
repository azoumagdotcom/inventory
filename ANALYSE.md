# ANALYSE — Inventory Sheet Generator v3

> Analyse préparatoire à la création d'une **v4 globale** utilisable par toute entreprise SAP.
> Base : `inventory-sheet-generator-v3.html` (2428 lignes, monofichier HTML/CSS/JS).
> Objectif : identifier ce qui est **spécifique à Hutchinson Tanger FMS** vs ce qui est **générique** et déjà réutilisable.

---

## 1. Structure générale de l'app

### Pages / modules (sidebar `inventory-sheet-generator-v3.html:553-562`)

1. **Dashboard** — KPI + graphiques Chart.js + heatmap racks
2. **Import SAP** — Drag-drop XLSX/CSV, auto-détection colonnes + mapping manuel
3. **Feuilles d'Inventaire** — Éditeur tableau MP / PF / OBD / AUTRES
4. **Codes-barres** — Générateur unitaire + génération de masse (Code128, Code39, EAN13, QR)
5. **Gestion des Bins** — Créateur combinatoire rack × niveau × position
6. **Analyse HU** — Détection orphelines / sans batch / sans bin / doublons
7. **Analyse Batchs** — Dispersion / doublons / sans HU
8. **Écarts Inventaire** — Saisie terrain vs SAP, calcul d'écart
9. **Rapport** — Synthèse auto + recommandations + export PDF
10. **Historique** — Imports et rapports (50 derniers, persistés localStorage)

### Modèle de données (`:995-1005`)

```javascript
var state = {
  headers, rows,                       // brutes XLSX
  mapping: { bin, material, quantity, batch, highestLevelHu, hu, description },
  fileName, fileSignature,
  allLines, linesWithoutBin,           // parsé
  binIndex, materialIndex,             // Map lookup
  binAgg, materialAgg, obdData,        // agrégations
  gapCounts: {},                       // bin -> compté (persist localStorage)
  activeInvTab: "MP"
};
```

### Stockage localStorage

| Clé | Contenu |
|---|---|
| `azoumag_theme` | `"dark"` ou `"light"` |
| `azoumag_license_v3` | Clé de licence signée ECDSA |
| `azoumag_gap_counts_<fileSignature>` | JSON des comptages terrain |
| `azoumag_history_imports` | 50 derniers imports |
| `azoumag_history_reports` | 50 derniers rapports |

### Dépendances externes (CDN, `:7-12`)

- **XLSX** 0.18.5 — lecture/écriture Excel
- **html2pdf** 0.10.1 — export PDF
- **Chart.js** 4.4.4 — graphiques
- **JsBarcode** 3.11.6 — codes-barres
- **QRCode** 1.0.0 — QR codes (**déjà présent !**)
- **JSZip** 3.10.1 — export ZIP

---

## 2. Éléments SPÉCIFIQUES à Hutchinson Tanger FMS

> **Bonne nouvelle** : le mot "Hutchinson", "Tanger", "FMS", "HTF" **n'apparaît nulle part dans le code**. L'app est déjà brandée uniquement AZOUMAG. Le seul vrai hardcode métier est la **structure des bins**.

### 2.1 Structure des bins (le VRAI point spécifique) — `:961-969`

```javascript
var MP_RACKS = ["A","B0","B1","C0","C1","D0","D1","E0","E1","F0","F1","G0","G1","H0","H1","I"];
var MP_LEVELS = [4,3,2,1,0];
var MP_POSITIONS = 15;

var PF_RACKS = ["J","K0","K1","L0","L1","M0","M1","N"];
var PF_LEVELS = [3,2,1,0];
var PF_POSITIONS = 21;

var OBD_TPA = ["TPA1","TPA2","TPA3","TPA4","TPA5","TPA6"];
```

- **Format bin figé** : `RACK-NIVEAU-POSITION` (ex : `A-0-1`, `K1-3-21`)
- **Séparateur `-` codé en dur** dans `parseBinCode()` (`:1238`)
- **3 sections métier fixes** : MP (Matières Premières), PF (Produits Finis), OBD/TPA (zones mobiles)
- **Validation stricte** (`:1242-1246`) : tout bin qui ne match pas MP/PF est catalogué `OTHER`

### 2.2 Nomenclature métier

- Sections `MP` / `PF` / `OBD` / `TPA` / `AUTRES` — vocabulaire industrie/logistique française
- Étiquettes UI : "Matières Premières", "Produits Finis", "TPA / OBD"

### 2.3 Branding & contact

- Titre : `AZOUMAG INVENTORY SUITE PRO V3` (`:6, 548-549`)
- Footer : `AZOUMAG © 2026 — The Ultimate Online Solutions` (`:573-575`)
- Email support en dur : `azoumagomar56@gmail.com` (`:370`)
- Produit licence : `AZOUMAG-INV-V3` (`:380`)
- Couleurs : orange `#F37021`, navy `#1D2240` (`:29, 38, 72`)

### 2.4 Rapport auto — recommandations en dur (`:2307-2331`)

Textes hardcodés en français référençant "HU orphelines", "batchs dispersés", etc. Vocabulaire SAP + français industrie ancré dans le code.

### 2.5 Noms de fichiers d'export

Toujours préfixés `AZOUMAG_` (ex : `AZOUMAG_Inventaire_Complet.xlsx`) — aucun suffixe client.

---

## 3. Éléments GÉNÉRIQUES réutilisables tels quels

### 3.1 Import SAP intelligent (`:1114-1206`)

- Auto-détection colonnes via `COLUMN_KEYWORDS` (`:979-987`) — anglais + français
- Mapping manuel avec UI dropdown si détection partielle
- Preview 10 lignes avant confirmation
- Gestion Excel (XLSX) + CSV

**Colonnes attendues** (déjà génériques SAP) :
`Storage Bin` · `Material` · `Quantity` · `Batch` · `HU` · `Highest Level HU` · `Description` (optionnel)

### 3.2 Gate de licence ECDSA (`:376-538`)

Totalement générique. Déjà découplé métier. À conserver tel quel pour v4.

### 3.3 UI shell (`:24-252`)

- Sidebar sticky responsive
- Topbar sticky + recherche globale
- Dark mode persistant
- Menu hamburger mobile
- FOUC-safe (app cachée jusqu'à activation licence)

### 3.4 Moteur d'export

- **Excel** multi-feuilles via `XLSX.utils.book_*`
- **PDF** via `html2pdf` (A4 portrait/landscape)
- **ZIP** d'images via `JSZip`
- **Print** browser natif

### 3.5 Recherche globale (`:1815-1849`)

Cherche en parallèle : Material, Description, Batch, HU, Highest Level HU, Bin. Max 24 résultats + navigation automatique.

### 3.6 Parsing nombres FR/US (`:1015-1032`)

Gère les deux formats : `1.234,56` (EU) et `1,234.56` (US). Auto-détection.

### 3.7 Analyses HU & Batchs (`:2011-2159`)

Logique 100 % SAP-générique : détection anomalies structurelles, pas de règle métier Hutchinson.

---

## 4. Fonctionnalités présentes (liste exhaustive)

| # | Fonction | Ligne | Notes |
|---|---|---|---|
| 1 | Import XLSX/CSV drag-drop | 1114 | Auto-détection colonnes |
| 2 | Mapping manuel colonnes | 1156 | Dropdown par champ requis |
| 3 | Preview 10 lignes | 1197 | Avant confirmation |
| 4 | Parse bin (validation) | 1233 | MP/PF/OBD/OTHER |
| 5 | Agrégation par bin | 1298 | count/materials/batches/masterHus/qtySum |
| 6 | Agrégation par article | — | bins/count/batches/qtySum |
| 7 | Dashboard 12 KPI | 1384 | Total bins, matériaux, HU, batchs, etc. |
| 8 | 8 graphiques Chart.js | 1421 | Répartition rack, section, conformité, top articles… |
| 9 | Heatmap racks | 1510 | Couleur par densité HU |
| 10 | Inventaire MP/PF paginé | 1541 | Rack par page |
| 11 | Inventaire OBD/TPA | 1567 | Table simple |
| 12 | Inventaire AUTRES | 1591 | Hors structure |
| 13 | Export Excel inventaire | 1801 | Multi-colonnes |
| 14 | Export PDF inventaire | 1785 | Par section active |
| 15 | Recherche Bin | 1685 | Autocomplete + modal |
| 16 | Recherche Article | 1705 | Autocomplete + modal |
| 17 | Recherche Rack | 1748 | Grille visuelle |
| 18 | Détails Bin (modal) | 1713 | KPI + lignes SAP |
| 19 | Détails Article (modal) | 1734 | KPI + distribution |
| 20 | Codes-barres unitaires | 1854 | Code128/39, EAN13, QR + PNG |
| 21 | Codes-barres en masse | 1926 | ZIP ou PDF |
| 22 | Générateur de bins | 1966 | Combinatoire → Excel |
| 23 | Analyse HU (4 types) | 2011 | Orphelines/sans batch/sans bin/doublons |
| 24 | Export HU (4 sheets) | 2065 | Excel |
| 25 | Analyse Batchs (3 types) | 2080 | Dispersés/dupliqués/sans HU |
| 26 | Export Batchs (4 sheets) | 2151 | Excel |
| 27 | Écarts inventaire | 2169 | Saisie terrain + calcul écart |
| 28 | Rapport auto + PDF | 2299 | KPI + recommandations |
| 29 | Historique imports | 2353 | Max 50 |
| 30 | Historique rapports | 2358 | Max 50 |
| 31 | Effacement données | 2390 | Purge `azoumag_*` |
| 32 | Reset app | 2402 | Nouveau fichier |
| 33 | Dark mode | 1094 | Persistant |
| 34 | Licence gate ECDSA | 376 | Vérif au démarrage |

**Total : 34 fonctionnalités identifiées.**

---

## 5. Points de friction pour la globalisation

### 5.1 Structure bin trop rigide

- `parseBinCode()` (`:1233`) suppose `RACK-NIVEAU-POSITION` avec `-` — casse si client utilise `A.1.15`, `Z01A15`, ou 4 niveaux hiérarchiques (`ZONE-ALLÉE-RANG-CASE`)
- `MP_LEVELS = [4,3,2,1,0]` numérique — cassera si niveaux alphabétiques (A/B/C) ou > 10

### 5.2 Sections métier hardcodées

- Impossible pour un client Decathlon ou Airbus d'utiliser sa propre taxonomie (`ZONE_A`, `ATELIER_1`, `QUAI_EXPORT`…)
- La logique "MP" vs "PF" vs "OTHER" est enfouie dans `parseBinCode()` — pas de config externe

### 5.3 Rapport auto figé (`:2307-2331`)

Textes de recommandations écrits en clair français, vocabulaire caoutchouc/automotive Hutchinson. À sortir dans un template éditable.

### 5.4 Aucun fichier de config

- Zéro `config.json`, zéro variable d'env, zéro paramètre URL
- Tout hardcode dans une IIFE (`:955`) → obligé de patcher le HTML pour customiser

### 5.5 Pas d'i18n

- Tous les labels UI en français
- Nomenclature SAP anglaise mélangée aux libellés FR
- Cible v4 : au minimum `fr` + `en`, prévoir `es` / `de` pour SAP Europe

### 5.6 Noms d'export préfixés AZOUMAG

À paramétrer par nom de société client.

### 5.7 QR codes déjà chargés mais peu exploités

`qrcodejs` est déjà en CDN. Utilisé uniquement dans le générateur unitaire. **Opportunité v4** : génération QR en masse pour tous les bins d'un inventaire.

---

## 6. Recommandations d'architecture pour la v4 globale

### 6.1 Externaliser TOUT le métier dans `config.json`

```json
{
  "company": {
    "name": "Hutchinson Tanger FMS",
    "code": "HTF",
    "email": "inventory@example.com",
    "logo_url": "logo.png"
  },
  "bin_structure": {
    "separator": "-",
    "levels_order": ["rack", "level", "position"],
    "sections": [
      {
        "code": "MP",
        "label": "Matières Premières",
        "racks": ["A","B0","B1","C0","C1"],
        "level_values": [4,3,2,1,0],
        "position_range": [1, 15]
      },
      {
        "code": "PF",
        "label": "Produits Finis",
        "racks": ["J","K0","K1"],
        "level_values": [3,2,1,0],
        "position_range": [1, 21]
      },
      {
        "code": "OBD",
        "label": "Zones mobiles",
        "type": "flat",
        "values": ["TPA1","TPA2","TPA3","TPA4","TPA5","TPA6"]
      }
    ]
  },
  "sap_columns": {
    "bin": ["storage bin","lgpla","bin"],
    "material": ["material","article","product"],
    "quantity": ["available stock","qty","stock"],
    "batch": ["batch","lot"],
    "hu": ["handling unit","hu"],
    "highest_level_hu": ["parent hu","master hu"],
    "description": ["description","desc"]
  },
  "display": {
    "language": "fr",
    "decimal_separator": ",",
    "thousands_separator": ".",
    "date_format": "DD/MM/YYYY",
    "theme_primary": "#F37021",
    "theme_secondary": "#1D2240"
  },
  "features": {
    "enable_qr_mass": true,
    "enable_barcodes": true,
    "enable_heatmap": true,
    "auto_save_interval_ms": 30000,
    "history_max_items": 50
  },
  "report": {
    "title": "RAPPORT D'INVENTAIRE",
    "include_recommendations": true,
    "custom_kpis": []
  }
}
```

### 6.2 Loader dynamique au démarrage

```javascript
async function loadConfig() {
  const res = await fetch('./config.json');
  if (!res.ok) throw new Error('config.json manquant');
  return res.json();
}
// Puis substituer :
//   MP_RACKS      -> config.bin_structure.sections.find(s=>s.code==='MP').racks
//   COLUMN_KEYWORDS -> config.sap_columns
//   theme colors  -> config.display.theme_*
```

### 6.3 Auto-sauvegarde localStorage (NOUVEAU)

- `setInterval(persistState, config.features.auto_save_interval_ms)` toutes les 30 s
- Sauvegarder : `state.gapCounts`, `state.activeTab`, `state.mapping`
- Charger au démarrage : `restoreState()` avant `refreshAllModules()`
- Badge UI discret : "Sauvegardé à 14h32 ✓" (coin bas droit)

### 6.4 QR codes en masse (NOUVEAU)

- Ajouter bouton **"Générer QR pour chaque Bin"** dans page Codes-barres
- Output : PDF paginé (1 QR + label bin par vignette) ou ZIP PNG
- Réutiliser `QRCode` (`:11`) déjà chargé

### 6.5 Page Settings (NOUVEAU)

- UI formulaire pour éditer `config.json` sans toucher au JSON à la main
- Preview live du JSON généré
- Bouton "Télécharger config.json"

### 6.6 i18n minimal

- Dossier `i18n/fr.json`, `i18n/en.json`
- Fonction `t(key)` qui remplace tous les strings UI en dur

### 6.7 Packaging livrable

```
inventory-v4/
├── index.html              (monofile, générique)
├── config.json             (pré-rempli pour ce client)
├── config-template.json    (documentation modèle vide)
├── i18n/
│   ├── fr.json
│   └── en.json
├── logo.png                (optionnel, du client)
└── LICENCE.txt
```

### 6.8 Migration Hutchinson → v4

1. Créer `config-hutchinson.json` avec racks A-I / J-N actuels
2. Livrer v4 + ce config au client Hutchinson
3. Comportement identique à v3, mais code désormais générique
4. Pour Client B (ex : Decathlon) : nouveau `config-decathlon.json`, même binaire

---

## Résumé exécutif

**L'app v3 est déjà ~95 % générique.** Le seul vrai hardcode métier est **la structure des bins Hutchinson** (racks A-N, niveaux 0-4, positions 1-21). Tout le reste (dashboard, exports, analyses HU/Batchs, UI, licence) fonctionne pour n'importe quel client SAP.

### Roadmap v4 conseillée

1. **[Priorité 1]** Externaliser bins dans `config.json` + loader
2. **[Priorité 1]** Externaliser `sap_columns` et branding dans même config
3. **[Priorité 2]** Auto-save localStorage toutes les 30 s + UI badge
4. **[Priorité 2]** QR codes en masse (utilise lib déjà chargée)
5. **[Priorité 3]** Page Settings pour éditer config en UI
6. **[Priorité 3]** i18n minimal (`fr` + `en`)
7. **[Test]** Valider avec 3 configs différentes (Hutchinson + 2 fictifs)

**Effort estimé** : 3-5 jours de dev focalisé pour une v4 fonctionnelle + testable.
