# 2026-10-16 — Zoom dashboard: Zoom vs Dropbox sizes (ZRD-11..14)

App change: starlabs-angular `specs/journals/2026-10-16-zoom-dashboard-size-validation.md`. The Size column
and file list show Zoom vs Dropbox bytes with ✓/⚠, Meeting and Size sort, and Verify all folds "No longer in
Zoom" failures into a details list. New hooks: `zrd-size-zoom`, `zrd-size-dropbox`, `zrd-size-dropbox-unknown`,
`zrd-file-bytes`, `zrd-file-zoomnow`, `zrd-verifyall-problem`, `zrd-verifyall-gone`.

## Why the seed looks like this
The three existing rows were extended instead of adding new ones. ZRD-01/03/10 count and order exactly
these rows, so a fourth row would have broken them.
- **Failed** gets a file whose upload committed `dropboxSize: 4096`, but whose last verification found
  1000 B in Dropbox and 5000 B now in Zoom. The screen must prefer the verification. A screen reading the
  upload size would show a stale ✓ 4096 B, so this row is what proves the rule. `ok:false` keeps its
  trash and retry gates as they were.
- **Verified** gets a matching file (512 everywhere). This is the ✓ case, and `ok:true` keeps it the only
  trashable row.
- **Completed** keeps no per-file map, so its Dropbox size is unknown. That is the negative control: no
  ✓ and no ⚠, just "—".
- Sizes 4096 / 1024 / 512 give a Size order (Failed, Completed, Verified) different from both name order
  and In Zoom order. A sort that silently fell back to either would fail.
- Verify all's "gone" split uses a stub flag (`mode.batchGone`). The default ZRD-03 answer is unchanged.

## Status
Authored and listed, hooks aligned, gate green. Not executed locally; the first run is CI.
