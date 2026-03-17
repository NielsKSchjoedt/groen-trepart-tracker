/**
 * Generates CHANGELOG.md from src/lib/changelog.json.
 *
 * Usage:
 *   mise run changelog   (preferred)
 *   npm run changelog    (alternative)
 *
 * Run this after every edit to changelog.json.
 * The output file (CHANGELOG.md) is auto-generated — do not edit it manually.
 */

import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

const TYPE_LABELS = {
  feature:     'Ny funktion',
  improvement: 'Forbedring',
  fix:         'Fejlrettelse',
  data:        'Dataopdatering',
  method:      'Metodeændring',
  removed:     'Fjernet',
};

const TYPE_ORDER = ['fix', 'method', 'feature', 'improvement', 'data', 'removed'];

function formatDate(isoDate) {
  const [year, month, day] = isoDate.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.toLocaleDateString('da-DK', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

function groupByType(changes) {
  const grouped = {};
  for (const change of changes) {
    if (!grouped[change.type]) grouped[change.type] = [];
    grouped[change.type].push(change);
  }
  return grouped;
}

function renderEntry(entry) {
  const lines = [];
  lines.push(`## ${entry.version} — ${formatDate(entry.date)}`);
  lines.push('');
  lines.push(`**${entry.summary}**`);
  lines.push('');

  const grouped = groupByType(entry.changes);
  const types = TYPE_ORDER.filter((t) => grouped[t]);

  for (const type of types) {
    lines.push(`### ${TYPE_LABELS[type]}`);
    for (const change of grouped[type]) {
      const issue = change.issueUrl ? ` ([link](${change.issueUrl}))` : '';
      lines.push(`- ${change.description}${issue}`);
    }
    lines.push('');
  }

  // Ensure there's a trailing blank line before the separator
  if (lines[lines.length - 1] !== '') lines.push('');

  return lines.join('\n');
}

const changelog = JSON.parse(
  readFileSync(resolve(root, 'src/lib/changelog.json'), 'utf-8')
);

const header = `# Ændringslog

> **Auto-genereret** fra [\`src/lib/changelog.json\`](src/lib/changelog.json). Rediger ikke denne fil direkte.
> Tilføj nye versioner i \`src/lib/changelog.json\` og kør \`mise run changelog\`.

Her dokumenterer vi alle væsentlige ændringer til dette website og de data det viser.

**Gennemsigtighedsprincip:** Fejlrettelser og korrektioner dokumenteres med mindst samme prominens som nye funktioner. Hvis vi opdager en fejl i et tal, en beregning eller en visning, beskriver vi klart hvad der var forkert og hvad der er rettet. Det er ikke pinligt at have fejl — det er uigennemsigtigt ikke at sige det højt.

**Sproget her er skrevet til alle** — journalister, borgere og interesserede. Tekniske detaljer fremgår som sekundære noter i parentes.

---

## Ikke frigivet endnu

Kommende ændringer noteres her løbende.

---

`;

const body = changelog.map(renderEntry).join('---\n\n');

const footer = `---

## v0.0.0 — 1. januar 2025

Projektskabelon oprettet. Ingen funktionel release.
`;

writeFileSync(resolve(root, 'CHANGELOG.md'), header + body + footer, 'utf-8');

// Sync package.json version with the latest changelog entry (strip leading "v")
const pkgPath = resolve(root, 'package.json');
const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
const latestVersion = changelog[0]?.version?.replace(/^v/, '') ?? pkg.version;
if (pkg.version !== latestVersion) {
  pkg.version = latestVersion;
  writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf-8');
  console.log(`✓ package.json version updated to ${latestVersion}`);
}

console.log(`✓ CHANGELOG.md generated from ${changelog.length} entries (latest: ${changelog[0]?.version})`);
