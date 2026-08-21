#!/usr/bin/env node
/**
 * readiness.test.cjs — unit tests for the suite-alignment checker.
 * Run: node scripts/readiness/readiness.test.cjs        (no deps, no network, no emulator)
 */
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const lib = require('./lib.cjs');

let pass = 0;
let fail = 0;
function ok(name, cond, extra) {
  if (cond) {
    pass++;
    console.log(`  ✓ ${name}`);
  } else {
    fail++;
    console.log(`  ✗ ${name}${extra ? `\n      ${extra}` : ''}`);
  }
}
const eq = (name, got, want) => ok(name, JSON.stringify(got) === JSON.stringify(want), `got ${JSON.stringify(got)} want ${JSON.stringify(want)}`);

// --- fixture manifest --------------------------------------------------------
const manifest = {
  neutral: { appPaths: ['*.md', '**/*.md', '.github/**'] },
  fenced: { appPaths: ['src/app/ATC/**'] },
  crossCutting: { appPaths: ['package.json', 'src/app/shared/**'] },
  suites: {
    queue: { ciReady: true, specDir: 'queue', appPaths: ['src/app/queue system/**'] },
    login: { ciReady: true, specDir: 'login', appPaths: ['src/app/login/**'] },
    notready: { ciReady: false, specDir: 'notready', appPaths: ['src/app/draft/**'] },
  },
};

console.log('\nglobs');
ok('** spans directories', lib.globToRegex('src/app/queue system/**').test('src/app/queue system/a/b.ts'));
ok('* stays within a segment', !lib.globToRegex('src/*.ts').test('src/a/b.ts'));
ok('**/*.md needs a directory (documented quirk)', !lib.globToRegex('**/*.md').test('README.md'));
ok('bare *.md catches root files', lib.globToRegex('*.md').test('README.md'));
ok('spaces in folder names are literal', lib.globToRegex('src/app/queue system/**').test('src/app/queue system/x.ts'));

console.log('\nparseNameStatus (regression: folder names with spaces)');
{
  const out = [
    'M\tsrc/app/queue system/board.component.ts',
    'A\tsrc/app/Diagnostics Tool/live-event-health/x.component.ts',
    'D\tsrc/styles.css',
    'R100\tsrc/app/old name/a.ts\tsrc/app/new name/a.ts',
  ].join('\n');
  const r = lib.parseNameStatus(out);
  eq('space-bearing path survives intact', r[0].file, 'src/app/queue system/board.component.ts');
  eq('two spaces + nesting survive', r[1].file, 'src/app/Diagnostics Tool/live-event-health/x.component.ts');
  eq('added files keep status A', r[1].status, 'A');
  eq('rename reports the destination', r[3].file, 'src/app/new name/a.ts');
  eq('all four rows parsed', r.length, 4);
}

console.log('\nclassifyChanges');
{
  const r = lib.classifyChanges(manifest, ['src/app/queue system/x.component.ts']);
  eq('queue file → covered by queue', r.suites, ['queue']);
  eq('  nothing uncovered', r.uncovered, []);
}
{
  const r = lib.classifyChanges(manifest, ['src/app/quiz/x.ts']);
  eq('unmapped file → uncovered', r.uncovered, ['src/app/quiz/x.ts']);
  eq('  no suites to run', r.suites, []);
}
{
  const r = lib.classifyChanges(manifest, ['README.md', '.github/workflows/x.yml']);
  eq('docs + workflows → neutral', r.neutral, ['README.md', '.github/workflows/x.yml']);
  eq('  not uncovered', r.uncovered, []);
}
{
  const r = lib.classifyChanges(manifest, ['src/app/ATC/atc.component.ts']);
  ok('ATC → fenced', r.fenced.length === 1 && r.uncovered.length === 0);
}
{
  const r = lib.classifyChanges(manifest, ['package.json']);
  eq('cross-cutting → every ciReady suite', r.suites.sort(), ['login', 'queue']);
  ok('  not-ciReady suite excluded', !r.suites.includes('notready'));
}
{
  const r = lib.classifyChanges(manifest, ['src/app/queue system/x.ts', 'src/app/quiz/y.ts']);
  eq('mixed diff → the uncovered file still surfaces', r.uncovered, ['src/app/quiz/y.ts']);
  eq('  and the covered suite still runs', r.suites, ['queue']);
}

console.log('\nverdictOf');
const V = (c, d = [], n = [], e = []) =>
  lib.verdictOf({ classified: c, drift: { drifted: d }, newComponents: n, elements: e });
const el = (o) => ({ untestedNew: [], newUnhooked: 0, noTestAtAll: false, untestedExisting: [], ...o });
eq('covered + aligned → MATCHED', V({ fenced: [], uncovered: [], covered: [{}] }), 'MATCHED');
eq('uncovered wins over drift', V({ fenced: [], uncovered: ['a'], covered: [] }, [{ id: 'x' }]), 'SUITES_MISSING');
eq('fenced wins over everything', V({ fenced: [{ file: 'a' }], uncovered: ['b'], covered: [] }), 'NO_COVERAGE_POSSIBLE');
eq('drift (hub stale) → NEEDS_UPDATE', V({ fenced: [], uncovered: [], covered: [{}] }, [{ id: 'gone' }]), 'NEEDS_UPDATE');
eq('new untested component → MISSING_TEST_CASES', V({ fenced: [], uncovered: [], covered: [{}] }, [], [{ file: 'a' }]), 'MISSING_TEST_CASES');
eq('new unreferenced hook → MISSING_TEST_CASES', V({ fenced: [], uncovered: [], covered: [{}] }, [], [], [el({ untestedNew: ['new-btn'] })]), 'MISSING_TEST_CASES');
eq('new element with no hook → MISSING_TEST_CASES', V({ fenced: [], uncovered: [], covered: [{}] }, [], [], [el({ newUnhooked: 2 })]), 'MISSING_TEST_CASES');
eq('component nothing exercises → MISSING_TEST_CASES', V({ fenced: [], uncovered: [], covered: [{}] }, [], [], [el({ noTestAtAll: true })]), 'MISSING_TEST_CASES');
eq('drift outranks missing test cases', V({ fenced: [], uncovered: [], covered: [{}] }, [{ id: 'gone' }], [], [el({ untestedNew: ['x'] })]), 'NEEDS_UPDATE');
eq('pre-existing gaps alone do NOT block', V({ fenced: [], uncovered: [], covered: [{}] }, [], [], [el({ untestedExisting: ['old-btn'] })]), 'MATCHED');
eq('docs only → NOT_APPLICABLE', V({ fenced: [], uncovered: [], covered: [] }), 'NOT_APPLICABLE');

console.log('\ncanProceed');
eq('MATCHED proceeds', lib.canProceed('MATCHED'), true);
eq('NOT_APPLICABLE proceeds', lib.canProceed('NOT_APPLICABLE'), true);
eq('SUITES_MISSING stops', lib.canProceed('SUITES_MISSING'), false);
eq('MISSING_TEST_CASES stops', lib.canProceed('MISSING_TEST_CASES'), false);
eq('NEEDS_UPDATE stops', lib.canProceed('NEEDS_UPDATE'), false);

console.log('\nunhookedInteractive');
eq('<button> without a hook is flagged', lib.unhookedInteractive('<button class="x">Go</button>').length, 1);
eq('<button> with a hook is not', lib.unhookedInteractive('<button data-testid="go-btn">Go</button>').length, 0);
eq('(click) on a div is interactive', lib.unhookedInteractive('<div (click)="save()">S</div>').length, 1);
eq('multi-line tag is handled', lib.unhookedInteractive('<button\n  class="x"\n  data-testid="ok">Go</button>').length, 0);
eq('plain markup is ignored', lib.unhookedInteractive('<div class="wrap"><span>hi</span></div>').length, 0);

console.log('\nhooksIn');
eq('extracts plain hooks', [...lib.hooksIn('<i data-testid="a-btn"></i>')], ['a-btn']);
eq('drops interpolation', [...lib.hooksIn('data-testid="${x}"')], []);
eq('componentKeyOf groups .ts and .html', lib.componentKeyOf('a/b.component.html'), 'a/b.component');
eq('componentKeyOf ignores other files', lib.componentKeyOf('a/b.service.ts'), null);

// --- selector drift, against a real temp tree --------------------------------
console.log('\nfindDriftedSelectors');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'readiness-'));
const hub = path.join(tmp, 'hub');
const app = path.join(tmp, 'app');
fs.mkdirSync(path.join(hub, 'queue'), { recursive: true });
fs.mkdirSync(path.join(app, 'src', 'app', 'queue system'), { recursive: true });

fs.writeFileSync(
  path.join(hub, 'queue', 'operator.spec.ts'),
  `
  await page.locator('[data-testid="qm-present"]').click();
  await page.locator('[data-testid="qm-renamed"]').click();
  await page.getByTestId('qm-bound').click();
  const dyn = \`[data-testid="\${id}"]\`;      // interpolation must be ignored
  `,
);
fs.writeFileSync(
  path.join(app, 'src', 'app', 'queue system', 'board.component.html'),
  `<div data-testid="qm-present"></div>
   <div [attr.data-testid]="'qm-bound'"></div>`,
);

{
  const r = lib.findDriftedSelectors(hub, app, manifest, ['queue']);
  eq('three real ids extracted, interpolation dropped', r.checked, 3);
  eq('only the missing one is reported', r.drifted.map((d) => d.id), ['qm-renamed']);
  ok('bound [attr.data-testid] form resolves', !r.drifted.some((d) => d.id === 'qm-bound'));
}

console.log('\nfindUntestedNewComponents');
fs.writeFileSync(path.join(app, 'src', 'app', 'queue system', 'fresh.component.ts'), 'export class Fresh {}');
fs.writeFileSync(path.join(app, 'src', 'app', 'queue system', 'fresh.component.html'), '<div data-testid="never-referenced"></div>');
fs.writeFileSync(path.join(app, 'src', 'app', 'queue system', 'known.component.ts'), 'export class Known {}');
fs.writeFileSync(path.join(app, 'src', 'app', 'queue system', 'known.component.html'), '<div data-testid="qm-present"></div>');
{
  const added = ['src/app/queue system/fresh.component.ts', 'src/app/queue system/known.component.ts'];
  const r = lib.findUntestedNewComponents(app, hub, manifest, added);
  eq('flags the component no spec references', r.map((c) => c.file), ['src/app/queue system/fresh.component.ts']);
}

console.log('\nanalyzeElements (new vs pre-existing, against a base version)');
{
  // head: two hooks — one referenced by the spec, one brand new and unreferenced — plus a new
  // <button> with no hook at all. base: only the referenced hook existed.
  fs.writeFileSync(
    path.join(app, 'src', 'app', 'queue system', 'panel.component.html'),
    `<div data-testid="qm-present"></div>
     <div data-testid="qm-brand-new"></div>
     <button (click)="save()">Save</button>`,
  );
  fs.writeFileSync(path.join(app, 'src', 'app', 'queue system', 'panel.component.ts'), 'export class Panel {}');
  const base = { 'src/app/queue system/panel.component.html': '<div data-testid="qm-present"></div>' };
  const r = lib.analyzeElements({
    appRoot: app,
    hubRoot: hub,
    manifest,
    changedFiles: ['src/app/queue system/panel.component.html'],
    readBase: (rel) => base[rel] || '',
  });
  eq('one component analysed', r.length, 1);
  eq('the new unreferenced hook is reported', r[0].untestedNew, ['qm-brand-new']);
  eq('the pre-existing referenced hook is not', r[0].tested, 1);
  eq('the new hookless button is counted', r[0].newUnhooked, 1);
  ok('component is not "blind" — one hook is exercised', r[0].noTestAtAll === false);
}
{
  // A component whose every hook is unknown to the specs → nothing about it is tested.
  fs.writeFileSync(
    path.join(app, 'src', 'app', 'queue system', 'blind.component.html'),
    '<div data-testid="nobody-tests-this"></div>',
  );
  fs.writeFileSync(path.join(app, 'src', 'app', 'queue system', 'blind.component.ts'), 'export class Blind {}');
  const r = lib.analyzeElements({
    appRoot: app,
    hubRoot: hub,
    manifest,
    changedFiles: ['src/app/queue system/blind.component.ts'],
    readBase: () => '',
  });
  ok('flagged: no element in it is exercised', r[0].noTestAtAll === true);
  eq('  and the hook shows as a missing test case', r[0].untestedNew, ['nobody-tests-this']);
}

fs.rmSync(tmp, { recursive: true, force: true });

console.log(`\n${pass} passed · ${fail} failed\n`);
process.exit(fail ? 1 : 0);
