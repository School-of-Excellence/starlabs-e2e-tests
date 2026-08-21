/**
 * readiness/lib.cjs — pure helpers for the suite-alignment check.
 *
 * Answers two questions about a git diff, with no emulator, no network and no build:
 *   1. COVERAGE  — does a CI-ready suite exist for every changed app path?
 *   2. ALIGNMENT — do the selectors those suites drive still exist in the app?
 *
 * The glob semantics are deliberately identical to console/functions/src/suites.ts
 * (globToRegex / firstMatch) so CI, the console dialog and this script can never disagree.
 */
'use strict';

const fs = require('fs');
const path = require('path');

// --- globs -------------------------------------------------------------------

/**
 * Manifest glob → RegExp. `**` matches any depth, `*` matches within a segment, everything else
 * is literal (folder names with spaces included — "src/app/queue system/**").
 * Mirrors suites.ts globToRegex exactly.
 */
function globToRegex(glob) {
  const escaped = glob
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*/g, ' ')
    .replace(/\*/g, '[^/]*')
    .replace(/ /g, '.*');
  return new RegExp(`^${escaped}$`);
}

/** True when `file` matches any glob in `globs`. */
function matchesAny(file, globs) {
  return (globs || []).some((g) => globToRegex(g).test(file));
}

/** The first glob in `globs` that `file` matches, or null — used to explain a verdict. */
function whichGlob(file, globs) {
  for (const g of globs || []) if (globToRegex(g).test(file)) return g;
  return null;
}

// --- git ---------------------------------------------------------------------

/**
 * Parse `git diff --name-status` output.
 *
 * The format is TAB-separated ("M\tpath", "R100\told\tnew"). Splitting on whitespace would shred
 * every folder name containing a space — and this codebase is full of them ("queue system",
 * "Business Dashboard", "Diagnostics Tool"). Renames/copies report the DESTINATION path.
 */
function parseNameStatus(out) {
  return out
    .split('\n')
    .filter((l) => l.trim())
    .map((l) => {
      const parts = l.split('\t');
      return { status: parts[0][0], file: parts[parts.length - 1] };
    });
}

// --- coverage ----------------------------------------------------------------

/**
 * Bucket every changed file and work out which suites must run.
 *
 *   neutral   docs / workflows / non-app files — never block, never trigger a suite
 *   fenced    can never be covered by an automated suite (ATC — the emulator must not touch it)
 *   covered   a ciReady suite's appPaths matches the file
 *   uncovered matches nothing — the hub has no test for this change
 *
 * A crossCutting match promotes every ciReady suite to mandatory (narrow map, broad fallback).
 */
function classifyChanges(manifest, changedFiles) {
  const ciReady = Object.entries(manifest.suites || {}).filter(([, s]) => s.ciReady);
  const neutralGlobs = (manifest.neutral && manifest.neutral.appPaths) || [];
  const fencedGlobs = (manifest.fenced && manifest.fenced.appPaths) || [];
  const ccGlobs = (manifest.crossCutting && manifest.crossCutting.appPaths) || [];

  const neutral = [];
  const fenced = [];
  const covered = []; // { file, suite, glob }
  const uncovered = [];
  let crossCutting = null;

  for (const file of changedFiles) {
    if (matchesAny(file, neutralGlobs)) {
      neutral.push(file);
      continue;
    }
    if (matchesAny(file, fencedGlobs)) {
      fenced.push({ file, glob: whichGlob(file, fencedGlobs) });
      continue;
    }
    const cc = whichGlob(file, ccGlobs);
    if (cc) crossCutting = crossCutting || { file, glob: cc };

    let hit = null;
    for (const [key, def] of ciReady) {
      const g = whichGlob(file, def.appPaths || []);
      if (g) {
        hit = { file, suite: key, glob: g };
        break;
      }
    }
    if (hit) covered.push(hit);
    else if (!cc) uncovered.push(file);
    else covered.push({ file, suite: '(cross-cutting)', glob: cc });
  }

  const suites = crossCutting
    ? ciReady.map(([k]) => k)
    : [...new Set(covered.map((c) => c.suite).filter((s) => s !== '(cross-cutting)'))];

  // alwaysRun baseline suites ride along whenever anything real changed.
  for (const [key, def] of ciReady) {
    if (def.alwaysRun && (covered.length || uncovered.length) && !suites.includes(key)) {
      suites.push(key);
    }
  }

  return { neutral, fenced, covered, uncovered, suites, crossCutting };
}

// --- selector alignment ------------------------------------------------------

const TESTID_REF = /data-testid\s*=\s*["']([^"'$}{]+)["']|getByTestId\(\s*["']([^"'$}{]+)["']/g;
/** Real hooks are lowercase-kebab; this drops `${…}` interpolation and placeholder junk. */
const VALID_ID = /^[a-z0-9][a-z0-9-]*$/;

function walk(dir, exts, out = [], skip = /node_modules|\.git|dist|test-results|playwright-report|blob-report/) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (skip.test(full)) continue;
    if (e.isDirectory()) walk(full, exts, out, skip);
    else if (exts.some((x) => e.name.endsWith(x))) out.push(full);
  }
  return out;
}

/** Every literal test id the given spec directories reference. */
function selectorsUsedBySuites(hubRoot, manifest, suiteKeys) {
  const used = new Map(); // id -> [files]
  for (const key of suiteKeys) {
    const def = (manifest.suites || {})[key];
    if (!def) continue;
    const dir = path.join(hubRoot, def.specDir || key);
    if (!fs.existsSync(dir)) continue;
    for (const file of walk(dir, ['.ts', '.cjs', '.js'])) {
      const src = fs.readFileSync(file, 'utf8');
      let m;
      TESTID_REF.lastIndex = 0;
      while ((m = TESTID_REF.exec(src))) {
        const id = m[1] || m[2];
        if (!id || !VALID_ID.test(id)) continue;
        if (!used.has(id)) used.set(id, []);
        const list = used.get(id);
        if (!list.includes(file)) list.push(file);
      }
    }
  }
  return used;
}

/** Index every test id the app declares, plus the raw text, for companion-attribute lookups. */
function appSelectorIndex(appRoot) {
  const declared = new Set();
  const blobs = [];
  for (const file of walk(path.join(appRoot, 'src'), ['.html', '.ts'])) {
    const src = fs.readFileSync(file, 'utf8');
    blobs.push(src);
    let m;
    TESTID_REF.lastIndex = 0;
    while ((m = TESTID_REF.exec(src))) {
      const id = m[1] || m[2];
      if (id && VALID_ID.test(id)) declared.add(id);
    }
  }
  return { declared, blobs };
}

/**
 * Selectors a suite drives that the app no longer declares.
 * Two passes: the direct `data-testid="x"` index, then a quoted-literal search so bound forms
 * (`[attr.data-testid]="'x'"`) still resolve.
 */
function findDriftedSelectors(hubRoot, appRoot, manifest, suiteKeys) {
  const used = selectorsUsedBySuites(hubRoot, manifest, suiteKeys);
  const { declared, blobs } = appSelectorIndex(appRoot);
  const drifted = [];
  for (const [id, specFiles] of used) {
    if (declared.has(id)) continue;
    const quoted = [`"${id}"`, `'${id}'`];
    if (blobs.some((b) => quoted.some((q) => b.includes(q)))) continue;
    drifted.push({ id, usedBy: specFiles.map((f) => path.relative(hubRoot, f)) });
  }
  return { checked: used.size, drifted };
}

// --- element-level coverage --------------------------------------------------

/** Every test id declared in a source string. */
function hooksIn(src) {
  const out = new Set();
  if (!src) return out;
  let m;
  TESTID_REF.lastIndex = 0;
  while ((m = TESTID_REF.exec(src))) {
    const id = m[1] || m[2];
    if (id && VALID_ID.test(id)) out.add(id);
  }
  return out;
}

/** Every test id referenced by ANY spec in the hub — "is this element tested anywhere?". */
function allSpecHookRefs(hubRoot, manifest) {
  const ids = new Set();
  for (const key of Object.keys(manifest.suites || {})) {
    const def = manifest.suites[key];
    const dir = path.join(hubRoot, def.specDir || key);
    if (!fs.existsSync(dir)) continue;
    for (const file of walk(dir, ['.ts', '.cjs', '.js'])) {
      for (const id of hooksIn(fs.readFileSync(file, 'utf8'))) ids.add(id);
    }
  }
  return ids;
}

/**
 * Interactive elements a test could never address: an opening tag that is a <button>, or carries a
 * (click)/routerLink handler, but has no data-testid on it. Tag-aware (not line-aware) so Angular
 * templates spanning several lines are handled.
 */
function unhookedInteractive(src) {
  if (!src) return [];
  const found = [];
  const tagRe = /<([a-zA-Z][a-zA-Z0-9-]*)((?:[^<>"']|"[^"]*"|'[^']*')*)>/g;
  let m;
  while ((m = tagRe.exec(src))) {
    const [, tag, attrs] = m;
    const interactive =
      /^(button|a)$/i.test(tag) || /\(click\)|\(change\)|routerLink|\(submit\)/.test(attrs);
    if (!interactive) continue;
    if (/data-testid/.test(attrs)) continue;
    found.push(tag.toLowerCase());
  }
  return found;
}

/** Group a changed file onto its component, so hooks in the .html count for a changed .ts. */
function componentKeyOf(file) {
  const m = file.match(/^(.*)\.component\.(ts|html|css|scss)$/);
  return m ? `${m[1]}.component` : null;
}

/**
 * Element-level coverage for everything this diff touched.
 *
 * Per changed component, comparing the HEAD source against the BASE source:
 *   newHooks         test ids this diff introduced
 *   untestedNew      …of those, the ones no spec anywhere references  → MISSING TEST CASES
 *   untestedExisting pre-existing hooks no spec references            → informational backlog
 *   newUnhooked      interactive elements added with no data-testid    → not addressable by a test
 *
 * `readBase(file)` returns the file's content at the base ref, or '' when it did not exist.
 */
function analyzeElements({ appRoot, hubRoot, manifest, changedFiles, readBase }) {
  const specRefs = allSpecHookRefs(hubRoot, manifest);

  const keys = new Map(); // componentKey|file -> [files]
  for (const f of changedFiles) {
    const key = componentKeyOf(f) || f;
    if (!keys.has(key)) keys.set(key, []);
    keys.get(key).push(f);
  }

  const components = [];
  for (const [key, files] of keys) {
    const parts = componentKeyOf(files[0]) ? ['.ts', '.html'] : [''];
    let headSrc = '';
    let baseSrc = '';
    for (const ext of parts) {
      const rel = componentKeyOf(files[0]) ? `${key}${ext}` : key;
      const abs = path.join(appRoot, rel);
      if (fs.existsSync(abs) && /\.(ts|html)$/.test(rel)) headSrc += fs.readFileSync(abs, 'utf8') + '\n';
      if (/\.(ts|html)$/.test(rel)) baseSrc += (readBase(rel) || '') + '\n';
    }
    if (!headSrc.trim()) continue; // deleted, or not a source file

    const headHooks = hooksIn(headSrc);
    const baseHooks = hooksIn(baseSrc);
    const newHooks = [...headHooks].filter((h) => !baseHooks.has(h));
    const untestedNew = newHooks.filter((h) => !specRefs.has(h));
    const untestedExisting = [...headHooks].filter((h) => baseHooks.has(h) && !specRefs.has(h));
    const newUnhooked = Math.max(
      0,
      unhookedInteractive(headSrc).length - unhookedInteractive(baseSrc).length,
    );
    const testedHooks = [...headHooks].filter((h) => specRefs.has(h));

    components.push({
      component: key,
      hooks: headHooks.size,
      tested: testedHooks.length,
      newHooks,
      untestedNew,
      untestedExisting,
      newUnhooked,
      /** the file changed but NOTHING in it is exercised by any spec */
      noTestAtAll: headHooks.size > 0 && testedHooks.length === 0,
    });
  }
  return components;
}

/**
 * Components added in this diff whose hooks no spec references — a new screen inside an
 * already-covered folder passes the coverage check while nothing actually tests it.
 */
function findUntestedNewComponents(appRoot, hubRoot, manifest, addedFiles) {
  const specIds = new Set();
  for (const key of Object.keys(manifest.suites || {})) {
    const def = manifest.suites[key];
    const dir = path.join(hubRoot, def.specDir || key);
    if (!fs.existsSync(dir)) continue;
    for (const file of walk(dir, ['.ts', '.cjs', '.js'])) {
      const src = fs.readFileSync(file, 'utf8');
      let m;
      TESTID_REF.lastIndex = 0;
      while ((m = TESTID_REF.exec(src))) {
        const id = m[1] || m[2];
        if (id && VALID_ID.test(id)) specIds.add(id);
      }
    }
  }

  const flagged = [];
  for (const rel of addedFiles.filter((f) => f.endsWith('.component.ts'))) {
    const base = rel.replace(/\.ts$/, '');
    const ids = new Set();
    for (const candidate of [`${base}.ts`, `${base}.html`]) {
      const full = path.join(appRoot, candidate);
      if (!fs.existsSync(full)) continue;
      const src = fs.readFileSync(full, 'utf8');
      let m;
      TESTID_REF.lastIndex = 0;
      while ((m = TESTID_REF.exec(src))) {
        const id = m[1] || m[2];
        if (id && VALID_ID.test(id)) ids.add(id);
      }
    }
    const referenced = [...ids].some((id) => specIds.has(id));
    if (!referenced) flagged.push({ file: rel, hooks: [...ids] });
  }
  return flagged;
}

// --- verdict -----------------------------------------------------------------

/**
 * Collapse every check into the single status, most-blocking first:
 *   NO_COVERAGE_POSSIBLE  fenced area — no suite could ever exist
 *   SUITES_MISSING        a changed path has no suite at all
 *   NEEDS_UPDATE          a suite drives selectors the app no longer has (hub is stale)
 *   MISSING_TEST_CASES    new elements/components exist that no spec references (app is ahead)
 *   NOT_APPLICABLE        nothing but docs changed
 *   MATCHED               safe to run the suites
 */
function verdictOf({ classified, drift, newComponents, elements = [] }) {
  if (classified.fenced.length) return 'NO_COVERAGE_POSSIBLE';
  if (classified.uncovered.length) return 'SUITES_MISSING';
  if (drift.drifted.length) return 'NEEDS_UPDATE';
  const missing =
    (newComponents || []).length ||
    elements.some((e) => e.untestedNew.length || e.newUnhooked || e.noTestAtAll);
  if (missing) return 'MISSING_TEST_CASES';
  if (!classified.covered.length) return 'NOT_APPLICABLE';
  return 'MATCHED';
}

/** True when the suites may run — the console's "proceed / cannot proceed" switch. */
function canProceed(verdict) {
  return verdict === 'MATCHED' || verdict === 'NOT_APPLICABLE';
}

module.exports = {
  globToRegex,
  parseNameStatus,
  matchesAny,
  whichGlob,
  classifyChanges,
  selectorsUsedBySuites,
  findDriftedSelectors,
  findUntestedNewComponents,
  hooksIn,
  allSpecHookRefs,
  unhookedInteractive,
  componentKeyOf,
  analyzeElements,
  verdictOf,
  canProceed,
  walk,
};
