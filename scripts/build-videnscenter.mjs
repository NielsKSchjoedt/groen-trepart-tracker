#!/usr/bin/env node
/**
 * Bundle curated Videnscenter markdown (content/videnscenter/*.md) into
 * public/data/videnscenter/articles.json and refresh sitemap entries.
 *
 * These are ORIGINAL, neutral articles written for the tracker — not crawled
 * content. Raw crawls live in .cursor/memory-bank/ and must never be rendered.
 * See "Content Placement Policy" in .skills/etl-data-sources/SKILL.md.
 *
 * Run via: npm run build-content
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, '..');
const SRC_DIR = path.join(REPO, 'content', 'videnscenter');
const OUT_DIR = path.join(REPO, 'public', 'data', 'videnscenter');
const OUT_PATH = path.join(OUT_DIR, 'articles.json');
const SITEMAP_PATH = path.join(REPO, 'public', 'sitemap.xml');

// Display order of sections in the index.
const SECTION_ORDER = ['Om aftalen', 'De fem mål', 'Sådan hænger det sammen', 'Geografi og organisering', 'Data og metode'];

function parseFrontmatter(raw) {
  const fm = {};
  let body = raw.trim();
  if (raw.startsWith('---')) {
    const end = raw.indexOf('\n---', 3);
    if (end !== -1) {
      const block = raw.slice(3, end);
      body = raw.slice(end + 4).trim();
      for (const line of block.split('\n')) {
        const idx = line.indexOf(':');
        if (idx === -1) continue;
        const key = line.slice(0, idx).trim();
        let val = line.slice(idx + 1).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        fm[key] = val;
      }
    }
  }
  return { fm, body };
}

function main() {
  if (!fs.existsSync(SRC_DIR)) {
    console.error(`Content dir not found: ${SRC_DIR}`);
    process.exit(1);
  }
  const files = fs.readdirSync(SRC_DIR).filter((f) => f.endsWith('.md'));
  const articles = [];

  for (const file of files) {
    const raw = fs.readFileSync(path.join(SRC_DIR, file), 'utf8');
    const { fm, body } = parseFrontmatter(raw);
    if (!fm.title || !fm.slug || !fm.section) {
      console.warn(`Skip ${file}: missing title/slug/section in frontmatter`);
      continue;
    }
    articles.push({
      slug: fm.slug,
      title: fm.title,
      section: fm.section,
      summary: fm.summary ?? '',
      order: fm.order ? Number(fm.order) : 99,
      body,
    });
  }

  articles.sort((a, b) => {
    const sa = SECTION_ORDER.indexOf(a.section);
    const sb = SECTION_ORDER.indexOf(b.section);
    const secA = sa === -1 ? 999 : sa;
    const secB = sb === -1 ? 999 : sb;
    if (secA !== secB) return secA - secB;
    if (a.order !== b.order) return a.order - b.order;
    return a.title.localeCompare(b.title, 'da');
  });

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const payload = {
    generated: new Date().toISOString(),
    count: articles.length,
    note: 'Originale baggrundsartikler skrevet af Grøn Trepart Tracker ud fra offentlige kilder.',
    articles,
  };
  fs.writeFileSync(OUT_PATH, JSON.stringify(payload, null, 2), 'utf8');
  console.log(`Wrote ${OUT_PATH} (${articles.length} articles)`);

  updateSitemap(articles);
}

function updateSitemap(articles) {
  if (!fs.existsSync(SITEMAP_PATH)) {
    console.warn('No sitemap.xml — skipping sitemap update');
    return;
  }
  let xml = fs.readFileSync(SITEMAP_PATH, 'utf8');

  // Remove any existing <url> blocks that point at /videnscenter (old or stale).
  xml = xml.replace(/\s*<url>\s*<loc>https:\/\/treparttracker\.dk\/videnscenter[^<]*<\/loc>[\s\S]*?<\/url>/g, '');

  const entries = [
    `  <url>
    <loc>https://treparttracker.dk/videnscenter</loc>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>`,
    ...articles.map(
      (a) => `  <url>
    <loc>https://treparttracker.dk/videnscenter/${a.slug}</loc>
    <changefreq>monthly</changefreq>
    <priority>0.6</priority>
  </url>`,
    ),
  ].join('\n');

  const marker = '  <!-- Individuelle kommuner';
  if (xml.includes(marker)) {
    xml = xml.replace(marker, `${entries}\n\n${marker}`);
  } else {
    xml = xml.replace('</urlset>', `${entries}\n</urlset>`);
  }
  // Tidy up any doubled blank lines created by the removal step.
  xml = xml.replace(/\n{3,}/g, '\n\n');
  fs.writeFileSync(SITEMAP_PATH, xml, 'utf8');
  console.log(`Updated sitemap (${articles.length + 1} videnscenter URLs)`);
}

main();
