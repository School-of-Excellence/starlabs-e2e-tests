# 2026-11-03 — spec updates for the slider and time contracts, and a local-run trap

Two app-side contracts changed today (app repo journal:
`specs/journals/2026-11-03-participant-view-and-slider-contract.md`). This records what moved in the suites
and **why**, plus one environment finding that cost an hour.

## `journey/atcmodel-forms.spec.ts` — the new `participantview` flag

`atc model` forms rows gained a third key: `forms: [{ formid, filledby, participantview }]`.

- **AMF-03 / AMF-05** now expect `participantview` on every saved row. `false` on the rows the fixture
  seeded, `true` on the one added through the dialog — the two defaults differ on purpose and the assertion
  documents both in one read-back.
- **AMF-06** is new: a box on every row whatever `filledby` says; the three seeded rows unchecked (CONFIG
  carries no such key, which makes them a real negative control rather than a value the test wrote); a row
  added in the dialog already checked; tick one, save, read all four back with the Admin SDK; reopen and
  confirm a saved `true` comes back checked.

The seeded rows having **no** `participantview` key is the point. "Absent reads as false" is the rule the app
relies on so that no model configured before today exposes anything, and the only honest way to test it is
against data written before the field existed.

## `atc/view-prescribed-atc-forms.spec.ts` — time, then sliders

**Time.** `:98` asserted `f(W.time).value.toDate()`. A time answer is now the string `"HH:mm"`, so it asserts
`toBe('10:30')`. The fill at `:57` is unchanged — the web still uses `matTimepicker`, only the stored type
moved.

**Sliders — three assertions, not one.** A slider answer is now a 0-based index into the field's `options`,
and the screen shows the *option* rather than the number. That broke:

1. `fillAllWidgets` returned `Number(displayed)`. The displayed text is a label, so this was `NaN`. It now
   returns the label string and `expectAllAnswers` takes a `string`.
2. The plain-slider assertion compared the stored value to that number. It now resolves the stored index
   through **the options the answer document itself carries** (`sl.options[sl.value]`) and compares that to
   the label on screen. Stronger than before: it checks the index↔label mapping instead of echoing a number.
3. The two flipping assertions said `Number(flip[box]) > 1`. That was written for the old hardcoded 1-10
   flipping slider — the fixture seeds `flippingquestion.options: ['1','10']`, i.e. **two** options, so under
   0-based the only valid indices are 0 and 1 and `> 1` could never pass. They now assert the index moved off
   the first option and names a real option.

Worth flagging for whoever revisits the fixture: `options: ['1','10']` (`seed-atc.js:334`) was authored as a
*scale with two endpoint captions*, which is how the web used to render it. Under the index rule it is a
two-stop slider. It still exercises the path, but it no longer means what its author meant.

## The local-run trap: `[::1]:8080`

Running the atc suite locally failed every test on CORS, with the app fetching
`http://localhost:8080/.../projects/starlabs-cicd`. The emulator was up and the app was correctly wired. The
cause:

```
127.0.0.1:8080  →  200 "Ok"                       ← Firestore emulator (java, IPv4 loopback only)
[::1]:8080      →  501, Server: GCDWebServer      ← process "Runner" — a running Flutter iOS app
localhost       →  resolves to ::1 FIRST
```

A Flutter app on the simulator embeds GCDWebServer and binds the IPv6 wildcard on 8080. The Firestore
emulator binds IPv4 loopback only. So the browser's `localhost:8080` reaches the Flutter app, gets a 501 with
no `Access-Control-Allow-Origin`, and every Firestore call is blocked.

**Stop the simulator app before running the web suite locally**, or point the emulator host at `127.0.0.1`.
CI never sees this.

Second local-run note, unchanged from before: the suite needs `ci/setup-emulator-config.sh`, which only
creates `environment.ts` / `environment.development.ts` when they are **absent**. On a developer machine they
exist and hold the real project, and the app imports `environment.development` directly where the `emulator`
build's fileReplacement does not reach — so without removing them first, the default Firestore stays pointed
at the real backend and every test fails the `G2` guard instead. Back them up, delete, overlay, run, restore.

## Not run

These spec edits are **unverified locally** for the reason above. The `participantview` work (AMF-06) has not
run either. Both need a CI run or a local run with the port freed.
