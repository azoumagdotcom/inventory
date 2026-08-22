#!/usr/bin/env node
/*
 * AZOUMAG Inventory Suite — License Generator
 *
 * On first run: generates an ECDSA P-256 keypair in ./keys/, then patches
 * the placeholder public key into inventory-sheet-generator-v3.html.
 * On subsequent runs: mints a signed license key for the given customer.
 *
 * Usage:
 *   node scripts/generate-license.mjs "Customer Name"
 *   node scripts/generate-license.mjs --show-public
 *   node scripts/generate-license.mjs --verify "AZMG-..."
 */

import { writeFile, readFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { generateKeyPairSync, sign, verify, createPrivateKey, createPublicKey } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const KEYS_DIR = join(ROOT, 'keys');
const PRIVATE_PEM = join(KEYS_DIR, 'private.pem');
const PUBLIC_PEM = join(KEYS_DIR, 'public.pem');
const HTML_FILE = join(ROOT, 'inventory-sheet-generator-v3.html');
const PRODUCT_ID = 'AZOUMAG-INV-V3';
const PLACEHOLDER = '___AZMG_PUBLIC_KEY___';

function b64url(buf) {
  return Buffer.from(buf).toString('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function b64urlDecode(s) {
  s = s.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  return Buffer.from(s, 'base64');
}

async function ensureKeypair() {
  if (existsSync(PRIVATE_PEM) && existsSync(PUBLIC_PEM)) {
    return {
      privatePem: await readFile(PRIVATE_PEM, 'utf8'),
      publicPem: await readFile(PUBLIC_PEM, 'utf8'),
      created: false,
    };
  }
  await mkdir(KEYS_DIR, { recursive: true });
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
    if (!re.test(html)) {
      console.warn('⚠ Could not find public key slot in HTML. Manual patch required.');
      return;
    }
    out = html.replace(re, `$1${spkiB64}$2`);
    console.log('✓ Public key updated in HTML.');
  }
  await writeFile(HTML_FILE, out);
}

function generateLicense(customer, privatePem) {
  const payload = {
    c: customer,
    p: PRODUCT_ID,
    i: new Date().toISOString().slice(0, 10),
  };
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

function usage() {
  console.log(`AZOUMAG Inventory Suite — License Generator

Usage:
  node scripts/generate-license.mjs "Customer Name"     Mint a license key
  node scripts/generate-license.mjs --show-public       Print public key (SPKI, base64)
  node scripts/generate-license.mjs --verify "AZMG-..." Verify a license key

On first run, an ECDSA P-256 keypair is generated in ./keys/
and the public key is patched into the v3 HTML. Keep keys/private.pem SAFE.
`);
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 0 || args.includes('-h') || args.includes('--help')) {
    usage();
    process.exit(0);
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
  console.log('');
  console.log('License key for: ' + customer);
  console.log('─'.repeat(64));
  console.log(license);
  console.log('─'.repeat(64));
  console.log('Send this key to the customer. They paste it into the activation gate.');
}

main().catch((err) => { console.error(err); process.exit(1); });
