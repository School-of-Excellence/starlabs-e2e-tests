# 2026-10-09 — JP-33: formtemplate keeps a multi-line form description (mahalakshmi 6399b868)

App: `.form-description` → full width, left-aligned, `white-space: pre-line`, so a description typed on several
lines shows its line breaks (it was a centred 700px block that collapsed newlines into spaces).

Seed: DF1 (`delivery forms`, already rendered by JP-16) gains a two-line `formdescription`. The assertion reads the
element's innerText — the browser keeps the `\n` only under pre-line, so the seed's newline is the control and the
app's CSS decides the outcome. Plus computed text-align = left.

## Run (local emulator WITH functions, app charan-release 5a78a955 on :4320)
JP-33 first run green; journey 88 pass (JP-20/22 their `test.fail()`) / 28 skip. workshops 105 pass / 31 skip;
WS-29 + WDC-06 failed only because journey's seed (run first on the same LOCAL emulator) left a `non active`
participant — WDC-06's `filter({ hasText: 'active' })` then matched "non active" too. With the journey seed torn
down both pass. CI runs one emulator per suite. (WDC-06's substring match is fragile — flagged to its owner.)
