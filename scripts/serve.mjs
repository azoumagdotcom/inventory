#!/usr/bin/env node
// Petit serveur HTTP statique — sert le dossier courant sur 0.0.0.0:PORT
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, resolve, sep } from 'node:path';

const PORT = parseInt(process.env.PORT || '8000', 10);
const ROOT = resolve(process.cwd());

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.mjs':  'application/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
  '.txt':  'text/plain; charset=utf-8',
  '.md':   'text/markdown; charset=utf-8',
};

const server = createServer(async (req, res) => {
  try {
    let urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
    if (urlPath === '/') urlPath = '/warehouse-lab.html';
    const filePath = resolve(join(ROOT, urlPath));
    if (!filePath.startsWith(ROOT + sep) && filePath !== ROOT) {
      res.writeHead(403); res.end('Forbidden'); return;
    }
    const s = await stat(filePath).catch(() => null);
    if (!s || s.isDirectory()) { res.writeHead(404); res.end('Not found'); return; }
    const data = await readFile(filePath);
    res.writeHead(200, {
      'Content-Type': MIME[extname(filePath).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-store',
    });
    res.end(data);
    console.log(`[${new Date().toISOString().slice(11,19)}] ${req.method} ${urlPath} → 200 (${data.length}b)`);
  } catch (e) {
    res.writeHead(500); res.end('Server error: ' + e.message);
    console.error('ERR', e);
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Warehouse Lab dev server → http://0.0.0.0:${PORT}/`);
  console.log(`Root: ${ROOT}`);
});
