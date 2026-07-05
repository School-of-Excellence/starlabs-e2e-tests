# 2026-07-04 — Preview promote-gate stuck on "OK to promote" + hide CF from preview/release

**Status:** Implemented; production `ng build` green. **Author:** session (operator:
appexperience@soexcellence.com). Two operator-reported issues, both frontend-only fixes.

## Bug — "OK to promote" never clears (even after the prod PR is accepted)

**Symptom:** after promoting + opening the dev→prod PR (via the new admin shortcut) and even after
the PR merged, the Preview Channels "Promote gate" still showed the **OK to promote** button.

**Root cause (pre-existing gating gap, not the shortcut).** The button shows whenever
`envReason(rc)` returns null. `envReason` hid it **only** when `prodGate.verdict === 'OK'` — it never
checked whether a promotion was already in flight or whether anything was left to promote. But the
backend RESETS the gate on release: on dev→prod merge `handlePullRequest` sets
`hasUnreleased=false; promotable=false; prodGate={verdict:'NONE'}` (index.ts:487). So once the batch
ships, `prodGate` is `NONE` again and `envReason` returns null → the button reappears with nothing to
promote. The Release Channel's `promoteReason` already guarded these states; the Preview Channel's
`envReason` didn't — they had drifted.

**Fix** (`preview-channels.component.ts` `envReason`, dev gate only — `!isProd(rc)`): also return a
reason (hide the button) when `rc.prProd.state === 'OPEN'` (promotion already in flight) or
`!rc.hasUnreleased` (production up to date). Now mirrors `promoteReason`. Covers both symptoms
regardless of the `prodGate` reset timing: PR open → hidden; batch merged → hidden.

## Change — CF repo's development branch off the Preview/Release channels

`starlabs-cloud-function` has no preview/deploy lane in these screens (its gate runs locally at
predeploy; deploys live on the CF Board). Its `development` env entry was still rendering.

**Fix:** exclude `repoTypeOf(rc.repo) === 'cloud-function'` from the env-entry lists —
`envEntries` (Preview Channels) and `devEntries`/`prodEntries` (Release Channel). CF feature branches
were already absent from the preview FEATURE list (they have no preview build → `buildState==='NONE'`
→ filtered by `withPreview`), so only the env entry needed excluding.

## Files (frontend only)
- `screens/preview-channels/preview-channels.component.ts` — `envReason` guards; `envEntries` CF
  filter; `repoTypeOf` import.
- `screens/release-channel/release-channel.component.ts` — `devEntries`/`prodEntries` CF filter.

## Note
Both are display/gating fixes — no backend, model, or state-machine change. Ship hosting-only.
