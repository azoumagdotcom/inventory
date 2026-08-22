#!/usr/bin/env node
/*
 * AZOUMAG Inventory Suite — License Generator
 *
 * First run: generates an ECDSA P-256 keypair in ./keys/, patches the
 * public key into the v3 HTML.
 * On each mint: appends the license to ./licenses/registry.csv AND
 * saves an individual file ./licenses/<slug>-<timestamp>.txt
 *
 * Usage:
 *   node scripts/generate-license.mjs "Customer Name"       Mint a license
 *   node scripts/generate-license.mjs --list                List all licenses ever minted
 *   node scripts/generate-license.mjs --list --full         List with full keys
 *   node scripts/generate-license.mjs --find "acme"         Find license(s) by customer name
 *   node scripts/generate-license.mjs --verify "AZMG-..."   Verify a license key
 *   node scripts/generate-license.mjs --show-public         Print the public key
 */

import { writeFile, readFile, appendFile, mkdir, chmod, readdir, unlink } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { generateKeyPairSync, sign, verify, createPrivateKey, createPublicKey } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as readlinePromises from 'node:readline/promises';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const KEYS_DIR = join(ROOT, 'keys');
const PRIVATE_PEM = join(KEYS_DIR, 'private.pem');
const PUBLIC_PEM = join(KEYS_DIR, 'public.pem');
const LICENSES_DIR = join(ROOT, 'licenses');
const REGISTRY = join(LICENSES_DIR, 'registry.csv');
const HTML_FILE = join(ROOT, 'inventory-sheet-generator-v3.html');
const PRODUCT_ID = 'AZOUMAG-INV-V3';
const PLACEHOLDER = '___AZMG_PUBLIC_KEY___';

/* ---------- utils ---------- */
function b64url(buf) {
  return Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function b64urlDecode(s) {
  s = s.replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '=';
  return Buffer.from(s, 'base64');
}
function slugify(s) {
  return String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'client';
}
function nowStamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}
function csvEscape(v) {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
function csvParseLine(line) {
  const out = []; let cur = ''; let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQ) {
      if (ch === '"' && line[i+1] === '"') { cur += '"'; i++; }
      else if (ch === '"') { inQ = false; }
      else cur += ch;
    } else {
      if (ch === ',') { out.push(cur); cur = ''; }
      else if (ch === '"') { inQ = true; }
      else cur += ch;
    }
  }
  out.push(cur);
  return out;
}

/* ---------- keypair ---------- */
async function ensureKeypair() {
  if (existsSync(PRIVATE_PEM) && existsSync(PUBLIC_PEM)) {
    return {
      privatePem: await readFile(PRIVATE_PEM, 'utf8'),
      publicPem: await readFile(PUBLIC_PEM, 'utf8'),
      created: false,
    };
  }
  await mkdir(KEYS_DIR, { recursive: true });
  try { await chmod(KEYS_DIR, 0o700); } catch {}
  const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
  const privatePem = privateKey.export({ type: 'pkcs8', format: 'pem' });
  const publicPem = publicKey.export({ type: 'spki', format: 'pem' });
  await writeFile(PRIVATE_PEM, privatePem, { mode: 0o600 });
  await writeFile(PUBLIC_PEM, publicPem);
  return { privatePem, publicPem, created: true };
}

function pemToSpkiBase64(pem) {
  const publicKey = createPublicKey(pem);
  return publicKey.export({ type: 'spki', format: 'der' }).toString('base64');
}

async function patchHtmlPublicKey(spkiB64) {
  const html = await readFile(HTML_FILE, 'utf8');
  let out;
  if (html.includes(PLACEHOLDER)) {
    out = html.replaceAll(PLACEHOLDER, spkiB64);
    console.log('✓ Public key inserted into HTML.');
  } else {
    const re = /(var PUBLIC_KEY_B64\s*=\s*")[^"]*(";)/;
    if (!re.test(html)) { console.warn('⚠ Could not find public key slot in HTML.'); return; }
    out = html.replace(re, `$1${spkiB64}$2`);
    console.log('✓ Public key updated in HTML.');
  }
  await writeFile(HTML_FILE, out);
}

/* ---------- license mint / verify ---------- */
function generateLicense(customer, privatePem) {
  const payload = { c: customer, p: PRODUCT_ID, i: new Date().toISOString().slice(0, 10) };
  const payloadBytes = Buffer.from(JSON.stringify(payload), 'utf8');
  const privateKey = createPrivateKey(privatePem);
  const sig = sign('sha256', payloadBytes, { key: privateKey, dsaEncoding: 'ieee-p1363' });
  return `AZMG-${b64url(payloadBytes)}.${b64url(sig)}`;
}

function verifyLicense(licenseKey, publicPem) {
  const cleaned = String(licenseKey).replace(/\s+/g, '');
  const m = cleaned.match(/^AZMG-([A-Za-z0-9_-]+)\.([A-Za-z0-9_-]+)$/);
  if (!m) return { ok: false, error: 'Bad format' };
  const payloadBytes = b64urlDecode(m[1]);
  const sigBytes = b64urlDecode(m[2]);
  const publicKey = createPublicKey(publicPem);
  const ok = verify('sha256', payloadBytes, { key: publicKey, dsaEncoding: 'ieee-p1363' }, sigBytes);
  if (!ok) return { ok: false, error: 'Bad signature' };
  const payload = JSON.parse(payloadBytes.toString('utf8'));
  return { ok: true, payload };
}

/* ---------- registry (auto-save) ---------- */
async function ensureLicensesDir() {
  await mkdir(LICENSES_DIR, { recursive: true });
  try { await chmod(LICENSES_DIR, 0o700); } catch {}
  if (!existsSync(REGISTRY)) {
    await writeFile(REGISTRY, 'mint_datetime,customer,product,issued,key\n', { mode: 0o600 });
  }
}

async function saveLicense(customer, license) {
  await ensureLicensesDir();
  const stamp = nowStamp();
  const iso = new Date().toISOString();

  // Append to CSV registry
  const row = [iso, customer, PRODUCT_ID, iso.slice(0,10), license].map(csvEscape).join(',') + '\n';
  await appendFile(REGISTRY, row);
  try { await chmod(REGISTRY, 0o600); } catch {}

  // Individual file (never overwritten)
  const slug = slugify(customer);
  const file = join(LICENSES_DIR, `${slug}-${stamp}.txt`);
  const content =
`AZOUMAG Inventory Suite v3 — License

Customer:  ${customer}
Product:   ${PRODUCT_ID}
Issued:    ${iso.slice(0, 10)}
Minted at: ${iso}

License key:
${license}
`;
  await writeFile(file, content, { mode: 0o600 });
  return { registry: REGISTRY, file };
}

async function readRegistry() {
  if (!existsSync(REGISTRY)) return [];
  const raw = await readFile(REGISTRY, 'utf8');
  const lines = raw.split(/\r?\n/).filter(Boolean);
  if (lines.length <= 1) return [];
  const header = csvParseLine(lines[0]);
  return lines.slice(1).map(line => {
    const cells = csvParseLine(line);
    const obj = {};
    header.forEach((h, i) => { obj[h] = cells[i] ?? ''; });
    return obj;
  });
}

function shortKey(k) {
  if (!k || k.length < 30) return k;
  return k.slice(0, 15) + '…' + k.slice(-8);
}

async function cmdList(full) {
  const rows = await readRegistry();
  if (rows.length === 0) {
    console.log('(aucune licence enregistrée)');
    return;
  }
  console.log('');
  console.log(`Registre des licences (${rows.length} entrée${rows.length>1?'s':''}) — ${REGISTRY}`);
  console.log('─'.repeat(90));
  rows.forEach((r, i) => {
    const dt = (r.mint_datetime || '').replace('T', ' ').slice(0, 19);
    console.log(`${String(i+1).padStart(3, ' ')}. ${dt}  │  ${r.customer}`);
    console.log(`     ${full ? r.key : shortKey(r.key)}`);
  });
  console.log('─'.repeat(90));
  console.log(`Total : ${rows.length} licence${rows.length>1?'s':''}`);
}

function stampFromIso(iso) {
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

async function findLicenseFile(customer, isoStamp) {
  const slug = slugify(customer);
  const expected = join(LICENSES_DIR, `${slug}-${stampFromIso(isoStamp)}.txt`);
  if (existsSync(expected)) return expected;
  // Fallback: pick the first file starting with the slug
  try {
    const files = await readdir(LICENSES_DIR);
    const match = files.find(f => f.startsWith(slug + '-') && f.endsWith('.txt'));
    return match ? join(LICENSES_DIR, match) : null;
  } catch { return null; }
}

async function rewriteRegistry(rows) {
  const header = 'mint_datetime,customer,product,issued,key\n';
  const body = rows.map(r =>
    [r.mint_datetime, r.customer, r.product, r.issued, r.key].map(csvEscape).join(',')
  ).join('\n');
  await writeFile(REGISTRY, header + (body ? body + '\n' : ''), { mode: 0o600 });
}

async function ask(question) {
  const rl = readlinePromises.createInterface({ input: process.stdin, output: process.stdout });
  try { return (await rl.question(question)).trim(); }
  finally { rl.close(); }
}
function isYes(s) {
  const v = String(s || '').trim().toLowerCase();
  return v === 'o' || v === 'oui' || v === 'y' || v === 'yes';
}

async function cmdDelete(query, opts = {}) {
  const q = String(query).toLowerCase();
  const rows = await readRegistry();
  const matches = rows
    .map((r, idx) => ({ ...r, _idx: idx }))
    .filter(r => (r.customer || '').toLowerCase().includes(q));
  if (matches.length === 0) {
    console.log(`Aucune licence pour "${query}".`);
    return;
  }

  console.log('');
  console.log(`${matches.length} correspondance${matches.length>1?'s':''} pour "${query}" :`);
  matches.forEach((r, i) => {
    console.log(`  [${i+1}] ${r.customer}`);
    console.log(`      émise ${r.mint_datetime}`);
    console.log(`      ${shortKey(r.key)}`);
  });
  console.log('');

  let toDelete;
  if (matches.length === 1) {
    if (!opts.yes) {
      const ans = await ask('Confirmer la suppression ? (o/N) ');
      if (!isYes(ans)) { console.log('Annulé.'); return; }
    }
    toDelete = matches;
  } else {
    let selection;
    if (opts.all) {
      selection = 'all';
    } else {
      selection = await ask('Quel(s) numéro(s) supprimer ? (ex: 1,3  ou  "all"  ou  "annuler") : ');
    }
    const norm = String(selection || '').trim().toLowerCase();
    if (!norm || norm === 'annuler' || norm === 'cancel') { console.log('Annulé.'); return; }
    if (norm === 'all') {
      toDelete = matches;
    } else {
      const nums = norm.split(',').map(s => parseInt(s.trim(), 10))
        .filter(n => !isNaN(n) && n >= 1 && n <= matches.length);
      if (nums.length === 0) { console.log('Sélection invalide, annulé.'); return; }
      toDelete = [...new Set(nums)].map(n => matches[n-1]);
    }
    if (!opts.yes) {
      const ans = await ask(`Supprimer ${toDelete.length} licence(s) ? (o/N) `);
      if (!isYes(ans)) { console.log('Annulé.'); return; }
    }
  }

  const idxSet = new Set(toDelete.map(r => r._idx));
  const remaining = rows.filter((_, i) => !idxSet.has(i));
  await rewriteRegistry(remaining);

  let filesDeleted = 0;
  for (const r of toDelete) {
    const file = await findLicenseFile(r.customer, r.mint_datetime);
    if (file && existsSync(file)) {
      try { await unlink(file); filesDeleted++; } catch {}
    }
  }

  console.log('');
  console.log(`✓ ${toDelete.length} entrée(s) supprimée(s) du registre.`);
  console.log(`✓ ${filesDeleted} fichier(s) individuel(s) supprimé(s).`);
  console.log('');
  console.log('⚠ Rappel : la clé chez le client reste FONCTIONNELLE.');
  console.log('  Cette suppression n\'affecte que votre registre local.');
}

async function cmdPurge(opts = {}) {
  const rows = await readRegistry();
  let txtFiles = [];
  try {
    const all = await readdir(LICENSES_DIR);
    txtFiles = all.filter(f => f.endsWith('.txt'));
  } catch {}

  if (rows.length === 0 && txtFiles.length === 0 && !existsSync(REGISTRY)) {
    console.log('Le registre est déjà vide.');
    return;
  }

  console.log('');
  console.log('⚠ Vous êtes sur le point de supprimer TOUT le registre local :');
  console.log(`   • ${rows.length} entrée${rows.length>1?'s':''} dans registry.csv`);
  console.log(`   • ${txtFiles.length} fichier${txtFiles.length>1?'s':''} individuel${txtFiles.length>1?'s':''} (.txt)`);
  console.log('');
  console.log('⚠ Les clés déjà distribuées aux clients resteront FONCTIONNELLES.');
  console.log('  Cette opération n\'affecte que votre registre local.');
  console.log('');

  if (!opts.yes) {
    const ans = await ask('Tapez "PURGE" pour confirmer (ou Entrée pour annuler) : ');
    if (ans !== 'PURGE') { console.log('Annulé.'); return; }
  }

  let filesDeleted = 0;
  for (const f of txtFiles) {
    try { await unlink(join(LICENSES_DIR, f)); filesDeleted++; } catch {}
  }
  if (existsSync(REGISTRY)) {
    try { await unlink(REGISTRY); } catch {}
  }

  console.log('');
  console.log(`✓ ${rows.length} entrée(s) supprimée(s) du registre.`);
  console.log(`✓ ${filesDeleted} fichier(s) individuel(s) supprimé(s).`);
  console.log(`✓ registry.csv réinitialisé.`);
}

async function cmdFind(query) {
  const q = String(query).toLowerCase();
  const rows = await readRegistry();
  const matches = rows.filter(r => (r.customer || '').toLowerCase().includes(q));
  if (matches.length === 0) {
    console.log(`Aucune licence pour "${query}".`);
    return;
  }
  console.log('');
  console.log(`${matches.length} correspondance${matches.length>1?'s':''} pour "${query}" :`);
  matches.forEach((r, i) => {
    console.log('─'.repeat(80));
    console.log(`[${i+1}] ${r.customer}`);
    console.log(`    Émise : ${r.mint_datetime}`);
    console.log(`    Clé   : ${r.key}`);
  });
  console.log('─'.repeat(80));
}

/* ---------- CLI ---------- */
function usage() {
  console.log(`AZOUMAG Inventory Suite — License Generator

Usage:
  node scripts/generate-license.mjs "Customer Name"     Mint a license key
  node scripts/generate-license.mjs --list              List all minted licenses
  node scripts/generate-license.mjs --list --full       List with full keys
  node scripts/generate-license.mjs --find "acme"       Find license(s) by name
  node scripts/generate-license.mjs --delete "acme"     Delete matching license(s) from registry
                              (add --yes to skip confirm, --all if multiple matches)
  node scripts/generate-license.mjs --purge             Delete ALL licenses from local registry
                              (add --yes to skip the "PURGE" confirmation)
  node scripts/generate-license.mjs --verify "AZMG-..." Verify a license key
  node scripts/generate-license.mjs --show-public       Print public key (SPKI, base64)

Every mint is auto-saved to licenses/registry.csv AND to an individual
file licenses/<slug>-<timestamp>.txt. The licenses/ folder is git-ignored
and permissions are set to owner-only (700 / 600).
`);
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 0 || args.includes('-h') || args.includes('--help')) {
    usage();
    process.exit(0);
  }

  // Commands that don't need the keypair
  if (args[0] === '--list') {
    await cmdList(args.includes('--full'));
    return;
  }
  if (args[0] === '--find') {
    if (!args[1]) { console.error('Missing search term.'); process.exit(1); }
    await cmdFind(args.slice(1).join(' '));
    return;
  }
  if (args[0] === '--delete') {
    const flags = new Set(args.filter(a => a.startsWith('--')));
    const query = args.slice(1).filter(a => !a.startsWith('--')).join(' ').trim();
    if (!query) { console.error('Missing customer name to delete.'); process.exit(1); }
    await cmdDelete(query, { yes: flags.has('--yes'), all: flags.has('--all') });
    return;
  }
  if (args[0] === '--purge') {
    const flags = new Set(args.filter(a => a.startsWith('--')));
    await cmdPurge({ yes: flags.has('--yes') });
    return;
  }

  const { privatePem, publicPem, created } = await ensureKeypair();
  if (created) {
    console.log('✓ Generated new ECDSA P-256 keypair in keys/');
    console.log('  keys/private.pem is git-ignored — KEEP IT SAFE, back it up.');
    await patchHtmlPublicKey(pemToSpkiBase64(publicPem));
  }

  if (args[0] === '--show-public') {
    console.log(pemToSpkiBase64(publicPem));
    return;
  }
  if (args[0] === '--verify') {
    if (!args[1]) { console.error('Missing license key.'); process.exit(1); }
    const res = verifyLicense(args[1], publicPem);
    if (!res.ok) { console.error('✗ Invalid: ' + res.error); process.exit(1); }
    console.log('✓ Valid license');
    console.log('  Customer: ' + res.payload.c);
    console.log('  Product:  ' + res.payload.p);
    console.log('  Issued:   ' + res.payload.i);
    return;
  }

  const customer = args.join(' ').trim();
  if (!customer) { console.error('Customer name required.'); process.exit(1); }

  const license = generateLicense(customer, privatePem);
  const saved = await saveLicense(customer, license);

  console.log('');
  console.log('License key for: ' + customer);
  console.log('─'.repeat(64));
  console.log(license);
  console.log('─'.repeat(64));
  console.log('✓ Saved to registry: ' + saved.registry);
  console.log('✓ Saved to file:     ' + saved.file);
  console.log('');
  console.log('Send this key to the customer. They paste it into the activation gate.');
}

main().catch((err) => { console.error(err); process.exit(1); });
