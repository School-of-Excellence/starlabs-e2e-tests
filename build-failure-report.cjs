#!/usr/bin/env node
// Build a self-contained HTML report of the FAILED queue cases from the on-disk
// test-results/ artifacts (error-context.md + test-failed-1.png), since the native
// Playwright HTML report was not flushed (run was interrupted with SIGINT).
const fs = require('fs');
const path = require('path');

const TR = path.join(__dirname, 'test-results');
const OUT = path.join(__dirname, 'queue-results.html');

const dirs = fs.existsSync(TR) ? fs.readdirSync(TR).filter(d => fs.statSync(path.join(TR, d)).isDirectory()) : [];
const cards = [];
for (const d of dirs) {
  const ecf = path.join(TR, d, 'error-context.md');
  if (!fs.existsSync(ecf)) continue;
  const md = fs.readFileSync(ecf, 'utf8');
  const name = (md.match(/^- Name:\s*(.*)$/m) || [, d])[1];
  const loc = (md.match(/^- Location:\s*(.*)$/m) || [, ''])[1];
  let err = (md.split('# Error details')[1] || '').split('# Page snapshot')[0]
    .replace(/```/g, '').trim().slice(0, 1200);
  const shot = fs.existsSync(path.join(TR, d, 'test-failed-1.png'))
    ? `test-results/${d}/test-failed-1.png` : null;
  cards.push({ name, loc, err, shot });
}
cards.sort((a, b) => a.name.localeCompare(b.name));

const esc = s => String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
const html = `<!doctype html><meta charset=utf-8><title>Queue suite — failures</title>
<style>
 body{font:14px -apple-system,system-ui,sans-serif;margin:0;background:#0f1419;color:#e6e6e6}
 header{background:#1d3a4a;padding:18px 24px;position:sticky;top:0}
 h1{margin:0;font-size:18px;color:#fff} .sum{margin-top:6px;color:#9fc}
 .grid{padding:24px;display:grid;gap:20px}
 .card{background:#171c24;border:1px solid #2a3340;border-radius:10px;overflow:hidden}
 .hd{padding:12px 16px;border-bottom:1px solid #2a3340}
 .nm{font-weight:600;color:#ff8a8a} .loc{color:#7a8699;font-size:12px;margin-top:3px}
 pre{margin:0;padding:12px 16px;background:#11151b;color:#ffd9a0;white-space:pre-wrap;font-size:12px;border-bottom:1px solid #2a3340}
 img{width:100%;display:block;background:#fff}
 details summary{cursor:pointer;padding:8px 16px;color:#8ab4f8}
</style>
<header><h1>Queue suite — failure report (starlabs-cicd)</h1>
<div class=sum>145 passed · <b style="color:#ff8a8a">17 failed</b> · 11 skipped · 33 did not run (run interrupted) — ${cards.length} failures with artifacts below</div></header>
<div class=grid>
${cards.map(c => `<div class=card>
  <div class=hd><div class=nm>${esc(c.name)}</div><div class=loc>${esc(c.loc)}</div></div>
  <pre>${esc(c.err) || '(no error text captured)'}</pre>
  ${c.shot ? `<details open><summary>screenshot</summary><img src="${c.shot}" loading=lazy></details>` : '<div style="padding:12px 16px;color:#7a8699">(no screenshot)</div>'}
</div>`).join('\n')}
</div>`;
fs.writeFileSync(OUT, html);
console.log(`wrote ${OUT}  (${cards.length} failure cards)`);
