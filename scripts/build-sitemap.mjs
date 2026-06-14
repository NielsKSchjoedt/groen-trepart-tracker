#!/usr/bin/env node
/**
 * Generate public/sitemap.xml from app routes and committed data files.
 *
 * Sources of truth:
 *   - Pillar slugs: src/lib/slugs.ts (mirrored below)
 *   - Kommuner: public/data/dashboard-summary.json → national.byKommune
 *   - Videnscenter: public/data/videnscenter/articles.json (run build-content first)
 *
 * Run via: npm run build-sitemap
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { kommuneToSlug } from './lib/kommune-slugs.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, '..');
const SITE = 'https://treparttracker.dk';
const OUT_PATH = path.join(REPO, 'public', 'sitemap.xml');
const DASHBOARD_PATH = path.join(REPO, 'public', 'data', 'dashboard-summary.json');
const ARTICLES_PATH = path.join(REPO, 'public', 'data', 'videnscenter', 'articles.json');
const VIDENCENTER_SRC = path.join(REPO, 'content', 'videnscenter');

/** Keep in sync with PILLAR_SLUGS in src/lib/slugs.ts */
const PILLARS = [
  { slug: 'kvælstof', changefreq: 'daily', priority: '1.0', label: 'Kvælstof (nitrogen)' },
  { slug: 'lavbund', changefreq: 'daily', priority: '0.9', label: 'Lavbundsarealer (lowland extraction)' },
  { slug: 'skovrejsning', changefreq: 'daily', priority: '0.9', label: 'Skovrejsning (afforestation)' },
  { slug: 'co2', changefreq: 'monthly', priority: '0.8', label: 'CO₂-udledning' },
  { slug: 'natur', changefreq: 'daily', priority: '0.9', label: 'Beskyttet natur' },
];

function toLastmod(value) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

function absUrl(pathname) {
  return new URL(pathname, SITE).href;
}

function urlEntry({ pathname, changefreq, priority, lastmod }) {
  const lines = [
    '  <url>',
    `    <loc>${absUrl(pathname)}</loc>`,
  ];
  if (lastmod) lines.push(`    <lastmod>${lastmod}</lastmod>`);
  lines.push(`    <changefreq>${changefreq}</changefreq>`);
  lines.push(`    <priority>${priority}</priority>`);
  lines.push('  </url>');
  return lines.join('\n');
}

function section(title, entries) {
  return [`  <!-- ${title} -->`, ...entries].join('\n');
}

function loadDashboardLastmod() {
  if (!fs.existsSync(DASHBOARD_PATH)) {
    console.error(`Missing ${DASHBOARD_PATH} — run ETL / copy data to public/data first`);
    process.exit(1);
  }
  const data = JSON.parse(fs.readFileSync(DASHBOARD_PATH, 'utf8'));
  const kommuner = data.national?.byKommune;
  if (!Array.isArray(kommuner) || kommuner.length === 0) {
    console.error('dashboard-summary.json: national.byKommune is missing or empty');
    process.exit(1);
  }
  return {
    lastmod: toLastmod(data.builtAt ?? data.fetchedAt),
    kommuner,
  };
}

function loadArticles() {
  if (!fs.existsSync(ARTICLES_PATH)) {
    console.error(`Missing ${ARTICLES_PATH} — run npm run build-content first`);
    process.exit(1);
  }
  const payload = JSON.parse(fs.readFileSync(ARTICLES_PATH, 'utf8'));
  if (!Array.isArray(payload.articles) || payload.articles.length === 0) {
    console.error('articles.json has no articles');
    process.exit(1);
  }
  return payload;
}

/** @returns {Map<string, string>} slug → YYYY-MM-DD from markdown file mtime */
function articleLastmodsBySlug() {
  const map = new Map();
  if (!fs.existsSync(VIDENCENTER_SRC)) return map;

  for (const file of fs.readdirSync(VIDENCENTER_SRC).filter((f) => f.endsWith('.md'))) {
    const filePath = path.join(VIDENCENTER_SRC, file);
    const raw = fs.readFileSync(filePath, 'utf8');
    const match = raw.match(/^slug:\s*(.+)$/m);
    if (!match) continue;
    const slug = match[1].trim().replace(/^["']|["']$/g, '');
    map.set(slug, toLastmod(fs.statSync(filePath).mtime));
  }
  return map;
}

function main() {
  const { lastmod: dataLastmod, kommuner } = loadDashboardLastmod();
  const articlesPayload = loadArticles();
  const articleLastmods = articleLastmodsBySlug();
  const videnscenterLastmod = toLastmod(articlesPayload.generated) ?? dataLastmod;

  const kommuneSlugs = kommuner
    .map((k) => kommuneToSlug(k.navn))
    .sort((a, b) => a.localeCompare(b, 'da'));

  const duplicateSlugs = kommuneSlugs.filter((s, i, arr) => arr.indexOf(s) !== i);
  if (duplicateSlugs.length > 0) {
    console.error('Duplicate kommune slugs:', [...new Set(duplicateSlugs)].join(', '));
    process.exit(1);
  }

  const blocks = [
    section('National oversigt', [
      urlEntry({
        pathname: '/',
        changefreq: 'daily',
        priority: '1.0',
        lastmod: dataLastmod,
      }),
    ]),
    section('Delmål (søjler)', PILLARS.map((p) =>
      urlEntry({
        pathname: `/${p.slug}`,
        changefreq: p.changefreq,
        priority: p.priority,
        lastmod: dataLastmod,
      }),
    )),
    section('Data og metode', [
      urlEntry({
        pathname: '/data-og-metode',
        changefreq: 'weekly',
        priority: '0.8',
        lastmod: dataLastmod,
      }),
    ]),
    section('Kommuneoversigt', [
      urlEntry({
        pathname: '/kommuner',
        changefreq: 'daily',
        priority: '0.9',
        lastmod: dataLastmod,
      }),
    ]),
    section('Videnscenter', [
      urlEntry({
        pathname: '/videnscenter',
        changefreq: 'monthly',
        priority: '0.8',
        lastmod: videnscenterLastmod,
      }),
      ...articlesPayload.articles.map((a) =>
        urlEntry({
          pathname: `/videnscenter/${a.slug}`,
          changefreq: 'monthly',
          priority: '0.6',
          lastmod: articleLastmods.get(a.slug) ?? videnscenterLastmod,
        }),
      ),
    ]),
    section(`Individuelle kommuner (${kommuneSlugs.length} stk.)`, kommuneSlugs.map((slug) =>
      urlEntry({
        pathname: `/kommuner/${slug}`,
        changefreq: 'daily',
        priority: '0.6',
        lastmod: dataLastmod,
      }),
    )),
  ];

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    '',
    blocks.join('\n\n'),
    '',
    '</urlset>',
    '',
  ].join('\n');

  fs.writeFileSync(OUT_PATH, xml, 'utf8');

  const urlCount = 1 + PILLARS.length + 1 + 1 + 1 + articlesPayload.articles.length + kommuneSlugs.length;
  console.log(`Wrote ${OUT_PATH} (${urlCount} URLs: root + ${PILLARS.length} pillars + static + ${articlesPayload.articles.length + 1} videnscenter + ${kommuneSlugs.length} kommuner)`);
}

main();
