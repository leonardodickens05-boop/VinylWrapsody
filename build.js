#!/usr/bin/env node
/**
 * Tiny zero-dependency static site builder.
 *
 *   node build.js            -> builds pretty URLs (/contact/) into ./public
 *   node build.js --preview  -> builds file-style links (contact/index.html) into ./preview
 *   node build.js --demo     -> builds into ./public with the form in preview mode (for a backend-less host)
 *
 * Template syntax (inside src/pages/*.html and src/partials/*.html):
 *   {{> name}}                include src/partials/name.html
 *   {{link:contact}}          link to a page key (see PAGES below), relative to the current page
 *   {{asset:css/style.css}}   relative path into /assets
 *   {{var:title}}             page front-matter variable (also from site.json)
 *   {{#if var}} ... {{/if}}   simple truthy block
 *   {{#each key}} ... {{/each}} loop over array in data (uses {{this.prop}})
 *
 * Front matter: an HTML comment at the top of a page:
 *   <!--
 *   title: Page title
 *   description: Meta description
 *   -->
 */
const fs = require('fs');
const path = require('path');

const PREVIEW = process.argv.includes('--preview');
// --demo: pretty URLs but the form runs in preview mode (no backend, e.g. GitHub Pages) and pages are noindex
const DEMO = PREVIEW || process.argv.includes('--demo');
const ROOT = __dirname;
const SRC = path.join(ROOT, 'src');
const OUT = path.join(ROOT, PREVIEW ? 'preview' : 'public');

const site = JSON.parse(fs.readFileSync(path.join(SRC, 'data', 'site.json'), 'utf8'));
const locations = JSON.parse(fs.readFileSync(path.join(SRC, 'data', 'locations.json'), 'utf8'));

/** page key -> output folder ('' = root) */
const PAGES = {
  home: '',
  commercial: 'commercial-interior-vinyl-wrapping',
  kitchen: 'kitchen-vinyl-wrapping',
  contact: 'contact',
  'thank-you': 'thank-you',
  privacy: 'privacy-policy',
  'not-found': '404',
};
for (const loc of locations) PAGES['loc-' + loc.slug] = 'vinyl-wrapping-' + loc.slug;

const partials = {};
for (const f of fs.readdirSync(path.join(SRC, 'partials'))) {
  partials[f.replace(/\.html$/, '')] = fs.readFileSync(path.join(SRC, 'partials', f), 'utf8');
}

function parseFrontMatter(html) {
  const m = html.match(/^\s*<!--([\s\S]*?)-->/);
  const vars = {};
  if (!m) return { vars, body: html };
  for (const line of m[1].split('\n')) {
    const mm = line.match(/^\s*([\w-]+):\s*(.*)$/);
    if (mm) vars[mm[1]] = mm[2].trim();
  }
  return { vars, body: html.slice(m[0].length) };
}

function get(ctx, expr) {
  return expr.split('.').reduce((o, k) => (o == null ? undefined : o[k]), ctx);
}

function render(tpl, ctx, depth) {
  const rel = depth === 0 ? './' : '../'.repeat(depth);
  // includes (recursive)
  for (let i = 0; i < 10 && /\{\{>\s*[\w-]+\s*\}\}/.test(tpl); i++) {
    tpl = tpl.replace(/\{\{>\s*([\w-]+)\s*\}\}/g, (_, name) => {
      if (!partials[name]) throw new Error('Missing partial: ' + name);
      return partials[name];
    });
  }
  // each blocks
  tpl = tpl.replace(/\{\{#each\s+([\w.]+)\}\}([\s\S]*?)\{\{\/each\}\}/g, (_, key, inner) => {
    const arr = get(ctx, key) || [];
    return arr.map((item, i) => render(inner, Object.assign({}, ctx, { this: item, index: i, index1: i + 1 }), depth)).join('');
  });
  // if blocks
  tpl = tpl.replace(/\{\{#if\s+([\w.]+)\}\}([\s\S]*?)(?:\{\{else\}\}([\s\S]*?))?\{\{\/if\}\}/g, (_, key, a, b) => (get(ctx, key) ? a : (b || '')));
  // links
  tpl = tpl.replace(/\{\{link:([\w-]+)(#[\w-]+)?\}\}/g, (_, key, hash) => {
    if (!(key in PAGES)) throw new Error('Unknown page key: ' + key);
    const folder = PAGES[key];
    let href;
    if (PREVIEW) href = rel + (folder ? folder + '/index.html' : 'index.html');
    else href = folder ? rel + folder + '/' : rel;
    return href + (hash || '');
  });
  // assets
  tpl = tpl.replace(/\{\{asset:([^}]+)\}\}/g, (_, p) => rel + 'assets/' + p);
  // vars
  tpl = tpl.replace(/\{\{var:([\w.]+)\}\}/g, (_, key) => {
    const v = get(ctx, key);
    return v == null ? '' : String(v);
  });
  tpl = tpl.replace(/\{\{(this[\w.]*|index1?|site\.[\w.]+)\}\}/g, (_, key) => {
    const v = get(ctx, key);
    return v == null ? '' : String(v);
  });
  return tpl;
}

function writePage(key, html, vars) {
  const folder = PAGES[key];
  const depth = (key === 'not-found' && !PREVIEW) ? 0 : (folder ? 1 : 0);
  const ctx = Object.assign({}, vars, { site, locations, page: key, preview: PREVIEW, demo: DEMO, canonical: site.url + '/' + (folder ? folder + '/' : '') });
  let out = render(partials.layout, ctx, depth).replace('{{body}}', () => render(html, ctx, depth));
  // second pass so vars inside the body that came from partials resolve
  out = render(out, ctx, depth);
  const dir = path.join(OUT, folder);
  fs.mkdirSync(dir, { recursive: true });
  const file = key === 'not-found' && !PREVIEW ? path.join(OUT, '404.html') : path.join(dir, 'index.html');
  fs.writeFileSync(file, out);
  if (key === 'not-found' && !PREVIEW) fs.rmSync(dir, { recursive: true, force: true });
  console.log('built', path.relative(ROOT, file));
}

// static pages
for (const f of fs.readdirSync(path.join(SRC, 'pages'))) {
  if (!f.endsWith('.html')) continue;
  const key = f.replace(/\.html$/, '');
  if (key === 'location') continue; // template, handled below
  const { vars, body } = parseFrontMatter(fs.readFileSync(path.join(SRC, 'pages', f), 'utf8'));
  writePage(key, body, vars);
}
// location pages from one template
const locTpl = parseFrontMatter(fs.readFileSync(path.join(SRC, 'pages', 'location.html'), 'utf8'));
for (const loc of locations) {
  const vars = Object.assign({}, locTpl.vars, { loc });
  for (const k of Object.keys(locTpl.vars)) vars[k] = locTpl.vars[k].replace(/\{town\}/g, loc.town).replace(/\{county\}/g, loc.county);
  writePage('loc-' + loc.slug, locTpl.body, vars);
}

// preview build: copy assets so it is self-contained
if (PREVIEW) {
  fs.cpSync(path.join(ROOT, 'public', 'assets'), path.join(OUT, 'assets'), { recursive: true });
}

// sitemap + robots (real build only)
if (!PREVIEW) {
  const urls = Object.entries(PAGES).filter(([k]) => !['thank-you', 'not-found'].includes(k)).map(([, folder]) => `${site.url}/${folder ? folder + '/' : ''}`);
  fs.writeFileSync(path.join(OUT, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(u => `  <url><loc>${u}</loc></url>`).join('\n')}\n</urlset>\n`);
  fs.writeFileSync(path.join(OUT, 'robots.txt'), `User-agent: *\nAllow: /\nDisallow: /thank-you/\nSitemap: ${site.url}/sitemap.xml\n`);
}
console.log('done ->', path.relative(ROOT, OUT));
