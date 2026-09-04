#!/usr/bin/env node
/**
 * readiness.cjs — "is this diff testable?" — the suite-alignment status.
 *
 * Answers, for one branch, in seconds, with no build / emulator / network:
 *   • do CI-ready suites cover every changed app path?
 *   • do the selectors those suites drive still exist in the app?
 *   • did this diff add a component that no spec references?
 *
 * VERDICTS
 *   MATCHED               suites cover the diff and every selector still resolves → safe to test
 *   SUITES_MISSING        one or more changed paths have no suite in the hub
 *   NEEDS_UPDATE          a suite covers the path but has drifted from the code
 *   NO_COVERAGE_POSSIBLE  the diff touches a fenced area (ATC) — never automatable
 *   NOT_APPLICABLE        docs / workflow files only
 *
 * USAGE
 *   node scripts/readiness/readiness.cjs                        # local, against ./app, vs development
 *   node scripts/readiness/readiness.cjs --base development --head HEAD
 *   node scripts/readiness/readiness.cjs --app /path/to/app --json
 *   node scripts/readiness/readiness.cjs --files "a.ts,b.html"  # explicit list (CI / tests)
 *
 * Exit code is ALWAYS 0 — this reports a status, it does not gate anything (yet).
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const lib = require('./lib.cjs');

const HUB_ROOT = path.resolve(__dirname, '..', '..');

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}
const has = (name) => process.argv.includes(`--${name}`);

const APP_ROOT = path.resolve(arg('app', process.env.APP_PATH || path.join(HUB_ROOT, 'app')));
const BASE = arg('base', process.env.BASE_REF || 'development');
const HEAD = arg('head', process.env.HEAD_REF || 'HEAD');
const MANIFEST = path.join(HUB_ROOT, 'suites-manifest.json');

/** Changed files as `[{status, file}]`, from git or from --files. */
function changedFiles() {
  const explicit = arg('files', process.env.CHANGED_FILES);
  if (explicit) {
    return explicit
      .split(/[,\n]/)
      .map((f) => f.trim())
      .filter(Boolean)
      .map((file) => ({ status: 'M', file }));
  }
  const out = execFileSync('git', ['diff', '--name-status', `${BASE}...${HEAD}`], {
    cwd: APP_ROOT,
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
  });
  return lib.parseNameStatus(out);
}

function main() {
  if (!fs.existsSync(APP_ROOT)) {
    console.error(`app path not found: ${APP_ROOT} (pass --app or set APP_PATH)`);
    process.exit(0);
  }
  const manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));

  let entries;
  try {
    entries = changedFiles();
  } catch (err) {
    console.error(`could not diff ${BASE}...${HEAD} in ${APP_ROOT}: ${err.message}`);
    process.exit(0);
  }

  const files = entries.map((e) => e.file);
  const added = entries.filter((e) => e.status === 'A').map((e) => e.file);

  const classified = lib.classifyChanges(manifest, files);
  const drift = classified.suites.length
    ? lib.findDriftedSelectors(HUB_ROOT, APP_ROOT, manifest, classified.suites)
    : { checked: 0, drifted: [] };
  const newComponents = added.length
    ? lib.findUntestedNewComponents(APP_ROOT, HUB_ROOT, manifest, added)
    : [];

  // Element-level: what did this diff add, and does any spec exercise it?
  // `readBase` gives the file as it was at the base ref, so "new" means new in THIS diff.
  const readBase = (rel) => {
    try {
      return execFileSync('git', ['show', `${BASE}:${rel}`], {
        cwd: APP_ROOT,
        encoding: 'utf8',
        maxBuffer: 32 * 1024 * 1024,
        stdio: ['ignore', 'pipe', 'ignore'],
      });
    } catch {
      return ''; // did not exist at base → everything in it is new
    }
  };
  const appFiles = classified.covered
    .map((c) => c.file)
    .concat(classified.uncovered)
    .filter((f) => /\.(ts|html)$/.test(f));
  const elements = appFiles.length
    ? lib.analyzeElements({ appRoot: APP_ROOT, hubRoot: HUB_ROOT, manifest, changedFiles: appFiles, readBase })
    : [];

  const verdict = lib.verdictOf({ classified, drift, newComponents, elements });

  const result = {
    verdict,
    base: BASE,
    head: HEAD,
    changedFileCount: files.length,
    suites: classified.suites,
    covered: classified.covered,
    uncovered: classified.uncovered,
    fenced: classified.fenced,
    neutral: classified.neutral,
    crossCutting: classified.crossCutting,
    selectorsChecked: drift.checked,
    drift: drift.drifted,
    newComponents,
    elements,
    canProceed: lib.canProceed(verdict),
  };

  if (has('json')) {
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
    return;
  }

  process.stdout.write(render(result) + '\n');
  if (process.env.GITHUB_STEP_SUMMARY) {
    fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, render(result, true) + '\n');
  }
  if (process.env.GITHUB_OUTPUT) {
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `verdict=${verdict}\n`);
    fs.appendFileSync(
      process.env.GITHUB_OUTPUT,
      `payload=${JSON.stringify({
        state: verdict,
        canProceed: result.canProceed,
        sha: process.env.GITHUB_SHA,
        checkedAt: Date.now(),
        suites: result.suites,
        crossCutting: result.crossCutting ? result.crossCutting.file : null,
        details: {
          uncovered: result.uncovered,
          fenced: result.fenced.map((f) => f.file),
          drift: result.drift.map((d) => ({ id: d.id, usedBy: d.usedBy })),
          missingTestCases: result.elements
            .filter((e) => e.untestedNew.length)
            .map((e) => ({ component: e.component, hooks: e.untestedNew })),
          unhookedElements: result.elements
            .filter((e) => e.newUnhooked > 0)
            .map((e) => ({ component: e.component, count: e.newUnhooked })),
          untestedComponents: result.elements.filter((e) => e.noTestAtAll).map((e) => e.component),
          newComponents: result.newComponents.map((c) => c.file),
        },
      })}\n`,
    );
  }
}

const LABEL = {
  MATCHED: '✅ TEST SUITES MATCHED — proceeding to run them',
  SUITES_MISSING: '⛔ CANNOT PROCEED — TEST SUITES MISSING',
  NEEDS_UPDATE: '⛔ CANNOT PROCEED — TEST SUITES NEED UPDATE',
  MISSING_TEST_CASES: '⛔ CANNOT PROCEED — MISSING TEST CASES',
  NOT_APPLICABLE: '— NO APP CODE CHANGED — nothing to test',
  NO_COVERAGE_POSSIBLE: '⛔ CANNOT PROCEED — NO AUTOMATED COVERAGE POSSIBLE',
};

function render(r, md = false) {
  const h = md ? '### ' : '';
  const L = [];
  L.push(`${h}${LABEL[r.verdict]}`);
  L.push('');
  L.push(`diff \`${r.base}...${r.head}\` · ${r.changedFileCount} file(s) changed`);
  L.push('');

  if (r.crossCutting) {
    L.push(`**cross-cutting change** — \`${r.crossCutting.file}\` matched \`${r.crossCutting.glob}\`, so every CI-ready suite applies.`);
    L.push('');
  }
  if (r.suites.length) {
    L.push(`**suites to run:** ${r.suites.map((s) => `\`${s}\``).join(' · ')}`);
    L.push('');
  }
  if (r.uncovered.length) {
    L.push(`**No suite covers ${r.uncovered.length} changed file(s):**`);
    for (const f of r.uncovered.slice(0, 20)) L.push(`- \`${f}\``);
    if (r.uncovered.length > 20) L.push(`- …and ${r.uncovered.length - 20} more`);
    L.push('');
    L.push('_Add a suite in the hub covering these paths, or have an owner accept the gap._');
    L.push('');
  }
  if (r.fenced.length) {
    L.push(`**Fenced — cannot be covered by an automated suite:**`);
    for (const f of r.fenced) L.push(`- \`${f.file}\` (matched \`${f.glob}\`)`);
    L.push('');
  }
  if (r.drift.length) {
    L.push(`**${r.drift.length} selector(s) the suites drive no longer exist in the app:**`);
    for (const d of r.drift) L.push(`- \`${d.id}\` — used by ${d.usedBy.map((f) => `\`${f}\``).join(', ')}`);
    L.push('');
    L.push('_Either the app dropped the hook, or the spec needs updating in the hub._');
    L.push('');
  }
  if (r.newComponents.length) {
    L.push(`**${r.newComponents.length} new component(s) no spec references:**`);
    for (const c of r.newComponents) {
      L.push(`- \`${c.file}\`${c.hooks.length ? ` (hooks: ${c.hooks.map((x) => `\`${x}\``).join(', ')})` : ' — no test hooks at all'}`);
    }
    L.push('');
  }
  // Element-level findings: what this diff added that no spec exercises.
  const missing = (r.elements || []).filter((e) => e.untestedNew.length);
  const unhooked = (r.elements || []).filter((e) => e.newUnhooked > 0);
  const blind = (r.elements || []).filter((e) => e.noTestAtAll && !e.untestedNew.length);
  if (missing.length) {
    L.push(`**Missing test cases — ${missing.reduce((n, e) => n + e.untestedNew.length, 0)} new element(s) no spec references:**`);
    for (const e of missing) {
      L.push(`- \`${e.component}\` → ${e.untestedNew.map((h) => `\`${h}\``).join(', ')}`);
    }
    L.push('');
    L.push('_These hooks exist in the app but no spec drives them. Add the test case in the hub._');
    L.push('');
  }
  if (unhooked.length) {
    L.push(`**New interactive element(s) with no \`data-testid\` — a test could not address them:**`);
    for (const e of unhooked) L.push(`- \`${e.component}\` → ${e.newUnhooked} element(s)`);
    L.push('');
  }
  if (blind.length) {
    L.push(`**Changed component(s) where no element is exercised by any spec:**`);
    for (const e of blind) L.push(`- \`${e.component}\` (${e.hooks} hook(s), 0 referenced)`);
    L.push('');
  }
  const backlog = (r.elements || []).reduce((n, e) => n + e.untestedExisting.length, 0);
  if (backlog && r.verdict !== 'MATCHED') {
    L.push(`_Pre-existing: ${backlog} hook(s) in these files were already untested before this change._`);
    L.push('');
  }

  if (r.verdict === 'MATCHED') {
    L.push(
      r.selectorsChecked
        ? `Checked ${r.selectorsChecked} selector(s) — all present. The diff is safe to test with the suites above.`
        : 'These suites drive no `data-testid` selectors, so there is nothing to drift. The diff is safe to test with the suites above.',
    );
  }
  return L.join('\n');
}

main();
