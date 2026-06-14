#!/usr/bin/env node
/**
 * Build per-kommune "Grøn Trepart"-indgangssider into
 * public/data/kommune-trepart-links.json, keyed by kommune kode.
 *
 * Source: data/kommune-trepart-links.csv — a manually curated, verified
 * mapping of each of Denmark's 98 kommuner to the official entry page about
 * Den Grønne Trepart on the kommune's OWN domain (or "Ingen fundet").
 * Each URL in the CSV was confirmed to resolve and to be about grøn trepart.
 *
 * kode is resolved by matching the CSV `kommune` column against the kommune
 * list in public/data/dashboard-summary.json, using an ASCII-folded name
 * (æ→ae, ø→oe, å→aa) so the curated CSV can stay diacritic-free.
 *
 * Run via: npm run build-trepart-links
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, '..');
const CSV_PATH = path.join(REPO, 'data', 'kommune-trepart-links.csv');
const KOMMUNE_SRC = path.join(REPO, 'public', 'data', 'dashboard-summary.json');
const OUT_PATH = path.join(REPO, 'public', 'data', 'kommune-trepart-links.json');

/** Fold Danish diacritics to ASCII and lowercase, for name matching. */
function fold(name) {
  return name
    .toLowerCase()
    .replaceAll('æ', 'ae')
    .replaceAll('ø', 'oe')
    .replaceAll('å', 'aa')
    .trim();
}

/** Minimal CSV parser (handles quoted fields with commas). */
function parseCsv(raw) {
  const rows = [];
  let field = '';
  let row = [];
  let inQuotes = false;
  for (let i = 0; i < raw.length; i++) {
    const c = raw[i];
    if (inQuotes) {
      if (c === '"' && raw[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') inQuotes = false;
      else field += c;
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      row.push(field); field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && raw[i + 1] === '\n') i++;
      if (field !== '' || row.length > 0) { row.push(field); rows.push(row); }
      field = ''; row = [];
    } else {
      field += c;
    }
  }
  if (field !== '' || row.length > 0) { row.push(field); rows.push(row); }
  return rows;
}

const kommuner = JSON.parse(fs.readFileSync(KOMMUNE_SRC, 'utf8')).national.byKommune;
const kodeByFolded = new Map(kommuner.map((k) => [fold(k.navn), k.kode]));
const nameByKode = new Map(kommuner.map((k) => [k.kode, k.navn]));

const rows = parseCsv(fs.readFileSync(CSV_PATH, 'utf8'));
const header = rows.shift().map((h) => h.trim());
const col = (name) => header.indexOf(name);
const iKommune = col('kommune');
const iUrl = col('url');
const iType = col('sidetype');
const iVerified = col('bekraeftet');
const iNote = col('note');

const links = {};
const unmatched = [];
let withPage = 0;

for (const r of rows) {
  if (r.length === 0 || !r[iKommune]) continue;
  const csvName = r[iKommune].trim();
  const kode = kodeByFolded.get(fold(csvName));
  if (!kode) { unmatched.push(csvName); continue; }
  const url = (r[iUrl] ?? '').trim();
  links[kode] = {
    navn: nameByKode.get(kode),
    url: url || null,
    sidetype: (r[iType] ?? '').trim(),
    verified: (r[iVerified] ?? '').trim().toLowerCase() === 'ja',
    // note is the last column; any unquoted commas inside it produce extra
    // fields, so re-join everything from the note column onward.
    note: r.slice(iNote).join(',').trim(),
  };
  if (url) withPage++;
}

if (unmatched.length) {
  console.error(`✗ ${unmatched.length} kommuner in CSV did not match a kode:`, unmatched.join(', '));
  process.exit(1);
}

const missing = kommuner.filter((k) => !links[k.kode]).map((k) => k.navn);
if (missing.length) {
  console.error(`✗ ${missing.length} kommuner missing from CSV:`, missing.join(', '));
  process.exit(1);
}

const out = {
  generatedAt: new Date().toISOString(),
  source: 'data/kommune-trepart-links.csv (manuelt kurateret, verificeret)',
  count: Object.keys(links).length,
  withPage,
  links,
};

fs.writeFileSync(OUT_PATH, JSON.stringify(out, null, 2) + '\n');
console.log(`✓ Wrote ${OUT_PATH} — ${out.count} kommuner, ${withPage} med side`);
