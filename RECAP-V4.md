# Warehouse Lab v4 — Récapitulatif des sprints livrés

Document de synthèse : ce qui a été construit dans `warehouse-lab.html` depuis le début de la v4, sprint par sprint. Statut au **2026-08-25**.

Fichier principal : `warehouse-lab.html` (~3990 lignes, ~200 Ko de JS).
Tests automatisés : `scripts/test-boot.mjs` (13/13 assertions OK).
Serveur local : `scripts/serve.mjs`.

---

## Décision d'architecture fondatrice

**Rupture nette (option B)** : aucun fallback vers les racks Hutchinson en dur.
Le wizard de configuration est **obligatoire** au premier lancement.

- **Pourquoi** : éviter de maintenir deux codes en parallèle (dette technique).
- **Conséquence** : `warehouse-lab.html` est un produit générique config-driven. Toute organisation (Hutchinson, autre client) configure via le wizard.
- **v3 intacte** : `inventory-sheet-generator-v3.html` reste le produit stable vendable en l'état. Zéro modification en v4.

---

## Sprint 0 — Fondation config-driven

### Wizard de setup 4 étapes
Écran initial obligatoire couvrant :
1. **Société** — nom, code, email, couleur primaire (branding)
2. **Entrepôt** — zones structurées (racks × niveaux × positions) et zones plates (liste de valeurs)
3. **Colonnes SAP** — mapping des noms de colonnes attendus
4. **Options** — préférences globales

Config sauvée dans `localStorage.wlab_config_v1`.

### Service `WLAB.config` (global)
Module IIFE indépendant qui charge la config et expose :
- `isReady()` — bool
- `getStructuredZones()` / `getFlatZones()`
- `getAllRacks()` — union des racks structurés
- `classifyBin(bin)` — route un code bin vers sa zone
- `buildBinUniverse()` — génère l'univers complet des bins possibles

Émet l'événement `wlab:config-ready` après chargement.

### Boot re-processing
Listener sur `wlab:config-ready` qui :
1. Recharge les zones (`loadZonesFromConfig`)
2. Applique le branding (`applyBranding`)
3. Régénère les onglets inventaire dynamiques (`renderInvTabsAndViews`)
4. Re-processe les données SAP si session déjà chargée (`processData`)

### Autres livraisons S0
- **S0.6** — Onglets inventaire dynamiques (1 onglet par zone + OTHER, plus de MP/PF/OBD hardcodés)
- **S0.7** — Branding appliqué (nom société, couleur primaire, email dans header)
- **S0.8** — Bouton Settings pour rouvrir le wizard depuis l'app
- **S0.9** — Auto-sauvegarde de session dans `wlab_session_v1` (cap 5 Mo), restauration au boot
- **Refactor** — Renommage `state.obdData` → `state.flatData` (Map par zone), généralisation des charts dashboard aux N zones configurées

### Bug fixes S0
- `state.tabCodes` référencé avant que `state` n'existe → extrait en variable module `TAB_CODES`
- `ALL_RACKS` utilisé tantôt comme tableau, tantôt comme fonction → uniformisation
- Boot-order : si session restaurée avant `wlab:config-ready`, bins routés en OTHER → forcer `processData()` dans le listener config-ready
- Code mort `parsed.type === "flat"` (jamais true) → simplifié en `parsed.tpa !== undefined`

---

## Sprint 1 — Page Comparaison

Différence entre 2 imports SAP consécutifs (référence vs courant).

### UI
- **Sidebar** : nouvelle entrée « Comparaison » (⇆)
- **Page Import** : card « Référence » avec boutons « Définir comme référence » / « Effacer » + statut affichant date et nom du fichier baseline
- **Page Comparaison** :
  - KPIs (bins créés/supprimés/modifiés, articles créés/supprimés, delta quantité)
  - Table Bins avec filtres (all / créés / supprimés / modifiés)
  - Table Articles avec filtres (all / créés / supprimés / deltas quantité)
  - Bouton Export Excel

### Logique
- **Stockage** : `localStorage.wlab_baseline_v1` (headers + rows + mapping + signature fichier + timestamp)
- **`aggregateBaseline(base)`** — rejoue `parseBinCode` sur les lignes baseline pour reconstruire `binAgg` / `materialAgg`
- **`computeDiff(base)`** — compare aggregates baseline vs session courante
- **Rendu** : `renderCompareModule` / `renderCompareBinsTable` / `renderCompareMaterialsTable`
- **Export** : `exportCompareExcel` — workbook 2 onglets (Bins, Articles)

---

## Sprint 2 — Page Anomalies

Détection automatique de 7 incohérences dans les données SAP.

### UI
- **Sidebar** : entrée « Anomalies » (⚠)
- **Page** :
  - Synthèse (nb règles déclenchées, total anomalies)
  - KPI grid (règles critiques / warning / info / total)
  - Cards expandables par règle avec drill-down table (limité à 300 lignes)
  - Bouton Export Excel

### Les 7 règles
| ID | Sévérité | Détecte |
|---|---|---|
| `bins-not-routed` | critical | Bins présents en SAP mais hors config (routés OTHER) |
| `bins-critical` | critical | Bins avec > `ANOMALY_CRITICAL_HU` HU (défaut 50) |
| `materials-scattered` | warning | Articles présents dans > `ANOMALY_SCATTERED_THRESHOLD` bins (défaut 5) |
| `master-hu-multi-bin` | critical | Un Master HU présent dans plusieurs bins |
| `lines-no-bin` | critical | Lignes SAP sans Storage Bin |
| `materials-no-desc` | info | Articles sans description |
| `materials-null-qty` | warning | Articles à quantité nulle ou négative |

### Logique
- `detectAnomalies()` — retourne `[{id, title, severity, count, description, rows, columns, columnLabels}]`
- `anomalySeverityBadge(sev)` — pastille colorée (rouge/orange/gris)
- `renderAnomaliesModule()` — cards avec toggle expand/collapse
- `exportAnomaliesExcel()` — un onglet Excel par règle

---

## Sprint 3 — Simulateur de réagencement (LE feature signature)

Planifier virtuellement des déplacements de bins, voir l'impact, exporter une feuille de mission.

### UI
- **Sidebar** : entrée « Simulateur » (⚙)
- **Page** avec 4 blocs empilés :
  1. **Formulaire d'ajout** — bin source (avec autocomplétion `<datalist>` des bins existants), bin cible, note optionnelle, boutons « Ajouter au plan » / « Vider le plan » / « Export mission sheet »
  2. **KPIs** — Mouvements, HU déplacées, Articles impactés, Bins libérés, Bins créés
  3. **Plan de mouvements** — table numérotée avec bouton suppression par ligne
  4. **Preview d'impact** — table diff par bin (avant → après, statut LIBÉRÉ / REÇOIT / MODIFIÉ)

### Logique
- **Modèle move** : `{id, from_bin, to_bin, mode: "full", note, ts}`
  - MVP = mouvements **full uniquement** (déplacer tout le contenu d'un bin)
  - Partial deferred (nécessite UI + validation quantité/HU)
- **Persistance** : `localStorage.wlab_moveplan_v1`
- **Validation** : `simValidateBin(binRaw)` via `parseBinCode`
  - Rejet si bin invalide
  - Rejet si bin source absent des données SAP importées
  - Warning si bin routé en OTHER
  - Interdit source = cible
- **Calcul état après** : `simComputeAfter()` — applique séquentiellement les moves sur des copies (`Map<binKey, {count, materials:Set, qtySum}>`)
- **Bins impactés** : `simImpactedBins()` — union des sources + cibles
- **Statuts** :
  - `LIBÉRÉ` — bin qui avait du contenu et se vide
  - `REÇOIT` — bin vide qui reçoit du contenu
  - `MODIFIÉ` — count avant ≠ count après
- **Export** : `simExportMissionSheet()` — Excel 2 onglets
  - **Plan** : #, De, Vers, Mode, HU, Articles, Note, Fait (case vide pour cocher terrain)
  - **Preview** : Bin, HU/Articles/Qté avant/après, Statut

### CSS ajouté
`.sim-label` / `.sim-input` — style minimaliste pour le formulaire du simulateur (bordure grise, focus orange primaire).

---

## Roadmap MVP restante

- **Sprint 4** — Carte 2D interactive de l'entrepôt (fort impact démo)
- **Sprint 5** — PWA + scan caméra codes-barres (usage mobile terrain)
- **Sprint 6** — Suggestion automatique de placement (consolidation articles éclatés)

---

## Infrastructure test

### `scripts/test-boot.mjs`
Smoke test Node avec `vm.createContext` + stubs (`localStorage`, `document`, `CustomEvent`).
Extrait le script `WLAB.config` de `warehouse-lab.html` et vérifie :
- Chargement config depuis localStorage
- `isReady()` = true après reload
- Événement `wlab:config-ready` émis
- `getStructuredZones() / getFlatZones() / getAllRacks()` corrects
- `classifyBin` route bien structured et flat
- Bin hors config → `null`
- `buildBinUniverse` calcule le bon total (racks × levels × positions par zone)
- Sans config : `isReady() = false`, événement non émis, racks vides

**13/13 OK** après chaque sprint.

### `scripts/serve.mjs`
Serveur HTTP local pour tester dans le navigateur (Termux ne peut pas piloter Chrome automatiquement).

---

## Storage LocalStorage utilisé

| Clé | Rôle | Sprint |
|---|---|---|
| `wlab_config_v1` | Config wizard (zones, société, colonnes) | S0 |
| `wlab_session_v1` | Session applicative auto-sauvegardée | S0 |
| `wlab_baseline_v1` | Snapshot import référence pour comparaison | S1 |
| `wlab_moveplan_v1` | Plan de mouvements du simulateur | S3 |

---

## Historique git v4 (chronologique)

```
04f4d9f  Ignorer package.json et package-lock.json
0bf0647  Récapitulatif détaillé des sprints v4 livrés (S0 → S3)
f6b291b  Sprint 3 : Simulateur de réagencement (plan + preview + export)
007ff4e  Sprint 2 : détection d'anomalies (7 règles)
999c3fb  Sprint 1 : comparaison entre deux imports SAP
52f759f  Ajout test-boot.mjs : smoke test Node du service WLAB.config
b3d7b97  Fix : re-processer les données sur config-ready si session restaurée
0d820da  Ajout serveur HTTP local pour tests navigateur
fa496c3  Warehouse Lab : Sprint 0 fini — onglets et session config-driven
e5ed7e7  Warehouse Lab : première ébauche v4 avec setup wizard 4 étapes
```

Toutes les évolutions sur branche `main`, un sujet = un commit, messages français sobres. Tout est poussé sur `origin/main`.

---

## Configuration git

`.gitignore` couvre :
- `keys/` — clés privées ECDSA de signature de licence (jamais commit)
- `licenses/` — registre des licences émises aux clients (privé)
- `node_modules/` — dépendances npm
- `package.json` / `package-lock.json` — fichiers locaux pour dev/tests uniquement (non nécessaires au produit)
