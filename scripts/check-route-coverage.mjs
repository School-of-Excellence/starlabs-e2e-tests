#!/usr/bin/env node
/**
 * Route coverage checker — the EXECUTION-side companion to check-suite-coverage.mjs.
 *
 * check-suite-coverage.mjs answers "would a change here route a suite?" (path matching).
 * This answers the stronger question: "does any spec actually OPEN this screen?"
 *
 * Method:
 *   1. Parse src/app/app.routes.ts   -> route path + the src/app/<Module> that serves it.
 *   2. Parse every spec/helper in the suite dirs -> the routes they page.goto().
 *   3. Join. Report per-module visited/total, and the unvisited routes.
 *
 * Routes built from variables (`goto(\`/${route}\`)`) cannot be resolved statically and
 * are listed separately — treat that list as "manually confirm", not as coverage.
 *
 * Usage:
 *   node scripts/check-route-coverage.mjs --app ../starlabs-development
 *   node scripts/check-route-coverage.mjs --app ../starlabs-development --module ATC
 *   node scripts/check-route-coverage.mjs --app ../starlabs-development --json
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
const ONLY_MODULE = arg('module', null);
const AS_JSON = process.argv.includes('--json');

const manifest = JSON.parse(fs.readFileSync(path.join(HUB, 'suites-manifest.json'), 'utf8'));
const SUITE_DIRS = [...new Set(Object.values(manifest.suites).map((s) => s.specDir))];

// ---------------------------------------------------------------- 1. routes
const routesFile = path.join(APP, 'src/app/app.routes.ts');
const routesSrc = fs.readFileSync(routesFile, 'utf8');

const routes = []; // { route, module, line }
routesSrc.split('\n').forEach((raw, i) => {
  const line = raw.trim();
  if (line.startsWith('//') || line.startsWith('*')) return; // commented-out blocks
  // A route entry contributes a path; the nearest import() on the same line names the module.
  const pathM = line.match(/path\s*:\s*['"]([^'"]*)['"]/);
  if (!pathM) return;
  const impM = line.match(/import\(\s*['"]\.\/([^'"]+)['"]/);
  if (!impM) return; // redirectTo / component-less parents
  const p = pathM[1];
  if (p === '**' || p === '') return;
  const module = 'src/app/' + impM[1].split('/')[0];
  routes.push({ route: '/' + p, module, line: i + 1 });
});

// ------------------------------------------------------------- 2. spec gotos
function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.(ts|cjs|mjs|js)$/.test(e.name)) out.push(p);
  }
  return out;
}
// _support/excluded-routes.ts is a DENYLIST (routes tests must never navigate to,
// "sensitive ATC data — D-001"). Its route literals are the opposite of visits, so it
// must never be read as a coverage source — doing so scored all 15 ATC routes as
// covered when the codebase forbids visiting them.
const DENYLIST_FILE = path.join(HUB, '_support/excluded-routes.ts');
const specFiles = [...SUITE_DIRS, '_shared', '_support', 'lib', 'support']
  .flatMap((d) => walk(path.join(HUB, d)))
  .filter((f) => path.resolve(f) !== path.resolve(DENYLIST_FILE));

// The denylist is also the project's own authoritative out-of-scope list — parse it so
// those routes leave the denominator instead of showing up as gaps nobody may close.
let denyRoutes = [];
if (fs.existsSync(DENYLIST_FILE)) {
  const src = fs.readFileSync(DENYLIST_FILE, 'utf8');
  const block = src.slice(src.indexOf('ATC_EXCLUDED_ROUTES'), src.indexOf('];', src.indexOf('ATC_EXCLUDED_ROUTES')));
  denyRoutes = [...block.matchAll(/'(\/[^']+)'/g)].map((m) => m[1]);
}
const isDenied = (route) => denyRoutes.some((d) => route === d || route.startsWith(d + '/'));

const visited = new Map(); // normalized route -> Set(spec files)
const dynamic = new Map(); // raw unresolvable goto -> Set(spec files)

// Routes reach the browser two ways: a direct page.goto(), or a string literal handed
// to a helper (openAsActor(page, actor, '/big-dashboard', ...), page objects, route
// tables). Catching only goto() understates coverage badly, so we also take any quoted
// literal that starts with "/" AND matches a route declared in app.routes.ts — the
// intersection keeps false positives near zero.
const declared = new Set(routes.map((r) => r.route));
const declaredBases = new Set(routes.map((r) => '/' + r.route.split('/')[1]));

for (const f of specFiles) {
  const src = fs.readFileSync(f, 'utf8');
  const rel = path.relative(HUB, f).replace(/\\/g, '/');

  for (const m of src.matchAll(/[`'"](\/[A-Za-z0-9_\-/:$.{}]*)[`'"]/g)) {
    let r = m[1].split('?')[0].replace(/\/+$/, '');
    if (!r || r === '/') continue;
    if (declared.has(r) || declaredBases.has('/' + r.split('/')[1])) {
      (visited.get(r) ?? visited.set(r, new Set()).get(r)).add(rel);
    }
  }

  for (const m of src.matchAll(/goto\(\s*[`'"]([^`'"]*)/g)) {
    const raw = m[1];
    // A goto whose FIRST segment is interpolated cannot be resolved statically.
    if (/^\/?\$\{/.test(raw) || raw === '') {
      if (raw !== '/') (dynamic.get(raw) ?? dynamic.set(raw, new Set()).get(raw)).add(rel);
      continue;
    }
    // Normalize: drop query string and any interpolated / :param trailing segments.
    let r = raw.split('?')[0];
    r = r
      .split('/')
      .filter((s, i) => i === 0 || (!s.includes('${') && !s.startsWith(':')))
      .join('/');
    r = r.replace(/\/+$/, '') || '/';
    if (!r.startsWith('/')) r = '/' + r;
    (visited.get(r) ?? visited.set(r, new Set()).get(r)).add(rel);
  }
}

// A spec visiting /foo also exercises the route declared as /foo/:id etc.
const baseOf = (r) => '/' + r.split('/').filter((s) => s && !s.startsWith(':'))[0];
const visitedBases = new Set([...visited.keys()].map(baseOf));
const isVisited = (r) => visited.has(r) || visitedBases.has(baseOf(r));

// -------------------------------------------------------------- 3. join
// Denylisted routes leave the denominator entirely: no one is permitted to test them,
// so counting them as unmet coverage would be measuring against an unreachable target.
const deniedRoutes = routes.filter((r) => isDenied(r.route));
const scopedRoutes = routes.filter((r) => !isDenied(r.route));

const byModule = new Map();
for (const r of scopedRoutes) {
  if (!byModule.has(r.module)) byModule.set(r.module, { total: [], hit: [], miss: [] });
  const b = byModule.get(r.module);
  b.total.push(r);
  (isVisited(r.route) ? b.hit : b.miss).push(r);
}

// Which suite (if any) claims this module, per the manifest globs?
const claimedBy = (module) => {
  const owners = [];
  for (const [key, s] of Object.entries(manifest.suites)) {
    if ((s.appPaths ?? []).some((g) => g.startsWith(module + '/'))) owners.push(key);
  }
  return owners;
};

// Deliberately out of scope (manifest.excluded) — reported apart from real gaps.
const exGlobs = Object.keys(manifest.excluded?.appPaths ?? {}).map((g) => g.replace(/\/\*+$/, ''));
// A module is out of scope if the manifest excludes it OR every route it serves is on
// the _support/excluded-routes.ts denylist.
const isExcluded = (module) =>
  exGlobs.includes(module) || byModule.get(module).total.every((r) => isDenied(r.route));

const rows = [...byModule.entries()]
  .map(([module, b]) => ({
    module,
    total: b.total.length,
    hit: b.hit.length,
    miss: b.miss.filter((r) => !isDenied(r.route)).length,
    pct: Math.round((b.hit.length / b.total.length) * 100),
    suites: claimedBy(module),
    excluded: isExcluded(module),
    // Gaps a test is FORBIDDEN to close are reported apart from gaps someone can act on.
    denied: b.miss.filter((r) => isDenied(r.route)).map((r) => r.route),
    missing: b.miss.filter((r) => !isDenied(r.route)).map((r) => r.route),
  }))
  .sort((a, b) => Number(a.excluded) - Number(b.excluded) || a.pct - b.pct || b.total - a.total);

if (AS_JSON) {
  console.log(JSON.stringify({ rows, dynamic: [...dynamic.keys()] }, null, 2));
  process.exit(0);
}

const shown = ONLY_MODULE ? rows.filter((r) => r.module.endsWith('/' + ONLY_MODULE)) : rows;

const totalRoutes = routes.length;
const totalHit = rows.reduce((n, r) => n + r.hit, 0);
const exRoutes = rows.filter((r) => r.excluded).reduce((n, r) => n + r.total, 0) + deniedRoutes.length;
const inScope = totalRoutes - exRoutes;

console.log(`\nApp: ${APP}`);
console.log(`${totalRoutes} routed screens · ${exRoutes} deliberately excluded · ${inScope} in scope`);
console.log(`In-scope route coverage: ${totalHit}/${inScope} = ${Math.round((totalHit / inScope) * 100)}%  (${inScope - totalHit} never opened)\n`);

console.log('  cov   hit/tot  module                                    claimed by suite');
console.log('  ----  -------  ----------------------------------------  ----------------');
for (const r of shown) {
  const bar = r.excluded ? '   —' : String(r.pct).padStart(3) + '%';
  const flag = r.excluded
    ? '  · excluded by design'
    : r.hit === 0 && r.suites.length === 0
      ? '  ← no suite, never opened'
      : r.hit === 0
        ? '  ← claimed but never opened'
        : '';
  console.log(
    `  ${bar}  ${String(r.hit).padStart(3)}/${String(r.total).padEnd(3)}  ${r.module.replace('src/app/', '').padEnd(40)}  ${(r.suites.join(',') || '—').padEnd(16)}${flag}`
  );
}

if (ONLY_MODULE) {
  for (const r of shown) {
    console.log(`\nUnvisited routes in ${r.module} (${r.miss}):`);
    r.missing.forEach((m) => console.log(`  ✗ ${m}`));
  }
}

if (dynamic.size) {
  console.log(`\n── goto() targets built from variables — resolve by hand (${dynamic.size}) ──`);
  for (const [raw, files] of dynamic) console.log(`  ? ${raw}   [${[...files].join(', ')}]`);
}
console.log('');
