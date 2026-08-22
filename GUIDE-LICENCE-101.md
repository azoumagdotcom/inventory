# AZOUMAG · Guide de Licence 101

**Comment créer et envoyer une clé de licence à un client — de A à Z, expliqué simplement.**

---

## 🎯 En 30 secondes

Un client vous envoie un email et vous demande une licence ? Voici les 3 commandes à retenir :

```bash
cd ~/repos/inventory
node scripts/generate-license.mjs "Nom Du Client SARL"
# → copiez la ligne AZMG-… et envoyez-la par email
```

C'est tout. Le reste de ce guide explique **pourquoi** et **quoi faire si ça se passe mal**.

---

## 📚 Partie 1 — Comprendre le système

### Qui est qui ?

| Rôle | Vous | Le client |
|---|---|---|
| Nom | **AZOUMAG** (le vendeur) | Le client final |
| Possède | La **clé privée** (`keys/private.pem`) | Une **clé de licence** (`AZMG-…`) |
| Peut faire | Créer des licences pour n'importe qui | Utiliser l'application |
| Doit protéger | La clé privée à tout prix | Sa clé de licence (mais elle est ré-émettable) |

### Comment ça marche ?

1. Le fichier `inventory-sheet-generator-v3.html` contient une **clé publique** (visible par tous).
2. Vous avez la **clé privée** correspondante dans `keys/private.pem` (secrète, sur votre PC seulement).
3. Quand vous créez une licence, vous **signez** un petit message (nom du client + produit + date) avec votre clé privée.
4. Le client colle la licence dans l'application. Le navigateur vérifie la signature avec la clé publique.
5. Si la signature est valide → l'application s'ouvre. Sinon → refusée.

**Pourquoi c'est solide :** personne d'autre que vous ne peut créer une licence valide, même en lisant le code source du fichier HTML. La clé publique permet uniquement de **vérifier**, jamais de **créer**.

---

## 🔒 Partie 2 — Protéger votre clé privée

Votre fichier `keys/private.pem` est **le trésor**. Si vous le perdez :
- ✅ Les clients existants gardent leurs licences (elles marchent toujours).
- ❌ Vous ne pouvez plus jamais créer de nouvelles licences.
- ❌ Récupération = tout recommencer : nouvelle paire de clés, nouveau HTML, nouvelles licences pour tous les clients.

Si quelqu'un **vole** votre clé privée :
- ❌ Il peut créer autant de fausses licences qu'il veut.
- ❌ Vous êtes obligé de tout recommencer (nouvelle paire, nouveau HTML, nouvelles clés pour tous).

### ✅ À faire MAINTENANT (avant de vendre la première licence)

- [ ] Copier `keys/private.pem` sur une **clé USB chiffrée** (rangée en lieu sûr)
- [ ] Copier dans un **gestionnaire de mots de passe** (Bitwarden, 1Password) en note sécurisée
- [ ] Copier dans un **cloud privé** (dossier privé Google Drive, ProtonDrive)
- [ ] Vérifier que `.gitignore` bloque bien le dossier `keys/` (déjà fait ✅)

### ❌ À NE JAMAIS faire

- Envoyer `keys/private.pem` par email
- Le coller dans WhatsApp, Slack, Discord, un chat
- Le mettre sur un cloud public (Dropbox partagé, Google Drive public)
- Le commiter sur Git / GitHub
- Le laisser sur un PC partagé sans mot de passe

---

## 📧 Partie 3 — Le workflow standard (à chaque client)

### Étape 1 · Recevoir la demande

Un client vous envoie un email du style :
> Bonjour, nous souhaitons acquérir une licence AZOUMAG Inventory Suite v3 pour notre entrepôt. Merci de nous transmettre les modalités.

**Ce dont vous avez besoin de savoir :**
- ✅ Le **nom exact** à mettre dans la licence (nom de société, ou nom d'une personne, ou nom d'un site).
- ✅ Confirmation du paiement (facture réglée, virement reçu, etc.).
- ✅ L'adresse email pour envoyer la clé.

### Étape 2 · Choisir le nom du client — attention !

Le nom que vous mettez dans la licence est **inscrit à vie** dans la clé. Il s'affiche dans la barre latérale de l'application chez le client. **Vous ne pouvez pas le modifier après**, il faudra créer une nouvelle clé si erreur.

**Conventions recommandées :**

| Type de client | Format du nom |
|---|---|
| Entreprise | `Acme Logistique SARL` (nom légal complet) |
| Individu | `Jean Dupont` |
| Département | `Acme SARL — Équipe Entrepôt` |
| Plusieurs sites | `Acme SARL — Site Casablanca` (une clé par site) |

**Astuces :**
- Écrivez exactement ce que le client veut voir affiché (attention aux fautes de frappe).
- Ajoutez le site/ville si le client déploie sur plusieurs entrepôts (ça vous aide à tracer).
- Les accents (é, è, à, ç…) et caractères spéciaux (`&`, apostrophes) sont supportés.

### Étape 3 · Créer la clé

Ouvrez un terminal :

```bash
cd ~/repos/inventory
node scripts/generate-license.mjs "Acme Logistique SARL"
```

Le résultat :
```
License key for: Acme Logistique SARL
────────────────────────────────────────────────────────────────
AZMG-eyJjIjoiQWNtZSBMb2dpc3RpcXVlIFNBUkwi…7mro5tw1zWa2…T9Lxhw
────────────────────────────────────────────────────────────────
✓ Saved to registry: licenses/registry.csv
✓ Saved to file:     licenses/acme-logistique-sarl-20260822-143012.txt

Send this key to the customer. They paste it into the activation gate.
```

📋 **Copiez TOUTE la ligne `AZMG-…`** — c'est une seule ligne continue, sans espaces, sans retour à la ligne.

💾 **La clé est automatiquement enregistrée** dans votre registre privé (dossier `licenses/`, git-ignoré, permissions propriétaire seulement). Voir Étape 5 pour la consulter.

### Étape 4 · Vérifier avant d'envoyer (fortement recommandé)

Avant d'envoyer, vérifiez que la clé est bien valide et que le nom est correct :

```bash
node scripts/generate-license.mjs --verify "AZMG-eyJj…T9Lxhw"
```

Résultat attendu :
```
✓ Valid license
  Customer: Acme Logistique SARL
  Product:  AZOUMAG-INV-V3
  Issued:   2026-08-22
```

Si le nom a une faute de frappe → recréez la clé **avant** d'envoyer. Impossible de "rappeler" une clé envoyée.

### Étape 5 · Consulter et gérer votre registre

Chaque clé émise est **automatiquement enregistrée** dans le dossier `licenses/` (git-ignoré, permissions 700/600 = vous seul y avez accès).

Deux fichiers sont créés par mint :
- `licenses/registry.csv` — registre principal (une ligne ajoutée par clé)
- `licenses/<slug>-<horodatage>.txt` — copie individuelle de chaque licence (facile à ré-envoyer par email)

**Voir toutes les licences émises :**
```bash
node scripts/generate-license.mjs --list
```

Affichage :
```
Registre des licences (3 entrées) — licenses/registry.csv
──────────────────────────────────────────────────────────
  1. 2026-08-22 14:30:12  │  Acme Logistique SARL
     AZMG-eyJjIjoiQW…T9Lxhw
  2. 2026-08-25 09:15:44  │  Beta Warehouse BV
     AZMG-eyJjIjoiQm…xK2mQpq
  3. 2026-08-30 16:02:33  │  Gamma Storage Inc
     AZMG-eyJjIjoiR2…LmnRt5s
──────────────────────────────────────────────────────────
Total : 3 licences
```

Ajoutez `--full` pour voir les clés complètes (utile pour copier-coller).

**Chercher une licence par nom client :**
```bash
node scripts/generate-license.mjs --find "acme"
```

Cherche dans tous les noms (insensible à la casse, correspondance partielle). Utile si un client vous redemande sa clé.

**Suivi commercial complémentaire (recommandé) :** le registre stocke uniquement les données techniques (date, nom, clé). Pour le suivi commercial (email, montant, facture…), tenez à côté un fichier `~/azoumag-ventes.txt` :

```
DATE       | NOM CLIENT                       | EMAIL               | STATUT     | NOTES
-----------|----------------------------------|---------------------|------------|------------
2026-08-22 | Acme Logistique SARL             | dg@acme.ma          | payé 500€  | facture 001
2026-08-25 | Beta Warehouse BV                | ops@beta.nl         | payé 300€  | facture 002
```

Sauvegardez le dossier `licenses/` régulièrement (clé USB chiffrée, cloud privé) — c'est votre seul historique.

### Étape 6 · Envoyer l'email au client

**Modèle d'email prêt à copier :**

```
À :       client@entreprise.com
Objet :   Votre licence AZOUMAG Inventory Suite v3 — [Nom Société]

Bonjour [Prénom],

Merci pour votre commande. Voici les deux éléments nécessaires pour
utiliser AZOUMAG Inventory Suite v3 :

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  1. L'APPLICATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Fichier joint : inventory-sheet-generator-v3.html (137 Ko)

Double-cliquez pour l'ouvrir — l'application se lance dans votre
navigateur (Chrome, Edge, Firefox ou Safari). Aucune installation.
Aucun serveur. Vos données ne quittent jamais votre navigateur.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  2. VOTRE CLÉ DE LICENCE (perpétuelle — à conserver précieusement)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

AZMG-eyJjIjoi…T9Lxhw

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  3. ACTIVATION (30 secondes)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. Ouvrez le fichier HTML dans votre navigateur.
2. Un écran d'activation orange apparaît.
3. Copiez-collez la clé ci-dessus dans le champ.
4. Cliquez sur « Activer ».
5. Le nom « [Nom Société] » s'affiche en bas de la barre latérale.

C'est fait. L'activation est une opération unique par navigateur.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Guide utilisateur et support sur simple demande.

Cordialement,
AZOUMAG · The Ultimate Online Solutions
📧 azoumagomar56@gmail.com
```

---

## 🆘 Partie 4 — Situations courantes

### Cas A · Le client demande une deuxième licence (nouveau PC / autre bureau)

**La même clé fonctionne sur autant de postes qu'ils veulent.** Répondez :

> Votre clé fonctionne sur un nombre illimité de postes. Ouvrez le fichier HTML sur le nouveau PC et collez la même clé.

Pas besoin d'une nouvelle clé. Si le client veut des clés distinctes par site (pour son propre suivi), créez-en avec des noms différents :
- `Acme SARL — Site A`
- `Acme SARL — Site B`

### Cas B · Le client a perdu sa clé

Retrouvez-le dans votre registre `~/azoumag-ventes.txt` → **recréez une clé avec exactement le même nom** :

```bash
node scripts/generate-license.mjs "Acme Logistique SARL"
```

Les deux clés (perdue + nouvelle) sont techniquement différentes mais **toutes les deux valides**. Renvoyez la nouvelle par email.

### Cas C · La clé du client ne marche pas

Demandez-lui de vérifier :
1. A-t-il copié la clé **en entier** (pas de retour à la ligne manquant ni d'espace) ?
2. Le fichier HTML qu'il a ouvert est-il bien celui que **vous** avez envoyé ? (Un ancien fichier a une autre clé publique et refusera votre nouvelle clé.)
3. Le navigateur bloque-t-il `localStorage` ? (Rare, mais possible en mode privé strict.)

Pour déboguer de votre côté :
```bash
node scripts/generate-license.mjs --verify "AZMG-…clé qu'il a essayée"
```

Si de **votre** côté c'est ✓ Valid, alors le problème vient du fichier HTML côté client → renvoyez-lui le fichier à jour.

### Cas D · Vous suspectez qu'une clé a été piratée / partagée

- Utilisez `--verify` pour lire le nom inscrit dans la clé leakée → vous savez d'où vient la fuite.
- **Vous ne pouvez pas révoquer une clé individuelle** — le design est "signature valide = clé valide", sans serveur de contrôle.
- **Option nucléaire** pour tout révoquer : générer une nouvelle paire de clés, refaire le HTML, redistribuer aux clients légitimes. À faire seulement si le piratage est sérieux.

**Prévention :** dans le contrat de vente, précisez que la clé est **nominative** et que le partage est interdit. Le nom du client s'affichant dans l'application dissuade déjà pas mal.

### Cas E · Vente en lot (contrat d'entreprise — plusieurs sites)

Boucle bash rapide pour créer plusieurs clés d'un coup :

```bash
for site in "Casablanca" "Rabat" "Tanger" "Marrakech"; do
  echo "=== $site ==="
  node scripts/generate-license.mjs "Acme SARL — Site $site"
done
```

Copiez chaque clé dans un email séparé, ou toutes dans un seul avec un tableau récapitulatif.

### Cas F · Version d'essai (30 jours par exemple)

Le système actuel émet des licences **perpétuelles** — pas d'expiration. Pour une version d'essai, deux options :

1. **Confiance** : émettez une clé normale, mais tenez un tableau des essais et relancez le client avant la fin (ne coûte rien mais pas de blocage automatique).
2. **Amélioration future** : demandez-moi d'ajouter un champ `expires` (date d'expiration) dans le payload — la vérification browser refusera automatiquement les clés expirées. C'est un ajout d'~20 lignes de code.

### Cas G · Supprimer une entrée du registre

⚠ **Attention à la différence :**
- Supprimer du **registre** = enlever de VOTRE liste locale. Facile. La clé chez le client **fonctionne toujours**.
- **Révoquer** la clé = empêcher le client de l'utiliser. **Impossible** avec le système actuel (cf. Cas D).

**Suppression interactive (avec confirmation) :**
```bash
node scripts/generate-license.mjs --delete "acme"
```

Le script affiche les correspondances trouvées et demande confirmation avant de supprimer. Si plusieurs matches, il vous laisse choisir : `1,3` (numéros), `all` (tous), ou `annuler`.

**Suppression sans confirmation (usage scripté) :**
```bash
node scripts/generate-license.mjs --delete "acme" --yes
```

**Supprimer plusieurs matches d'un coup :**
```bash
node scripts/generate-license.mjs --delete "acme" --all --yes
```

Le script :
1. Retire la ligne du `licenses/registry.csv`
2. Supprime le fichier individuel `licenses/<slug>-<horodatage>.txt`
3. Affiche un rappel : la clé chez le client reste fonctionnelle

**Quand utiliser :** client remboursé, essai terminé, entrée créée par erreur, ménage annuel du registre.

**Tout supprimer d'un coup (`--purge`)** — pour remettre le registre à zéro :

```bash
node scripts/generate-license.mjs --purge
```

Le script affiche le nombre d'entrées/fichiers concernés et demande de taper `PURGE` (en majuscules) pour confirmer — c'est irréversible.

Version scriptée sans confirmation :
```bash
node scripts/generate-license.mjs --purge --yes
```

⚠ Idem : les clés déjà distribuées aux clients restent fonctionnelles. `--purge` ne touche pas à `keys/private.pem`.

---

## 📋 Partie 5 — Aide-mémoire (à imprimer)

| Action | Commande |
|---|---|
| Créer une clé | `node scripts/generate-license.mjs "Nom Client"` |
| Lister toutes les licences | `node scripts/generate-license.mjs --list` |
| Lister avec clés complètes | `node scripts/generate-license.mjs --list --full` |
| Chercher un client | `node scripts/generate-license.mjs --find "nom"` |
| Supprimer du registre | `node scripts/generate-license.mjs --delete "nom"` |
| Suppression sans confirmation | `node scripts/generate-license.mjs --delete "nom" --yes` |
| Purger tout le registre | `node scripts/generate-license.mjs --purge` |
| Purger sans confirmation | `node scripts/generate-license.mjs --purge --yes` |
| Vérifier une clé | `node scripts/generate-license.mjs --verify "AZMG-…"` |
| Voir la clé publique | `node scripts/generate-license.mjs --show-public` |
| Aide | `node scripts/generate-license.mjs --help` |
| Emplacement clé privée | `keys/private.pem` (**À SAUVEGARDER**) |
| Emplacement registre | `licenses/` (**À SAUVEGARDER**, git-ignoré) |
| Emplacement application | `inventory-sheet-generator-v3.html` |
| Ligne du HTML avec clé publique | ligne 379 |

---

## 🏆 Partie 6 — Les 5 règles d'or

1. **Ne partagez JAMAIS `keys/private.pem`** — c'est votre clé de signature. Traitez-la comme un code PIN de carte bancaire.
2. **Vérifiez toujours le nom du client** avant d'envoyer — le nom est gravé pour toujours dans la clé.
3. **Sauvegardez le dossier `licenses/`** — chaque clé y est enregistrée automatiquement ; c'est votre seule trace de qui possède quoi.
4. **Le même fichier HTML fonctionne pour tous les clients** — un seul build, des clés illimitées.
5. **Les licences perpétuelles ne peuvent pas être révoquées individuellement** — supprimer du registre n'invalide PAS la clé chez le client. Votre tarification doit en tenir compte (paiement unique pour licence à vie, ou passez à un modèle SaaS hébergé si vous voulez pouvoir révoquer par siège).

---

## 📞 Ressources

- **Application** : `inventory-sheet-generator-v3.html`
- **Script de génération** : `scripts/generate-license.mjs`
- **Test technique** : `node scripts/test-gate.mjs` (vérifie que tout fonctionne)
- **Repo GitHub** : https://github.com/azoumagdotcom/inventory
- **Contact vendeur** : azoumagomar56@gmail.com

---

*AZOUMAG © 2026 — The Ultimate Online Solutions*
