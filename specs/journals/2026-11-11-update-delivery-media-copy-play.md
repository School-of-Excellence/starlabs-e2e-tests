# 2026-11-11 — UDM-01..04: copy / play a pasted media URL in the Delivery Activities form editor

**Why:** starlabs-angular `charan-release` added Copy link + Play (inline player) under a video/audio
field's Media URL chip in update-delivery, and capped long chips with an ellipsis (app journal
`specs/journals/2026-11-11-delivery-form-media-copy-play.md`). Five new `ud-*` hooks:
`ud-copy-media-url-25`, `ud-toggle-media-26`, `ud-media-embed-27`, `ud-media-video-28`, `ud-media-audio-29`.

## What landed
| File | Change |
|---|---|
| `journey/update-delivery-media.spec.ts` | new — UDM-01..04, drives all five hooks |
| `journey/seed-journey.js` | `ID.DFM` delivery forms doc + `/deliveryactivities` route grant |
| `journey/support/journey.ts` | `journeyIds.DFM`, `udmWorld` |

## Why the seed looks like that
- **Own doc, not DF1.** JP-16 / JP-33 assert DF1's formtemplate render; extra media fields there would
  change what they see.
- **Two negative controls.** A video field with NO URL and a radio field WITH option chips. Without them a
  green UDM-01 could not tell "tools follow a media URL" from "every chip field gets tools".
- **A YouTube WATCH link, never an embed link.** The app derives `/embed/<id>`; the spec asserts that
  derived value, so it is not reading back what the seed wrote.
- **Long mp4 URL on a fake host (`media.example.test`).** Long enough to overflow a chip, which is what
  UDM-02's ellipsis check needs; the spec fulfils that host and youtube.com/embed locally.
- **Audio lives in an Array sub-field.** The tools render through one ng-template from two call sites
  (top-level field, sub-field); the sub-field is the one that could silently miss them.
- `/deliveryactivities` had NO route grant in this seed — the routed ds1 addressable case only passed its
  soft checks. The grant is what lets UDM reach the screen.

## Why no Firestore oracle, and no chip removal
update-delivery autosaves on `formarray.valueChanges` (debounced 1s), so opening the dialog can rewrite
the doc. The doc is therefore not a stable oracle, and a case that removed a chip could persist that removal
and break its own retry. The oracles are the DOM (iframe/video/audio `src`, button presence) and the
browser clipboard.

## Execution
Local emulator lane (Firestore 8085, Auth 9099, app `ng serve --configuration emulator` on :4320,
EMU_REUSE=1): UDM-01..04 + the ds1 routed case 5/5 passed; neighbours that read `delivery forms`
(JP-16, JP-33, JP-AUTH, FTO/JTED, delivery-form-delete, atcmodel-forms, addressable dialogs) 32 passed,
2 skipped (pre-existing skips).
