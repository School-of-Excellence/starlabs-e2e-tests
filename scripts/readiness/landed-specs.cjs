#!/usr/bin/env node
// @ts-check
/**
 * landed-specs.cjs — the RUN-TIME half of the hub-ahead rule (operator decision D2, 2026-10-17;
 * specs/plans/2026-10-17-atc-live-screens.md).
 *
 * Of the spec files a suite would run, drop the ones that reference a `data-testid` hook the APP UNDER TEST
 * does not declare. Such a spec belongs to a feature whose app code is still on another branch (its tests
 * reached hub main first); running it here can only fail, through no fault of this branch.
 *
 * Real drift — a hook this branch REMOVED — is blocked earlier by the readiness check (NEEDS_UPDATE), so a
 * spec skipped here is a not-landed feature, never a hidden breakage. Every skip is listed in the run summary.
 *
 * Usage (from the app workspace, hub cloned at ./e2e — see .github/workflows/web-e2e.yml):
 *   node e2e/scripts/readiness/landed-specs.cjs --hub e2e --app . --specs "atc/a.spec.ts atc/b.spec.ts"
 * stdout: the KEPT spec paths, space-separated (empty when every spec was skipped).
 * $GITHUB_STEP_SUMMARY (when set): a table of skipped specs and the hooks they are waiting for.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const lib = require('./lib.cjs');

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 && process.argv[i + 1] !== undefined ? process.argv[i + 1] : fallback;
};

const HUB = path.resolve(arg('hub', path.join(__dirname, '..', '..')));
const APP = path.resolve(arg('app', process.cwd()));
const specs = String(arg('specs', '')).split(/\s+/).filter(Boolean);

const { kept, skipped } = lib.partitionSpecsByLandedHooks(HUB, APP, specs);

process.stdout.write(kept.join(' '));

const lines = [];
if (skipped.length) {
  lines.push(`### ${skipped.length} spec file(s) skipped — hooks not landed on this branch`);
  lines.push('');
  lines.push('These specs reference `data-testid` hooks this branch does not have. Their feature is still on another');
  lines.push('branch (the tests reached hub `main` first); they run here once that code is merged into `development`.');
  lines.push('');
  lines.push('| Spec | Waiting for |');
  lines.push('|---|---|');
  for (const s of skipped) {
    const shown = s.missing.slice(0, 6).map((h) => `\`${h}\``).join(', ');
    lines.push(`| \`${s.spec}\` | ${shown}${s.missing.length > 6 ? ` … +${s.missing.length - 6} more` : ''} |`);
  }
  lines.push('');
}
if (!kept.length && specs.length) lines.push('_Every spec in this suite was skipped — nothing to run for this branch._');
if (lines.length) {
  process.stderr.write(lines.join('\n') + '\n');
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, lines.join('\n') + '\n');
}
