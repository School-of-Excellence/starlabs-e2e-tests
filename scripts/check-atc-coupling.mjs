#!/usr/bin/env node
/**
 * ATC coupling scanner — the SCOPE checker, third of the trio.
 *
 *   check-suite-coverage.mjs  — would a change here route a suite?      (routing)
 *   check-route-coverage.mjs  — does any spec actually open this screen? (execution)
 *   check-atc-coupling.mjs    — is this screen allowed to be tested AT ALL?  (scope)
 *
 * WHY THIS EXISTS: the app CLAUDE.md constraint is "ATC data is OFF-LIMITS ... Exclude all
 * src/app/ATC/** components AND ATC READERS from the test pipeline." The readers are the hard part —
 * on 2026-09-04 three of them were found only because someone opened the screens:
 *   /viewrubrics_scoring_atc            (component name says ATC; route name half-says it)
 *   /evolution-prep-participants        ("Diagnostics Queue — Participant Flow" — reads
 *                                        queue_atc_generation from a SEPARATE ATC db handle)
 *   /evolution-prep-participants-v2     (renders as "ATC Transcript Ops")
 * A spec was written and passing against the second one before its ATC database handle was noticed.
 * Nothing mechanical would have caught that, so: this.
 *
 * It maps every route to its component, scans that component for ATC-data coupling, and reports any
 * route that is coupled but NOT yet excluded. Exit 1 when such a route exists.
 *
 * Usage:
 *   node scripts/check-atc-coupling.mjs --app ../starlabs-development
 *   node scripts/check-atc-coupling.mjs --app ../starlabs-development --all   (also list excluded hits)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HUB = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const arg = (n, d) => {
  const i = process.argv.indexOf(`--${n}`);
  return i > -1 ? process.argv[i + 1] : d;
};
const APP = path.resolve(HUB, arg('app', '../starlabs-development'));
const SHOW_ALL = process.argv.includes('--all');

// ---------------------------------------------------------------- what counts as ATC DATA
// From the app CLAUDE.md off-limits list, plus the two queue-side ATC generation collections found in
// the wild. Matched case-insensitively against the string literal inside a collection()/doc() call.
const ATC_DATA = [
  'atc_alpha', 'atc_initiated', 'atc_notes', 'atc_to_validate',
  'ai_generated_atc_summary', 'ai_generated_atc_summary_backup',
  'triple atc', 'temporary_tripleatc', 'atc assignment', 'big temporary_atc',
  '0 atcinvolved issue', 'queue_atc_generation', 'queue_atc_generation_backup',
];

// CLAUDE.md: "Reference-only config (`atc taxonomy`, `atc model`, `atcmodel level config`) is safe."
// These must NOT trigger a finding or the checker cries wolf on legitimately testable screens.
const ATC_SAFE = ['atc taxonomy', 'atc model', 'atcmodel level config', 'atcmodel_level_config'];

const isSafe = (name) => ATC_SAFE.some((s) => name.toLowerCase().includes(s));
const isAtcData = (name) => {
  const n = name.toLowerCase();
  if (isSafe(n)) return false;
  return ATC_DATA.some((d) => n.includes(d));
};

// ---------------------------------------------------------------- routes -> component FILE
const routesSrc = fs.readFileSync(path.join(APP, 'src/app/app.routes.ts'), 'utf8');
const routes = [];
routesSrc.split('\n').forEach((raw) => {
  const line = raw.trim();
  if (line.startsWith('//') || line.startsWith('*')) return;
  const p = line.match(/path\s*:\s*['"]([^'"]*)['"]/);
  const imp = line.match(/import\(\s*['"]\.\/([^'"]+)['"]/);
  if (!p || !imp || p[1] === '**' || p[1] === '') return;
  routes.push({ route: '/' + p[1], file: path.join(APP, 'src/app', imp[1] + '.ts') });
});

// ---------------------------------------------------------------- already-excluded knowledge
const manifest = JSON.parse(fs.readFileSync(path.join(HUB, 'suites-manifest.json'), 'utf8'));
// manifest.FENCED — an array of globs, shared with scripts/readiness. (Reconciled from a duplicate
// `excluded` key at the manoja merge; do not reintroduce it.)
const exGlobs = (manifest.fenced?.appPaths ?? []).map((g) => g.replace(/\/\*+$/, ''));

const DENY_FILE = path.join(HUB, '_support/excluded-routes.ts');
let deny = [];
if (fs.existsSync(DENY_FILE)) {
  const s = fs.readFileSync(DENY_FILE, 'utf8');
  const i = s.indexOf('ATC_EXCLUDED_ROUTES');
  deny = [...s.slice(i, s.indexOf('];', i)).matchAll(/'(\/[^']+)'/g)].map((m) => m[1]);
}
const isExcluded = (r, file) =>
  deny.some((d) => r === d || r.startsWith(d + '/')) ||
  exGlobs.some((g) => file.replace(/\\/g, '/').includes(g.replace('src/app/', '/src/app/')));

// ---------------------------------------------------------------- scan one component
function scan(file) {
  const hits = { collections: new Set(), handles: new Set(), title: new Set() };
  if (!fs.existsSync(file)) return hits;
  const ts = fs.readFileSync(file, 'utf8');

  // 1. STRONG — an ATC data collection/doc read anywhere in the component.
  for (const m of ts.matchAll(/(?:collection|doc)\s*\(\s*[^,)]+,\s*['"`]([^'"`]+)['"`]/g)) {
    if (isAtcData(m[1])) hits.collections.add(m[1]);
  }
  // Also catch collection(atcDb, coll) style, where the NAME is a variable but the HANDLE is ATC.
  // `atc` must start the identifier or follow a non-letter/camel boundary — otherwise `chatCollection`
  // matches on its "ch-atC-ollection" substring and every support-chat screen is flagged.
  const atcIdent = (s) => /^atc|[^a-zA-Z]atc|ATC|[a-z]Atc/.test(s);
  for (const m of ts.matchAll(/(?:collection|doc)\s*\(\s*([A-Za-z_$][\w$]*)\s*,/g)) {
    if (atcIdent(m[1])) hits.handles.add(m[1]);
  }
  // 2. STRONG — a secondary Firestore/app handle named for ATC (a separate ATC database).
  // Anchored to a single line: an unbounded [^)]* runs across newlines and swallows whole constructors,
  // reporting a page of source as the "handle".
  for (const m of ts.matchAll(/(?:getApp|getFirestore|initializeApp)\s*\(\s*['"`]([^'"`\n]*atc[^'"`\n]*)['"`]/gi)) {
    hits.handles.add(m[1]);
  }

  // 3. WEAK — the screen PRESENTS as ATC (heading/title text in the template). This is what made
  //    /evolution-prep-participants-v2 obvious to a human ("ATC Transcript Ops") while its collection
  //    reads looked innocuous. Reported separately: a weak hit alone is a prompt to look, not a verdict.
  const html = file.replace(/\.ts$/, '.html');
  if (fs.existsSync(html)) {
    const h = fs.readFileSync(html, 'utf8');
    for (const m of h.matchAll(/<h[1-6][^>]*>([^<]*\bATC\b[^<]*)</gi)) hits.title.add(m[1].trim());
  }
  return hits;
}

// ---------------------------------------------------------------- report
const strong = [];
const weak = [];
for (const r of routes) {
  const h = scan(r.file);
  const isStrong = h.collections.size || h.handles.size;
  const isWeak = h.title.size;
  if (!isStrong && !isWeak) continue;
  const rec = { ...r, h, excluded: isExcluded(r.route, r.file) };
  (isStrong ? strong : weak).push(rec);
}

const line = (s) => console.log(s);
const rel = (f) => path.relative(APP, f).replace(/\\/g, '/');

line(`\nApp: ${APP}`);
line(`${routes.length} routed screens scanned for ATC coupling\n`);

const unexcludedStrong = strong.filter((r) => !r.excluded);
line(`── ATC-COUPLED and NOT excluded (${unexcludedStrong.length}) ──`);
if (!unexcludedStrong.length) line('  none — every ATC-coupled route is already out of scope');
for (const r of unexcludedStrong) {
  line(`  ✗ ${r.route}   ${rel(r.file)}`);
  if (r.h.collections.size) line(`      collections: ${[...r.h.collections].join(', ')}`);
  if (r.h.handles.size) line(`      atc handle:  ${[...r.h.handles].join(', ')}`);
}

const unexcludedWeak = weak.filter((r) => !r.excluded);
line(`\n── PRESENTS as ATC in its own headings — review (${unexcludedWeak.length}) ──`);
if (!unexcludedWeak.length) line('  none');
for (const r of unexcludedWeak) line(`  ? ${r.route}   "${[...r.h.title][0]}"   ${rel(r.file)}`);

if (SHOW_ALL) {
  const done = [...strong, ...weak].filter((r) => r.excluded);
  line(`\n── ATC-coupled and correctly excluded (${done.length}) ──`);
  for (const r of done) line(`  · ${r.route}`);
}

line(`\n${unexcludedStrong.length === 0 ? 'OK — no ATC-coupled route is in the test scope' : `${unexcludedStrong.length} route(s) need an exclusion decision`}\n`);
process.exit(unexcludedStrong.length === 0 ? 0 : 1);
