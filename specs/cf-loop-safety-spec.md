# CF Loop-Safety Spec — self-trigger test cases + full compliance matrix

**Date:** 2026-07-05. **Scope:** every Firestore trigger in `starlabs-cloud-function` (audited on
`cicd-rollout`: 37 `onDocumentCreated` · 9 `onDocumentUpdated` · 16 `onDocumentWritten` · 0
`onDocumentDeleted`). This is the rulebook the predeploy loop-guard (and human review) checks against.

---

## 0. The one rule
A Firestore trigger **self-triggers (loops)** when its own WRITE re-fires the SAME trigger. **Which write
re-fires depends on the trigger type** — that's why each type has its own test cases:

| Trigger fires on… | …so a self-loop needs the function to… |
|---|---|
| `onDocumentCreated(p)` | **create a NEW doc** matching `p` |
| `onDocumentUpdated(p)` | **update** a doc matching `p` |
| `onDocumentWritten(p)`  | **any write** (create/update/delete) matching `p` |
| `onDocumentDeleted(p)`  | **delete** a doc matching `p` |

Writing to a **different** collection never self-loops. A self-write that **converges** (terminal state,
idempotent value, or a before/after guard that stops matching) is bounded and allowed.

---

## 1. Test cases by trigger type

### `onDocumentCreated(path)`
- **TC-C1 (no self-create):** MUST NOT `.add()` / `.doc(newId).set()` a **new** doc matching its own
  `path`/collection without a terminating guard. → PASS if it creates nothing in its own path.
- **TC-C2 (self-update/delete is safe):** updating or deleting the *triggering* doc does NOT re-fire
  `onCreate` → auto-PASS.
- **TC-C3 (subcollection):** on `x/{id}/sub/{sid}`, MUST NOT create another `x/{id}/sub/*`.
- **Validation:** seed a create at `path`; assert the function spawns **0** self-path creates (or ≤ a
  bounded, guarded count).

### `onDocumentUpdated(path)`
- **TC-U1 (guarded self-update):** if it updates the trigger doc / a same-path doc, it MUST carry a
  before→after guard so the re-fire converges (transition edge `before.x!==after.x && after.x==="…"`,
  equality early-return, or writes a value that no longer matches the guard). FAIL if it writes a
  **monotonically-changing** value (counter/timestamp) with no terminating condition.
- **TC-U2 (idempotent value = bounded-but-fragile):** writing the SAME value each time is bounded
  (Firestore no-ops identical writes) — allowed, but prefer an explicit early-return.
- **TC-U3 (self-create/delete is safe):** creating/deleting does NOT re-fire `onUpdate` → PASS.
- **Validation:** seed an update that activates the self-write branch; assert executions ≤ threshold.

### `onDocumentWritten(path)` — most dangerous (catches all 3 write types)
- **TC-W1 (top-of-function diff guard):** SHOULD start with a before/after diff and early-return on
  no-op (`if (no watched field changed) return`).
- **TC-W2 (self-write convergence):** any write-back to a matching doc MUST converge (terminal state /
  idempotent / guarded). FAIL if unbounded.
- **TC-W3 (handle create vs update vs delete):** a blind write-back without distinguishing the write
  kind loops. Confirm `event.data.before`/`after` existence is checked.
- **Validation:** seed a create AND an update on `path`; assert bounded executions both times.

**Verdicts used below:** **PASS** = no self-write, or a solid terminal-state/idempotent guard ·
**PASS⚠ (fragile)** = self-writes its own path but converges only via a partial/edge guard (does ≥1
extra self-fire — tighten) · **FAIL** = unguarded self-write (would loop).

---

## 2. Compliance matrix

### FAIL — unguarded self-write (would loop)
**None in production code.** (The injected test `testHUB_V2` on `test/{id}` is the deliberate probe: with
a *constant* write it's bounded, with a *changing* write it's the FAIL positive-control.)

### PASS⚠ — self-writes its own trigger path, converges via a fragile/edge guard (tighten these)
| Function | File | Type | Self-write | Why bounded (fragile) | Fails which TC without the guard |
|---|---|---|---|---|---|
| `updateAuthorUIDInAtcAlpha` | ATC.js | Written `atc_alpha/{id}` | updates `authoruid` on same doc | guard compares `author`, **not** the written field → 1 extra fire | TC-W2 |
| `calculateParticipantMode` | participantmode.js | Written `participantsproduct/{id}` | `after.ref.update` + sibling batch | whole-doc equality + one-shot status/mode edges | TC-W1/W2 |
| `onUpdateBigAssignment` | big-assignment.js | Updated `big assignment/{id}` | writes `groupchatid`/zoom to same doc | field-presence guard (`if(newDoc.groupchatid)`) | TC-U1 |
| `createPostMarkEmailTemplate` | communication.js | Updated `email templates/{id}` | updates `postmarktemplateid/active/postmarkstatus` | `templatevalidated` false→true can't repeat | TC-U1 |

### PASS — self-writes its own path but with a SOLID guard (terminal-state / idempotent)
| Function | File | Type | Guard |
|---|---|---|---|
| `startParticipantNextDeliverySequence` | participantproduct.js | Updated `deliverables/{id}` | FSM ready→ongoing→completed; each write moves to a non-matching state |
| `evolutionFamilyWishlistOnWrite` | wishlist.js | Written `evolutionwishlistlog/{id}` | FSM sent→sended→completed |
| `participantsely_to_pmd` | participantmetadata.js | Written `participants ely/{id}` | JSON-equality guard + only-when-atcids-to-delete |
| `livechangeworkadjustment` | achievements.js | Created `livechangework/{id}` | self-*update* only + early-return if adjustment set (create-safe) |
| `onQueueAtcGenerationCreate` | queue_atc_generation.js | Created `queue_atc_generation/{id}` | self-*merge* only + status early-returns (create-safe) |

### PASS — no self-write (writes to different collections / reads only)
All remaining triggers. Grouped:

**onDocumentCreated (all 37 — none self-creates):** `aggregateBigLevelFromActivityLog`,
`appointmentbooked`†, `bulkReadyInvitation`, `ChatxNotification`†, `computeSlot`†,
`createBigParticipantAssignment`, `inviteToStudio`, `newuserjoinedslackintegration`, `notifyMobileApp`†,
`onBreakthroughsPosted`, `onQueueTokenCreateUpdateProductMode`, `particpantFormSubmit_SlackIntegration`†,
`productenquiryfromeiflix`, `queueavtest`, `queueParticipantPositionUpdate`, `queueParticipantTransfer`,
`RecommendedPlaylistTrigger_to_pmd`, `sendWhatsAppBroadcastCreated`, `slackAskAH`, `slackCustomerSupport`,
`slackInterimCrossOver`, `slackLoginEvent`, `slackLoveLetter`, `studioZoomLink`†, `ticketCreated`,
`ticketMsgNotification`, `workshopenrolledwatti`, `workshopQandA`  († = self-*updates* the trigger doc,
which is create-safe).

**onDocumentUpdated (the safe 6):** `appointmentcancelled`, `ATCevolutionProgress`, `onQueueDateChange`,
`sendSlackNotificationSaleRejection`, `validateATCtoAlpha`, `workshopconfiguration`.

**onDocumentWritten (the safe 11):** `atcdata_to_pmd`, `dashboardcustomersupport`,
`eventparticipationdata_to_pmd`, `journey_to_pmd`, `onEventApprovalProductMode`, `onQueueStageChange`,
`onTicketChanged`, `participantAELData_to_pmd`‡, `participantsproductinitiated`, `procedureOnWrite`,
`productsdata_to_pmd`, `purchaselabel_to_pmd`‡, `totalparticipant_tierupdate`‡  (‡ = no
change-comparison guard → **redundant re-runs**, a cost issue, not a loop).

### Manifest corrections found during the audit (fix `index.js`/manifest attributions)
- `communityPostHLS` → actually `onDocumentWritten("/community post/{id}")` (not `content analytics`).
- `videoAskHLS` → `onDocumentCreated("/participantvideoask/{id}")`.
- `profiledata_to_participantmetadata` → `onDocumentWritten` (not Created).
- `biginvitationAccepted`, `invitationAccepted`, `CreateQueueActivityLogV2` → `onDocumentUpdated` (not Created).
- `sendWhatsAppBroadcast` → `onRequest` (HTTPS), not a trigger.
- `ticketCreated` **and** `ticketCreatedV2` both fire on `clientissue/{id}` → not a loop, but **duplicate
  message creation** risk — a correctness concern to review.

---

## 3. How a NEW trigger must pass (checklist for authors + the guard)
1. **Identify the type** → apply that type's TCs above.
2. **Does it write to its own trigger path?** If no → PASS. If yes → it MUST satisfy TC-U1/TC-W2
   (converging guard) or TC-C1 (no self-create).
3. **Prefer an explicit before/after early-return** over relying on Firestore no-op semantics.
4. **Coverage:** to be exercised by the *dynamic* guard it must be in `functions/index.emulator.js`
   (only 16 are today). Outside that set, only the **static self-trigger check** covers it — so keep the
   static check as the always-on net.
5. **onDocumentWritten is guilty until proven innocent** — always give it a top-of-function diff guard.

## Recommended follow-ups (not loops today, but worth doing)
- Tighten the 4 **PASS⚠** functions (esp. `updateAuthorUIDInAtcAlpha` — guard the field it actually writes).
- Add change-guards to the 3 ‡ redundant-run functions (cost).
- Resolve `ticketCreated` vs `ticketCreatedV2` double-handler on `clientissue/{id}`.
- Implement the **static self-trigger detector** in predeploy so PASS⚠/FAIL patterns are flagged even
  when the function isn't emulator-loaded.
