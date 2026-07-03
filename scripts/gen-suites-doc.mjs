#!/usr/bin/env node
// gen-suites-doc.mjs — render SUITES.md from suites-manifest.json (plan §3).
// SUITES.md is GENERATED — never hand-edit it; edit the manifest and re-run:
//   node scripts/gen-suites-doc.mjs
import { readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const m = JSON.parse(readFileSync(join(root, 'suites-manifest.json'), 'utf8'));

const lines = [];
lines.push('# Test Suites Catalogue');
lines.push('');
lines.push('> GENERATED from [`suites-manifest.json`](suites-manifest.json) by `scripts/gen-suites-doc.mjs` — do not hand-edit.');
lines.push('> The manifest (hub git @ main) is the single source of truth; it is mirrored one-way to Firestore');
lines.push('> `console-config/suites` for the console. Master plan: specs/plans/2026-07-02-test-orchestration-cf-rollout-architecture.md');
lines.push('');
lines.push('| Suite | Title | CI-ready | Capture | Mandatory when (app paths) | CF paths |');
lines.push('|---|---|---|---|---|---|');
for (const [key, s] of Object.entries(m.suites)) {
  const app = (s.appPaths ?? []).map((p) => '`' + p + '`').join('<br>') || '—';
  const cf = (s.cfPaths ?? []).map((p) => '`' + p + '`').join('<br>') || '—';
  lines.push(`| **${key}** | ${s.title} | ${s.ciReady ? '✅' : '❌ local-only'} | ${s.capture} | ${app} | ${cf} |`);
}
lines.push('');
lines.push('## Cross-cutting paths (any match ⇒ ALL CI-ready suites run)');
lines.push('');
for (const p of m.crossCutting?.appPaths ?? []) lines.push(`- app: \`${p}\``);
for (const p of m.crossCutting?.cfPaths ?? []) lines.push(`- cf: \`${p}\``);
lines.push('');
lines.push('## Areas (sub-routing)');
lines.push('');
for (const [key, s] of Object.entries(m.suites)) {
  const areas = Object.entries(s.areas ?? {}).filter(([k]) => !k.startsWith('_'));
  if (!areas.length) continue;
  lines.push(`### ${key}`);
  for (const [name, a] of areas) {
    lines.push(`- **${name}** → \`${a.only}\``);
  }
  lines.push('');
}
lines.push('## CF predeploy gate (local, before every `firebase deploy`)');
lines.push('');
lines.push(`${m.cfPredeploy.description}`);
lines.push('');
for (const s of m.cfPredeploy.specs) lines.push(`- \`${s}\` (config \`${m.cfPredeploy.config}\`)`);
lines.push('');
const notes = Object.entries(m.suites).filter(([, s]) => s.reviewNote);
if (notes.length) {
  lines.push('## ⚠ Pending glob review (operator checklist §7.4)');
  lines.push('');
  for (const [key, s] of notes) lines.push(`- **${key}** — ${s.reviewNote}`);
  lines.push('');
}
writeFileSync(join(root, 'SUITES.md'), lines.join('\n'));
console.log(`SUITES.md written (${Object.keys(m.suites).length} suites).`);
