# 2026-10-12 — JCD-05 (remark attachment upload) + JCD-06 (Journey-cell product fallback via PJP) — sashong 176ce857

## JCD-05 — why it looks like this
- **Reached through the JE dashboard**, not /onboardingremarks (that route is the dialog-as-route defect, JP-22):
  "To onboard" (`jcd-div-035`) → the PJP_SLQ row → **Mark Onboarded** (`jcd-btn-153`) → OnboardingRemark in its
  email-composer mode. (First attempt went through the Sales Notes cell — that opens the same component as a
  read-only "View Note", without the composer.) PJP_SLQ therefore carries purchasedate / onboarded:false, and its
  person gets a `participant metadata` name for the table search.
- **Pick the template first** — the composer and its Attachments render only once an email template is selected
  (the seeded EMT1, same picker JP-09 drives). `classify/postmarkserver` is seeded (merge, untagged — comms' shape):
  the dialog indexes `senders['senderemails']` on open and throws on a missing doc.
- **Storage is stubbed** (page.route on firebasestorage.googleapis.com). The emulator build has no storage emulator
  and points at starlabs-cicd.appspot.com — without the stub the test would try a real bucket.
- **Oracle:** the upload path (`email-attachments/manual_<file>_<ts>`) and the attachment's open link
  (`jorm-a-036`) — the template hides that link for `data:` URLs, so it only exists under the new behaviour.
- **Control:** a stubbed **403** must add nothing and alert the user. Not 5xx — the Storage SDK retries 5xx with
  backoff for minutes, so the alert never came. Its two console errors are allowed for that case only.

## JCD-06
SLQ: product-only sale with NO productref; its participantjourneyproduct (salesleadsref → SLQ) carries productref → P2.
The Journey cell must read "Test Product Two" — only reachable through the app's saleProductRefs join. SLP (own
productref → P1) is the control that a sale's own product still wins.

## Run (local emulator WITH functions, app charan-release 7f342493 on :4320)
JCD-06 first run green; JCD-05 green after the path fixes above (Mark Onboarded entry, template pick, 403 control);
full journey 90 pass (JP-20/22 their `test.fail()`) / 28 skip / 0 fail.
