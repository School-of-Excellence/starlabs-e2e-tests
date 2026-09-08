#!/usr/bin/env node
/**
 * Routable-dialog checker — finds routes that CANNOT load.
 *
 * A component that injects MAT_DIALOG_DATA / MatDialogRef without @Optional can only be constructed
 * inside a MatDialog. If such a component is also registered in app.routes.ts, navigating to that route
 * throws before it mounts:
 *     NullInjectorError: No provider for InjectionToken MatMdcDialogData
 * The guard admits the navigation first, so the user gets a blank page rather than a redirect or an error.
 *
 * WHY THIS EXISTS: three of these were found one at a time, by writing a spec and watching it die —
 * PlaylistConfigurationComponent (content CN-20), JourneycoachOpportunitiesComponent (journey JP-20) and
 * OnboardingRemarkComponent. Each cost a full recon-and-run cycle to diagnose. This finds them all in a
 * second, so the next one is known before anyone writes a spec for it.
 *
 * These routes are NOT gaps to close with a test and NOT scope exclusions — they are defects. The
 * convention in this repo is a `test.fail()` case carrying the assertion that should hold once fixed
 * (see content/content-upload-v2.spec.ts CN-20, journey/coach-dashboards.spec.ts JP-20), so the fix
 * arrives with its test and the annotation flips to "expected to fail, but passed" the day it lands.
 *
 * Usage:
 *   node scripts/check-routable-dialogs.mjs --app ../starlabs-development
 *
 * Exit 1 if any routed dialog-only component is found.
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

const routesSrc = fs.readFileSync(path.join(APP, 'src/app/app.routes.ts'), 'utf8');

const findings = [];
for (const raw of routesSrc.split('\n')) {
  const line = raw.trim();
  if (line.startsWith('//') || line.startsWith('*')) continue;      // commented-out route entries
  const p = line.match(/path\s*:\s*['"]([^'"]*)['"]/);
  const imp = line.match(/import\(\s*['"]\.\/([^'"]+)['"]/);
  if (!p || !imp || p[1] === '**') continue;

  const file = path.join(APP, 'src/app', imp[1] + '.ts');
  if (!fs.existsSync(file)) continue;

  // Ignore commented-out constructor blocks — several of these components carry an older copy of
  // themselves at the bottom of the file, fully commented, which would otherwise report a false hit.
  const active = fs.readFileSync(file, 'utf8')
    .split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');

  const injectsData = /@Inject\(\s*MAT_DIALOG_DATA/.test(active);
  const guarded = /@Optional\(\)\s*@Inject\(\s*MAT_DIALOG_DATA/.test(active);
  const injectsRef = /:\s*MatDialogRef\b/.test(active);

  if ((injectsData && !guarded) || (injectsRef && !/@Optional\(\)[^;]*MatDialogRef/.test(active) && injectsData)) {
    findings.push({ route: '/' + p[1], file: path.relative(APP, file).replace(/\\/g, '/') });
  }
}

// Group by component — one component can be registered under several paths, and the fix is per component.
const byFile = new Map();
for (const f of findings) {
  if (!byFile.has(f.file)) byFile.set(f.file, []);
  byFile.get(f.file).push(f.route);
}

console.log(`\nApp: ${APP}`);
console.log(`\n── Routed components that can only work as a dialog (${byFile.size} component${byFile.size === 1 ? '' : 's'}, ${findings.length} route${findings.length === 1 ? '' : 's'}) ──`);
if (!byFile.size) console.log('  none — every routed component can be constructed by the router');
for (const [file, routes] of byFile) {
  console.log(`  ✗ ${routes.join('  ')}`);
  console.log(`      ${file}`);
}

console.log(
  findings.length
    ? '\nThese routes cannot load. Cover each with a test.fail() case carrying the assertion that should\n' +
      'hold once fixed — do NOT fence them (they are defects, not scope) and do NOT count them as gaps.\n'
    : '\nOK — no routed dialog-only components\n'
);
process.exit(findings.length ? 1 : 0);
