#!/usr/bin/env node
/**
 * Plain Node server: serves ./public and handles POST /api/lead.
 * Use for local preview (`npm run dev`) or on any VPS / Node host (`npm start`).
 * Leads are always appended to data/leads.jsonl, and emailed when RESEND_API_KEY is set.
 */
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const { handleLead } = require('./lib/lead-handler');

// tiny .env loader (no dependency)
try {
  for (const line of fs.readFileSync(path.join(__dirname, '.env'), 'utf8').split('\n')) {
    const m = line.match(/^\s*([\w.]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
} catch {}

const PORT = Number(process.env.PORT || 8080);
const PUBLIC = path.join(__dirname, 'public');
const LOG = process.env.LEAD_LOG_FILE || path.join(__dirname, 'data', 'leads.jsonl');
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.xml': 'application/xml', '.txt': 'text/plain', '.json': 'application/json', '.woff2': 'font/woff2' };

function logLead(record) {
  fs.mkdirSync(path.dirname(LOG), { recursive: true });
  fs.appendFileSync(LOG, JSON.stringify(record) + '\n');
}

function readBody(req, limit = 8 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', c => { size += c.length; if (size > limit) { reject(new Error('Payload too large')); req.destroy(); } else chunks.push(c); });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/api/lead') {
    res.setHeader('Content-Type', 'application/json');
    if (req.method !== 'POST') { res.writeHead(405); return res.end(JSON.stringify({ ok: false, error: 'Method not allowed' })); }
    try {
      const body = JSON.parse((await readBody(req)) || '{}');
      const out = await handleLead(body, process.env, { log: logLead });
      res.writeHead(out.status); return res.end(JSON.stringify(out.body));
    } catch (e) {
      res.writeHead(400); return res.end(JSON.stringify({ ok: false, error: e.message }));
    }
  }
  // static files with pretty URLs
  let p = decodeURIComponent(url.pathname);
  if (p.endsWith('/')) p += 'index.html';
  let file = path.normalize(path.join(PUBLIC, p));
  if (!file.startsWith(PUBLIC)) { res.writeHead(403); return res.end(); }
  if (!fs.existsSync(file) && fs.existsSync(file + '/index.html')) { res.writeHead(301, { Location: url.pathname + '/' }); return res.end(); }
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) { file = path.join(PUBLIC, '404.html'); res.statusCode = 404; }
  res.setHeader('Content-Type', TYPES[path.extname(file)] || 'application/octet-stream');
  if (/\/assets\//.test(file)) res.setHeader('Cache-Control', 'public, max-age=604800');
  fs.createReadStream(file).pipe(res);
});
server.listen(PORT, () => console.log(`Vinyl Wrapsody site running at http://localhost:${PORT}  (leads -> ${LOG})`));
