#!/usr/bin/env node
/*
 * Exercises the exact browser-side verification code path against the
 * public key currently embedded in inventory-sheet-generator-v3.html,
 * using Node's Web Crypto (same API as the browser).
 */
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const HTML = join(ROOT, 'inventory-sheet-generator-v3.html');
const GEN  = join(ROOT, 'scripts', 'generate-license.mjs');

const html = await readFile(HTML, 'utf8');
const m = html.match(/var PUBLIC_KEY_B64\s*=\s*"([^"]+)"/);
if (!m) { console.error('✗ public key not found in HTML'); process.exit(1); }
const PUBLIC_KEY_B64 = m[1];
const PRODUCT_ID = 'AZOUMAG-INV-V3';

function b64ToBytes(s){ const b = Buffer.from(s, 'base64'); return new Uint8Array(b); }
function b64urlToBytes(s){ s = s.replace(/-/g,'+').replace(/_/g,'/'); while (s.length%4) s+='='; return b64ToBytes(s); }

const pubKey = await crypto.subtle.importKey(
  'spki', b64ToBytes(PUBLIC_KEY_B64),
  { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']
);

async function verify(licenseKey){
  const cleaned = String(licenseKey || '').replace(/\s+/g,'');
  const mm = cleaned.match(/^AZMG-([A-Za-z0-9_-]+)\.([A-Za-z0-9_-]+)$/);
  if (!mm) return { ok: false, reason: 'bad format' };
  const payloadBytes = b64urlToBytes(mm[1]);
  const sigBytes = b64urlToBytes(mm[2]);
  const ok = await crypto.subtle.verify(
    { name: 'ECDSA', hash: 'SHA-256' }, pubKey, sigBytes, payloadBytes
  );
  if (!ok) return { ok: false, reason: 'bad signature' };
  const payload = JSON.parse(new TextDecoder().decode(payloadBytes));
  if (payload.p !== PRODUCT_ID) return { ok: false, reason: 'wrong product' };
  return { ok: true, payload };
}

let pass = 0, fail = 0;
function check(name, cond, extra){
  if (cond) { console.log('  ✓ ' + name); pass++; }
  else      { console.log('  ✗ ' + name + (extra ? ' — ' + extra : '')); fail++; }
}

console.log('Public key in HTML:', PUBLIC_KEY_B64.slice(0, 32) + '…');
console.log('');

// --- Test 1: mint a fresh key, verify it via Web Crypto ---
console.log('[1] mint → verify (browser code path)');
const mint = spawnSync('node', [GEN, 'Test Client v3'], { encoding: 'utf8' });
if (mint.status !== 0) { console.error(mint.stderr); process.exit(1); }
const freshKey = mint.stdout.split('\n').find(l => l.startsWith('AZMG-'));
check('mint produced a key', !!freshKey);
const r1 = await verify(freshKey);
check('fresh key verifies', r1.ok, r1.reason);
check('customer name preserved', r1.ok && r1.payload.c === 'Test Client v3');
check('product id correct',      r1.ok && r1.payload.p === PRODUCT_ID);

// --- Test 2: bad format rejected ---
console.log('\n[2] bad inputs rejected');
check('empty rejected',           !(await verify('')).ok);
check('gibberish rejected',       !(await verify('hello world')).ok);
check('wrong prefix rejected',    !(await verify('FOO-abc.def')).ok);
check('missing signature rejected', !(await verify('AZMG-abc')).ok);

// --- Test 3: tampered payload rejected ---
console.log('\n[3] tampering rejected');
const parts = freshKey.slice(5).split('.');
const tampered = 'AZMG-' + parts[0].slice(0, -1) + 'X' + '.' + parts[1];
const r3 = await verify(tampered);
check('modified payload rejected', !r3.ok, r3.reason);

const mid = Math.floor(parts[1].length / 2);
const orig = parts[1][mid];
const swap = orig === 'A' ? 'B' : 'A';
const badSig = 'AZMG-' + parts[0] + '.' + parts[1].slice(0, mid) + swap + parts[1].slice(mid + 1);
const r4 = await verify(badSig);
check('modified signature rejected', !r4.ok, r4.reason);

// --- Test 4: whitespace tolerated ---
console.log('\n[4] input normalization');
const spaced = freshKey.replace(/(.{20})/g, '$1  \n  ');
const r5 = await verify(spaced);
check('whitespace-tolerant', r5.ok, r5.reason);

// --- Test 5: DOM smoke — key elements exist in HTML ---
console.log('\n[5] gate DOM elements present in HTML');
check('license gate div',           html.includes('id="licenseGate"'));
check('activation form',            html.includes('id="licenseGateForm"'));
check('license input',              html.includes('id="licenseGateInput"'));
check('sidebar license info box',   html.includes('id="licenseInfoBox"'));
check('customer display',           html.includes('id="licenseCustomer"'));
check('deactivate button',          html.includes('id="btnDeactivateLicense"'));
check('app-shell hidden by default', html.includes('class="app-shell" style="display:none"'));
check('AZMG_LICENSE exposed',       html.includes('window.AZMG_LICENSE'));
check('no placeholder left',        !html.includes('___AZMG_PUBLIC_KEY___'));

console.log('\n' + (fail === 0 ? '✓' : '✗') + ' ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail === 0 ? 0 : 1);
