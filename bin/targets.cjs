#!/usr/bin/env node
'use strict';
// targets.cjs — resolve test targets from targets.json, keyed by REPO NAME.
//
// The registry (targets.json) maps repo-name → { type, path | repo+branch, [port], [codebase] }. This is the
// single source of truth the hub uses to wire a run's targets, so adding a project = one registry line (never
// an env-var collision). setup.sh consumes this to set APP_PATH/CF_PATH/FLUTTER_PATH + create ./targets/<name>.
//
// Usage:
//   node bin/targets.cjs names                      # one repo-name per line
//   node bin/targets.cjs list                       # name <tab> type <tab> path[/repo@branch] [<tab>:port]
//   node bin/targets.cjs path --name <repo>         # path of that target
//   node bin/targets.cjs path --type <angular|cloud-function|flutter>   # path of the SOLE target of that type
//   node bin/targets.cjs port --name <repo>         # serve port (angular)
const fs = require('fs'), path = require('path');
const FILE = path.join(path.resolve(__dirname, '..'), 'targets.json');

function load() {
  if (!fs.existsSync(FILE)) {
    console.error(`targets.json not found at ${FILE}\n→ copy targets.example.json to targets.json and fill in your local paths.`);
    process.exit(1);
  }
  const reg = JSON.parse(fs.readFileSync(FILE, 'utf8'));
  delete reg['//'];
  return reg;
}
const [cmd, ...rest] = process.argv.slice(2);
const args = {};
for (let i = 0; i < rest.length; i++) {
  if (rest[i].startsWith('--')) { const k = rest[i].slice(2); args[k] = (rest[i + 1] && !rest[i + 1].startsWith('--')) ? rest[++i] : true; }
}
const reg = load();
const byName = (n) => { if (!reg[n]) { console.error(`no target "${n}" in targets.json (have: ${Object.keys(reg).join(', ')})`); process.exit(1); } return { name: n, ...reg[n] }; };
const byType = (ty) => {
  const m = Object.entries(reg).filter(([, v]) => v.type === ty);
  if (m.length === 0) { console.error(`no target of type "${ty}" in targets.json`); process.exit(1); }
  if (m.length > 1) { console.error(`multiple "${ty}" targets (${m.map((x) => x[0]).join(', ')}) — pass --name <repo> to disambiguate`); process.exit(1); }
  return { name: m[0][0], ...m[0][1] };
};
const resolve = () => (args.name ? byName(args.name) : args.type ? byType(args.type) : (console.error('pass --name <repo> or --type <type>'), process.exit(1)));

switch (cmd) {
  case 'names': console.log(Object.keys(reg).join('\n')); break;
  case 'list': for (const [n, v] of Object.entries(reg)) console.log(`${n}\t${v.type}\t${v.path || `${v.repo}@${v.branch || 'main'}`}${v.port ? `\t:${v.port}` : ''}`); break;
  case 'path': { const t = resolve(); if (!t.path) { console.error(`target "${t.name}" has no local path (repo+branch not cloned yet)`); process.exit(1); } console.log(t.path); break; }
  case 'port': { const t = resolve(); console.log(t.port || ''); break; }
  case 'type': { console.log(byName(args.name).type); break; }
  default: console.error('usage: targets.cjs names|list|path --name X|path --type T|port --name X'); process.exit(1);
}
