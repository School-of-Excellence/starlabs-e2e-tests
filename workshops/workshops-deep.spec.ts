// workshops-deep.spec.ts — the DEEP half of the Workshops suite: the recon candidate cases the first
// pass deferred (create-workshop multi-field form, the challenge-array save, the mover-gated ENROLL
// dialog → two app-written docs, the duplicate flow, the triggerFunction settings write, the split
// dashboard metrics, the cross-feature engagement count, the product-page render, and the legacy
// eiflix route smokes). All drive REAL Angular screens; every assertion is ANTI-CIRCULAR (a value the
// APP computed/rendered or WROTE, compared to a KNOWN seeded precondition — never a value the test wrote).
//
// Recon: e2e/recon-allcomp/workshops.md — WS-02 / WS-06 / WS-08 / WS-09 / WS-10 / WS-13 / WS-14 / WS-15
// plus the dashboard split-metric depth and the legacy-route smokes (recon §"Risks" #10).
//
// CF DEPLOYMENT REALITY (verified via `firebase functions:list --project slabs-queue-e2e-exdcz`): the
// test project deploys ONLY the queue CFs + calculateParticipantMode + the *_to_pmd family. The
// workshop CFs (`workshopconfiguration`, `workshopenrolledwatti`) are NOT deployed. So:
//   • WS-10 cannot observe the CF's participant-workshop propagation; per the task rule it asserts the
//     UI's OWN write (triggerFunction:true + the new challenges array) and SKIP-GUARDS the CF rollup.
//   • WS-08's CF side-effect (`workshopenrolledwatti`) is comms-only (no Firestore side-effect) AND not
//     deployed — so WS-08 asserts the two docs the ENROLL DIALOG itself writes; WS-09 asserts no real
//     production comms endpoint was hit (the prod firewall captured zero prod-CF escapes).
import { test, expect } from '@playwright/test';
import {
  wsIds, wsProfileIds, wsProductNames, wsActors, installWshopStubs, installWshopStubsCapturingProdBlocks,
  loginAsWshopAdmin, loginAsWshopMover, resetWorkshopConfigBaseline, cleanEnrollmentForP2,
  cleanDuplicateWorkshops,
} from './support/wshop';
import { attachConsoleGuard, assertNoFatal, ConsoleGuard } from '../queue/support/console-guard';
import { getDoc, queryWhere, countWhere, pollUntil, db } from '../queue/support/firestore-admin';

const RUN = process.env.WSHOP_RUNID || 'wshop';

// ============================================================================================
// Group A — create-workshop / workshop-configuration writes (real forms → Firestore)
// ============================================================================================
test.describe('Workshops deep — create + config writes (real UI, anti-circular)', () => {
  let guard: ConsoleGuard;
  test.beforeEach(async ({ page }) => {
    guard = attachConsoleGuard(page);
    await installWshopStubs(page);
  });
  test.afterEach(() => assertNoFatal(guard, 'workshops deep (create/config): no fatal console errors / pageerrors'));

  // ------------------------------------------------------------------------------------------
  // WS-02 — the create-workshop form submits and a NEW workshopconfiguration doc lands, then the app
  //         navigates to /workshopconfig/<newId>. App output (the persisted title) vs KNOWN typed input.
  // ------------------------------------------------------------------------------------------
  test('WS-02 create-workshop writes a new workshopconfiguration doc and navigates to its config page', async ({ page }) => {
    // Unique title so the app-written doc (NO testrunid) is identifiable + cleanable by its natural key.
    const title = `WS02 Created ${RUN} ${Date.now()}`;
    try {
      await loginAsWshopAdmin(page);
      await page.goto('/create-workshop', { waitUntil: 'domcontentloaded' });
      await expect(page).toHaveURL(/create-workshop/, { timeout: 30_000 });

      // [REAL-UI] fill the title + every date/time control. The Material datepicker matInput parses a
      // typed M/D/YYYY (MatNativeDateModule default); the MatTimepicker input parses a typed "h:mm AM".
      // type=workshop is the form default (create-workshop.component.ts:134) — no need to touch the select.
      const titleInput = page.locator('input[formcontrolname="title"]');
      await expect(titleInput, 'WS-02: the title input must render').toBeVisible({ timeout: 30_000 });
      await titleInput.fill(title);

      // A coherent ramp: reg-start < reg-end < ws-start < ws-end (the form's cross-field validator).
      const dates: Record<string, string> = {
        registrationStartDate: '6/1/2026', registrationEndDate: '6/5/2026',
        workshopStartDate: '6/10/2026', workshopEndDate: '6/20/2026',
      };
      const times: Record<string, string> = {
        registrationStartTime: '9:00 AM', registrationEndTime: '5:00 PM',
        workshopStartTime: '9:00 AM', workshopEndTime: '5:00 PM',
      };
      for (const [ctrl, val] of Object.entries(dates)) {
        const inp = page.locator(`input[formcontrolname="${ctrl}"]`);
        await inp.fill(val);
        await inp.blur();
      }
      for (const [ctrl, val] of Object.entries(times)) {
        const inp = page.locator(`input[formcontrolname="${ctrl}"]`);
        await inp.fill(val);
        await inp.blur();
      }

      // [REAL-UI] submit. createWorkshop() setDoc's the new doc then router.navigate(['/workshopconfig', id]).
      await page.getByRole('button', { name: /Create Workshop/i }).click();

      // [ASSERT] the app navigated to the new config page — capture the new docid from the URL (the app
      // chose the id; we never wrote it).
      await expect(page, 'WS-02: app navigates to /workshopconfig/<newId>').toHaveURL(/\/workshopconfig\/[A-Za-z0-9]+/, { timeout: 30_000 });
      const newId = page.url().split('/workshopconfig/')[1].split(/[/?#]/)[0];
      expect(newId, 'WS-02: a real generated docid is in the URL').toBeTruthy();

      // [ASSERT] read the doc the app WROTE and compare detailpage.title to the KNOWN typed title.
      const after = await pollUntil(
        () => getDoc('workshopconfiguration', newId),
        (d) => !!d && (d as any).detailpage?.title === title,
        { label: 'WS-02: new workshopconfiguration.detailpage.title === typed title', timeoutMs: 30_000 },
      );
      expect((after as any)!.detailpage.title, 'WS-02: app persisted the typed title').toBe(title);
      expect((after as any)!.docid, 'WS-02: app stamped docid == the generated id').toBe(newId);
    } finally {
      // Clean the app-written doc by its natural key (the unique title) so re-runs do not accumulate.
      // detailpage.title is a nested field equality — supported without a composite index.
      const created = await queryWhere('workshopconfiguration', [['detailpage.title', '==', title]]).catch(() => []);
      const adminDb = db() as any;
      for (const d of created) await adminDb.collection('workshopconfiguration').doc(d.id).delete().catch(() => {});
    }
  });

  // ------------------------------------------------------------------------------------------
  // WS-06 — workshop-config "Add curriculum" + save grows challenges[] by exactly 1 in Firestore.
  //         App output (the new array length) vs the KNOWN before-length (anti-circular).
  // ------------------------------------------------------------------------------------------
  test('WS-06 adding a curriculum and saving grows workshopconfiguration.challenges by 1', async ({ page }) => {
    // Precondition: a KNOWN baseline of exactly 1 curriculum (idempotent for re-runs).
    await resetWorkshopConfigBaseline();
    const before = await getDoc('workshopconfiguration', wsIds.W_INACTIVE);
    const beforeLen = ((before as any)?.challenges || []).length;
    expect(beforeLen, 'WS-06: baseline has exactly 1 curriculum').toBe(1);

    await loginAsWshopAdmin(page);
    await page.goto(`/workshopconfig/${wsIds.W_INACTIVE}`, { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(new RegExp(`workshopconfig/${wsIds.W_INACTIVE}`), { timeout: 30_000 });

    // V2 EDITOR (app.routes.ts:287): /workshopconfig/:id loads WorkshopConfigurationv2Component, whose
    // curriculum lives in the app-workshop-challengesv2 child. Two things changed from the legacy editor
    // this case was written against, and each one on its own made it fail:
    //
    //  1. THE TABS ARE NOT mat-tabs. V2 renders a plain
    //     `<button class="tab" *ngFor="let tab of tabs">` strip (component.html:93-94), so there is no
    //     role="tab" anywhere on the page — getByRole('tab', …) matched nothing and timed out.
    //  2. A NEW SET NEEDS NO TYPE. v2's addCurriculum() seeds `type: ['challenge', Validators.required]`
    //     (challenges component.ts:283-285) because the segmented control has no empty state. The legacy
    //     flow of opening a mat-select and picking "Activity" has no v2 equivalent, and the markup it
    //     drove (.curriculum-card, mat-select[formcontrolname="type"]) does not exist.
    const challengeTab = page.getByRole('button', { name: 'Challenges', exact: true });
    await expect(challengeTab, 'WS-06: the Challenges tab button must render').toBeVisible({ timeout: 30_000 });
    await challengeTab.click();

    // [REAL-UI] "Add set" → addCurriculum() pushes a valid FormGroup and marks it dirty (ts:307).
    const addBtn = page.getByRole('button', { name: 'Add set', exact: true }).first();
    await expect(addBtn, 'WS-06: the Add set button must render').toBeVisible({ timeout: 15_000 });
    await addBtn.click();

    // [REAL-UI] save the curriculum (saveChallengesPage → updateDoc { challenges }). The v2 save bar
    // renders "Save Challenges" DISABLED in its idle/blocked/saved states and enabled only when dirty
    // (challenges component.html:656-679), so assert enabled first — that both proves the add registered
    // as a change and stops a future gate regression from timing out inside click().
    const saveBtn = page.getByRole('button', { name: /Save Challenges/i });
    await expect(saveBtn, 'WS-06: adding a set must make the curriculum save bar dirty/enabled')
      .toBeEnabled({ timeout: 15_000 });
    await saveBtn.click();

    // [ASSERT] the app's updateDoc grew challenges[] by exactly 1 (beforeLen + 1). Polled from Firestore —
    // the array length the PRODUCT wrote, compared to the KNOWN before-length.
    const after = await pollUntil(
      () => getDoc('workshopconfiguration', wsIds.W_INACTIVE),
      (d) => !!d && ((d as any).challenges || []).length === beforeLen + 1,
      { label: `WS-06: challenges length → ${beforeLen + 1}`, timeoutMs: 30_000 },
    );
    expect(((after as any)!.challenges || []).length, 'WS-06: app grew challenges by 1').toBe(beforeLen + 1);
  });

  // ------------------------------------------------------------------------------------------
  // WS-10 — settings save WRITES triggerFunction:true (the gate the workshopconfiguration CF reads).
  //         The CF itself is NOT deployed on the test project, so we assert the UI's OWN write and
  //         SKIP-GUARD the participant-workshop propagation (documented). App output vs known pre-state.
  // ------------------------------------------------------------------------------------------
  test('WS-10 toggling triggerFunction in Settings and saving writes triggerFunction:true', async ({ page }) => {
    // Precondition: triggerFunction starts false (idempotent).
    await resetWorkshopConfigBaseline();
    const before = await getDoc('workshopconfiguration', wsIds.W_INACTIVE);
    expect((before as any)?.triggerFunction ?? false, 'WS-10: triggerFunction starts false').toBe(false);

    await loginAsWshopAdmin(page);
    await page.goto(`/workshopconfig/${wsIds.W_INACTIVE}`, { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(new RegExp(`workshopconfig/${wsIds.W_INACTIVE}`), { timeout: 30_000 });

    // V2 EDITOR (app.routes.ts:287) — see the note on WS-06. Two changes broke this case:
    //  1. The tab strip is plain `<button class="tab">`, not mat-tabs, so role="tab" matched nothing.
    //  2. The toggle is no longer a mat-slide-toggle bound to formControlName="triggerFunction". V2's
    //     app-workshop-settingsv2 renders `<button class="toggle" aria-label="Update Participant Workshop"
    //     (click)="toggleField('triggerFunction')">` (workshop-settingsv2.component.html:178) — a plain
    //     button driving the control imperatively, so the old attribute locator has nothing to match.
    const settingsTab = page.getByRole('button', { name: 'Settings', exact: true });
    await expect(settingsTab, 'WS-10: the Settings tab button must render').toBeVisible({ timeout: 30_000 });
    await settingsTab.click();

    // [REAL-UI] flip "Update Participant Workshop" ON. The aria-label is the accessible name.
    const toggle = page.getByRole('button', { name: 'Update Participant Workshop', exact: true });
    await expect(toggle, 'WS-10: the triggerFunction toggle must render in Settings').toBeVisible({ timeout: 15_000 });
    await toggle.click();

    // [REAL-UI] save settings. Same save-bar pattern as the other two tabs: "Save Settings" renders
    // disabled in idle/blocked/saved and enabled only when dirty (settings component.html:700-728).
    const saveBtn = page.getByRole('button', { name: /Save Settings/i });
    await expect(saveBtn, 'WS-10: flipping the toggle must make the settings save bar dirty/enabled')
      .toBeEnabled({ timeout: 15_000 });
    await saveBtn.click();

    // [ASSERT] the app's updateDoc wrote triggerFunction:true. Polled — the value the PRODUCT wrote.
    const after = await pollUntil(
      () => getDoc('workshopconfiguration', wsIds.W_INACTIVE),
      (d) => !!d && (d as any).triggerFunction === true,
      { label: 'WS-10: workshopconfiguration.triggerFunction → true', timeoutMs: 30_000 },
    );
    expect((after as any)!.triggerFunction, 'WS-10: app wrote triggerFunction:true').toBe(true);

    // SKIP-GUARD (documented): the `workshopconfiguration` CF that would propagate this trigger into the
    // enrolled `participant workshop` docs is NOT deployed on slabs-queue-e2e-exdcz (verified). We assert
    // the UI write above (the trigger gate the CF reads) and intentionally do NOT assert a CF rollup.
  });
});

// ============================================================================================
// Group B — workshop dashboard: ENROLL dialog (two app writes) + split metrics + comms safety
// ============================================================================================
test.describe('Workshops deep — dashboard enroll + metrics (real UI, anti-circular)', () => {
  let guard: ConsoleGuard;
  test.beforeEach(async ({ page }) => {
    guard = attachConsoleGuard(page);
  });
  test.afterEach(() => assertNoFatal(guard, 'workshops deep (dashboard): no fatal console errors / pageerrors'));

  // ------------------------------------------------------------------------------------------
  // WS-08 — the ENROLL dialog creates EXACTLY one `workshop participant enrolled` doc and one
  //         `participant workshop` doc for the chosen profile. App output (post-state counts) vs the
  //         KNOWN before-counts. The enroll button is gated to the mover profileid (dashboard html:62).
  // ------------------------------------------------------------------------------------------
  test('WS-08 enrolling a participant writes one enrolled doc + one participant-workshop doc', async ({ page }) => {
    await installWshopStubs(page);
    // Precondition: p2 is NOT enrolled in the dashboard workshop (idempotent — delete any prior enroll).
    await cleanEnrollmentForP2();
    const dashRef = (db() as any).collection('workshopconfiguration').doc(wsIds.W_DASH);
    const enrolledBefore = await countWhere('workshop participant enrolled', [['workshopref', '==', dashRef]]);
    const pwBefore = await countWhere('participant workshop', [['workshopref', '==', dashRef]]);

    // Log in as the MOVER (its profileid is the hardcoded id that renders the Enroll button).
    await loginAsWshopMover(page);
    await page.goto(`/workshop_dashboard/${wsIds.W_DASH}`, { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(new RegExp(`workshop_dashboard/${wsIds.W_DASH}`), { timeout: 30_000 });

    // [REAL-UI] open the Enroll dialog (manualenroll()).
    const enrollBtn = page.getByRole('button', { name: /^Enroll$/i }).first();
    await expect(enrollBtn, 'WS-08: the mover-gated Enroll button must render').toBeVisible({ timeout: 30_000 });
    await enrollBtn.click();

    // The dialog's mat-select lists every NOT-yet-enrolled profile (enroll.component.ts:66-71).
    //
    // OPTION LABELS ARE EMAILS, NOT NAMES: the template renders `mapProfile[profile]`
    // (enroll.component.html:14), and that map comes from the profile service as profileid → EMAIL — the
    // observed listbox was [admin+cont@…, admin+wshop@…, mover+wshop@…, participant0+cont@…,
    // participant2+wshop@…]. This case previously looked for the display name "WS Charlie <run>", which
    // the dialog never renders, so the option was never found. Key off p2's seeded email instead.
    const select = page.getByRole('combobox', { name: /Select Participants/i });
    await expect(select, 'WS-08: the participant select must render in the dialog').toBeVisible({ timeout: 20_000 });
    await select.click({ force: true });
    const p2Option = page.getByRole('option', { name: wsActors.participant2, exact: true });
    await expect(p2Option, 'WS-08: the un-enrolled participant must be an option').toBeVisible({ timeout: 15_000 });
    await p2Option.click();
    // The select is `multiple`, so its panel stays open after the pick and the CDK lays a transparent
    // BACKDROP over the dialog. Clicking the dialog title to dismiss it — the old approach — cannot work:
    // that backdrop intercepts the pointer event, and the click retried until the 120s test timeout.
    // Escape is the dismissal the overlay actually listens for; the CDK keyboard dispatcher routes it to
    // the TOPMOST overlay, which is the select panel, so the MatDialog beneath stays open.
    await page.keyboard.press('Escape');
    // Wait for the SELECT PANEL specifically. Neither a bare getByRole('listbox') nor '.cdk-overlay-backdrop'
    // can be asserted to 0 here: the MatDialog is itself an overlay, so it contributes its own backdrop and
    // its own listbox. Both counts go 2 → 1, never to 0, and asserting 0 fails even though Escape worked.
    // `.mat-mdc-select-panel` belongs only to the mat-select overlay, so it is the unambiguous signal.
    await expect(page.locator('.mat-mdc-select-panel'),
      'WS-08: the participant select panel must close before Enroll is clickable')
      .toHaveCount(0, { timeout: 10_000 });

    // [REAL-UI] click the dialog's Enroll (Enroll() setDoc's both the enrolled + participant-workshop docs).
    await page.getByRole('button', { name: /^Enroll$/i }).last().click();

    // [ASSERT] both collections grew by exactly 1 for THIS workshop. Counts are read from Firestore
    // (the docs the APP wrote — they carry NO testrunid; we count by the natural workshopref key), and
    // compared to the KNOWN before-counts. Never an assertion against a value the test wrote.
    await pollUntil(
      () => countWhere('workshop participant enrolled', [['workshopref', '==', dashRef]]),
      (n) => n === enrolledBefore + 1,
      { label: `WS-08: workshop participant enrolled count → ${enrolledBefore + 1}`, timeoutMs: 30_000 },
    );
    await pollUntil(
      () => countWhere('participant workshop', [['workshopref', '==', dashRef]]),
      (n) => n === pwBefore + 1,
      { label: `WS-08: participant workshop count → ${pwBefore + 1}`, timeoutMs: 30_000 },
    );
    // Corroborate the app-written enrolled doc is for p2, in the status the dialog actually sets.
    //
    // STATUS IS 'enrolled', NOT 'enrollednotstarted': Enroll() writes a hardcoded `status:'enrolled'`
    // (enroll.component.ts:100) — the string 'enrollednotstarted' appears nowhere in that component. The
    // old expectation was simply wrong about the app. Note this is the status the DASHBOARD then counts
    // under "Total Started" rather than "Not Started" (see WS-DASH-SPLIT below), so a manually enrolled
    // participant is reported as started before they have started anything — flagged for the app owners,
    // not pinned here, because nothing in the component claims otherwise.
    const enr = await queryWhere('workshop participant enrolled', [['workshopref', '==', dashRef], ['profileid', '==', wsProfileIds.p2]]);
    expect(enr.length, 'WS-08: exactly one enrolled doc for p2').toBe(1);
    expect((enr[0] as any).status, "WS-08: the dialog enrolled p2 with status 'enrolled'").toBe('enrolled');

    // Cleanup (re-runnable): delete the app-written docs by their natural key.
    await cleanEnrollmentForP2();
  });

  // ------------------------------------------------------------------------------------------
  // WS-DASH-SPLIT — the dashboard splits enrolled into Total Started (status 'enrolled') vs Not Started
  //         (status 'enrollednotstarted') vs Active (progress>0). KNOWN seed: p0 enrolled@50%, p1 not-
  //         started → Started=1, NotStarted=1, Active=1. App-computed metrics vs the known split.
  // ------------------------------------------------------------------------------------------
  test('WS-DASH-SPLIT dashboard renders Total Started=1 / Not Started=1 / Active=1 from the seeded split', async ({ page }) => {
    await installWshopStubs(page);
    await loginAsWshopAdmin(page);
    await page.goto(`/workshop_dashboard/${wsIds.W_DASH}`, { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(new RegExp(`workshop_dashboard/${wsIds.W_DASH}`), { timeout: 30_000 });

    const cardValue = async (label: string): Promise<number> => {
      const card = page.locator('mat-card.metric-card').filter({ hasText: label });
      await expect(card, `metric card "${label}" must render`).toBeVisible({ timeout: 30_000 });
      const txt = (await card.locator('.metric-value, h2').first().innerText()).trim();
      return parseInt(txt.replace(/[^0-9]/g, ''), 10);
    };

    // [ASSERT] each app-computed metric (updateMetrics, ts:1054-1068) matches the KNOWN seeded split.
    await expect.poll(async () => cardValue('Total Started'), {
      message: 'WS-DASH-SPLIT: Total Started (status enrolled = p0) renders 1', timeout: 30_000,
    }).toBe(1);
    await expect.poll(async () => cardValue('Not Started'), {
      message: 'WS-DASH-SPLIT: Not Started (status enrollednotstarted = p1) renders 1', timeout: 15_000,
    }).toBe(1);
    await expect.poll(async () => cardValue('Active Participants'), {
      message: 'WS-DASH-SPLIT: Active (progress>0 = p0@50%) renders 1', timeout: 15_000,
    }).toBe(1);
  });
});

// ============================================================================================
// Group B2 — comms safety (NO no-fatal guard: this case DELIBERATELY drives a firewalled comms path;
// on the test project getCloudFunctionUrl('workshopprogressmessage') returns '' so the app's bulk-send
// POST cannot resolve to a real CF and the app logs a benign "Failed to send bulk emails" — which is
// the EXPECTED, harmless consequence of the empty CF URL and is unrelated to the safety oracle below).
// ============================================================================================
test.describe('Workshops deep — comms safety (no production cloud-function escape)', () => {
  // ------------------------------------------------------------------------------------------
  // WS-09 / WS-14 — driving the dashboard Send-Email path must NOT reach any PRODUCTION cloud function.
  //         The prod firewall records every production endpoint it blocks; after the send, that list
  //         must contain NO cloudfunctions.net host. The recon's original "assert a POST to the CF URL"
  //         basis is IMPOSSIBLE here (the test project has no workshopprogressmessage URL and the CF is
  //         not deployed), so we assert the genuinely-valuable inverse: zero prod comms escaped.
  // ------------------------------------------------------------------------------------------
  test('WS-09/WS-14 the dashboard Send-Email flow never reaches a production cloud function', async ({ page }) => {
    const blocked = await installWshopStubsCapturingProdBlocks(page);
    await loginAsWshopAdmin(page);
    await page.goto(`/workshop_dashboard/${wsIds.W_DASH}`, { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(new RegExp(`workshop_dashboard/${wsIds.W_DASH}`), { timeout: 30_000 });

    // The Send-Email button lives in the participant panel that opens on a metric click. Open the
    // "Total Enrolled" panel first (onMetricClick('totalEnrolled') → showParticipantPanel=true).
    const enrolledCard = page.locator('mat-card.metric-card').filter({ hasText: 'Total Enrolled' });
    await expect(enrolledCard, 'WS-14: the Total Enrolled card must render').toBeVisible({ timeout: 30_000 });
    await enrolledCard.click();

    // The panel's envelope button opens the Send-Message dialog (sendMail() → SendmessagesComponent).
    const envelope = page.locator('.participant-panel button:has(i.fa-envelope)').first();
    await expect(envelope, 'WS-14: the Send-Email (envelope) button must render once the panel opens').toBeVisible({ timeout: 20_000 });
    await envelope.click();

    // [REAL-UI] EMAIL CAMPAIGN COMPOSER (participants-analytics/email-input) — this replaced the old
    // free-text Send-Message dialog that had textarea[formcontrolname="subject"]/"message". There is no
    // free-text compose path any more: the composer sends a TEMPLATE, and its own "Create Template"
    // button closes the dialog and routes to /email-templates (email-input.component.ts:848). The
    // seed therefore provides one approved template (seed-workshops.js, ID.EMAIL_TPL) as a precondition.
    const composer = page.getByRole('dialog');
    await expect(composer.getByRole('heading', { name: 'Email Campaign Composer' }),
      'WS-14: the Email Campaign Composer must open').toBeVisible({ timeout: 20_000 });

    // Picking a card runs onTemplateChange (ts:472-482): it fills bufferDoc.subject/body from the
    // template and switches to the Preview tab. Until then every send button is hidden behind
    // *ngIf="isTemplatePresent()" (component.html:727).
    const card = composer.locator('.template-card').filter({ hasText: `WS Comms Template ${RUN}` });
    await expect(card, 'WS-14: the seeded email template must render as a selectable card')
      .toBeVisible({ timeout: 20_000 });
    await card.click();

    // The composer confirms before sending (`confirm('Are you sure to send email to Participants?')`,
    // ts:721). Playwright DISMISSES dialogs by default, which would cancel the send and leave the comms
    // path undriven — accept it so the app actually reaches closeWithPayload('send').
    page.once('dialog', (d) => { void d.accept(); });

    // formValidation() (ts:710-717) gates the button on subject + body + broadcastname + configured
    // variables; the template supplies the first two, the composer auto-names the broadcast, and the
    // seeded body has no variables. Assert ENABLED first so a future gate change reports the real reason
    // instead of timing out inside click().
    const sendBtn = composer.getByRole('button', { name: /Send to Participants/i });
    await expect(sendBtn, 'WS-14: selecting a template must enable the send button')
      .toBeEnabled({ timeout: 20_000 });
    await sendBtn.click();

    // Give the post path a moment to fire (or be firewalled).
    await page.waitForTimeout(1500);

    // [ASSERT] the firewall captured ZERO production cloud-function escapes. This is the real anti-
    // circular safety oracle for the comms path: a value the FIREWALL observed about the app's network,
    // not a value the test wrote. (Any *.cloudfunctions.net host that is NOT the test project is "prod".)
    const prodEscapes = blocked.filter((u) => /cloudfunctions\.net/i.test(u));
    expect(prodEscapes, `WS-09/14: no production cloud function may be reached. Captured: ${JSON.stringify(prodEscapes)}`).toHaveLength(0);
  });
});

// ============================================================================================
// Group C — cross-feature engagement count + product-page render (real reads → app-rendered values)
// ============================================================================================
test.describe('Workshops deep — engagement + product page (real UI, anti-circular)', () => {
  // The engagement & product screens do heavy cross-feature reads on a sparse test project; like the
  // route-mount smoke we DON'T assert no-fatal here (benign cross-feature read warnings are expected).
  // The anti-circular assertion is on the value the app RENDERED, independently bounded by Firestore.

  // ------------------------------------------------------------------------------------------
  // WS-15 — the engagement dashboard's "Active Participants" count is what the app computed from its
  //         own read of `participant metadata where customerstatus=='active'`. Two-sided anti-circular
  //         bound: 1 <= rendered <= the Firestore count of active participants (the app cannot invent
  //         participants beyond the live active pool, and our seed guarantees at least the 3 it seeded).
  // ------------------------------------------------------------------------------------------
  test('WS-15 engagement dashboard active-participant count is bounded by the live active pool', async ({ page }) => {
    await installWshopStubs(page);
    await loginAsWshopAdmin(page);
    await page.goto('/engagementdashboard', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/engagementdashboard/, { timeout: 30_000 });

    // [REAL-UI] the "Active Participants" metric renders getActiveParticipants() = allActiveParticipants
    // .length, populated from participant metadata filtered by customerstatus==='active' (ts:235,317,660).
    const card = page.locator('mat-card.metric-card').filter({ hasText: /Active Participants|Non Active Participants/i }).first();
    await expect(card, 'WS-15: the Active Participants metric card must render').toBeVisible({ timeout: 60_000 });

    // Independent Firestore oracle: the count of active participants (the app's read universe).
    const firestoreActive = await countWhere('participant metadata', [['customerstatus', '==', 'active']]);
    expect(firestoreActive, 'WS-15: precondition — the project has >= the 3 active participants we seeded').toBeGreaterThanOrEqual(3);

    // The app loads asynchronously; poll the rendered value until it settles into the valid window.
    const rendered = await pollUntil(
      async () => {
        const txt = (await card.locator('.metric-value, h2, p.metric-value').first().innerText()).trim();
        return parseInt(txt.replace(/[^0-9]/g, ''), 10);
      },
      (n) => Number.isFinite(n) && n >= 1 && n <= firestoreActive,
      { label: `WS-15: active-participant count in [1, ${firestoreActive}]`, timeoutMs: 60_000, intervalMs: 1500 },
    );
    // App-computed value, bounded by the independent Firestore count — never a value the test wrote.
    expect(rendered, `WS-15: app-rendered active count (${rendered}) must be in [1, ${firestoreActive}]`).toBeGreaterThanOrEqual(1);
    expect(rendered, `WS-15: app cannot render more actives than exist (${rendered} <= ${firestoreActive})`).toBeLessThanOrEqual(firestoreActive);
  });

  // ------------------------------------------------------------------------------------------
  // WS-PRODUCT — the product-page renders one row per product in the seeded `static meta data/Product
  //         Page` doc. App output (rendered rows) vs the KNOWN seeded products. The app READ the doc;
  //         we assert the table it built shows exactly the seeded product names.
  // ------------------------------------------------------------------------------------------
  test('WS-PRODUCT productpageworkshop renders the seeded product rows from static meta data', async ({ page }) => {
    await installWshopStubs(page);
    await loginAsWshopAdmin(page);
    await page.goto('/productpageworkshop', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/productpageworkshop/, { timeout: 30_000 });

    // [REAL-UI] loadProducts() reads static meta data/Product Page and feeds products[] into the table.
    // Each seeded product name must appear as a rendered cell the app drew from the doc it read.
    for (const name of wsProductNames) {
      await expect(
        page.getByText(name, { exact: false }),
        `WS-PRODUCT: the app must render the seeded product "${name}" from the doc it read`,
      ).toBeVisible({ timeout: 30_000 });
    }
    // And the rendered row count equals the seeded product count (app output vs known seed length).
    const rows = page.locator('table.mat-mdc-table tr.mat-mdc-row, table tr[mat-row]');
    await expect.poll(async () => rows.count(), {
      message: `WS-PRODUCT: rendered product rows == ${wsProductNames.length} seeded`, timeout: 15_000,
    }).toBe(wsProductNames.length);
  });
});

// ============================================================================================
// Group D — list DUPLICATE write + legacy eiflix route smokes
// ============================================================================================
test.describe('Workshops deep — duplicate write + legacy route smokes', () => {
  let guard: ConsoleGuard;
  test.beforeEach(async ({ page }) => {
    guard = attachConsoleGuard(page);
    await installWshopStubs(page);
  });

  // ------------------------------------------------------------------------------------------
  // WS-13 — duplicating a workshop from the list creates a NEW workshopconfiguration doc with active:false
  //         and the SAME title. App output (post-state count + the duplicate doc's fields) vs known.
  // ------------------------------------------------------------------------------------------
  test('WS-13 duplicating the active workshop creates an active:false copy with the same title', async ({ page }) => {
    const sourceTitle = `Active Workshop ${RUN}`; // the seeded W_ACTIVE detailpage.title
    // Precondition: remove any prior duplicate (idempotent — the assertion reads the delta).
    await cleanDuplicateWorkshops(sourceTitle);
    const inactiveBefore = await countWhere('workshopconfiguration', [['active', '==', false]]);

    try {
      await loginAsWshopAdmin(page);
      await page.goto('/workshops', { waitUntil: 'domcontentloaded' });
      await expect(page).toHaveURL(/workshops/, { timeout: 30_000 });

      // hasText with a STRING is a case-insensitive SUBSTRING match, and the seed deliberately carries
      // both "Active Workshop <run>" and "Inactive Workshop <run>" — the latter CONTAINS the former, so
      // the plain string matched two rows and failed on strict mode. Anchor with a case-sensitive regex:
      // \b does not fire between the "n" and "a" of "Inactive", so only the real active row matches.
      const row = page.locator('tr.mat-mdc-row, tr[mat-row]')
        .filter({ hasText: new RegExp(`\\b${sourceTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`) });
      await expect(row, 'WS-13: exactly the active workshop row must render (not the Inactive one)')
        .toHaveCount(1, { timeout: 30_000 });

      // [REAL-UI] accept the duplicate confirm(), then click the row's Duplicate icon (duplicateWorkshop()).
      page.once('dialog', (d) => d.accept());
      await row.locator('button.duplicate-btn, button[mattooltip="Duplicate"]').first().click();

      // [ASSERT] the active:false set grew by exactly 1 (the app addDoc'd a copy with active:false), and a
      // NEW doc (no testrunid) carries the SAME detailpage.title. Counts/fields are the app's output.
      await pollUntil(
        () => countWhere('workshopconfiguration', [['active', '==', false]]),
        (n) => n === inactiveBefore + 1,
        { label: `WS-13: active:false count → ${inactiveBefore + 1}`, timeoutMs: 30_000 },
      );
      // duplicateWorkshop() copies the SOURCE DOC WHOLESALE — including our seed's `testrunid`. Filtering
      // on `testrunid !== RUN` therefore threw away the duplicate itself (the count poll above had already
      // proved one was written). The app-written copy is identified by its GENERATED id instead: it is the
      // active:false doc carrying the source title whose id is not one of our seeded ids.
      const seededIds = new Set<string>(Object.values(wsIds));
      const findDup = async () => (await queryWhere('workshopconfiguration', [['active', '==', false]]))
        .filter((d) => (d as any).detailpage?.title === sourceTitle && !seededIds.has(d.id));

      // TWO WRITES, NOT ONE: duplicateWorkshop() addDoc()s the copy and only THEN
      // `updateDoc(newDocRef, { docid: newDocRef.id })` (workshops.component.ts:310-315). The count poll
      // above is satisfied by the FIRST write, so reading the doc immediately catches it mid-flight with
      // the SOURCE's docid still copied in — which is what failed here ("wshop_W_active"). Poll for the
      // second write instead of racing it; this asserts the app's own re-stamp, not a value we wrote.
      const dups = await pollUntil(
        findDup,
        (list) => list.length === 1 && (list[0] as any).docid === list[0].id,
        { label: 'WS-13: the duplicate carries its OWN generated docid (the post-addDoc updateDoc landed)', timeoutMs: 30_000 },
      );
      expect(dups.length, 'WS-13: exactly one app-written duplicate with the source title + active:false').toBe(1);
      expect((dups[0] as any).active, 'WS-13: the duplicate is inactive').toBe(false);
      expect((dups[0] as any).docid, 'WS-13: the app stamped docid on the duplicate (updateDoc after addDoc)').toBe(dups[0].id);
    } finally {
      await assertNoFatal(guard, 'workshops deep (duplicate): no fatal console errors / pageerrors');
      await cleanDuplicateWorkshops(sourceTitle);
    }
  });

  // ------------------------------------------------------------------------------------------
  // Legacy eiflix route smokes — the four legacy Workshop/* routes (recon §Risks #10) mount for the
  //         super-role admin without bouncing to /login. These are guarded by the SAME authGuard +
  //         dashboard grants; this proves the legacy routes are reachable (P2 route-loads smoke). No
  //         no-fatal assertion (legacy screens read sparse eiflix collections that may warn benignly).
  // ------------------------------------------------------------------------------------------
  test('legacy eiflix workshop routes mount for the admin (no /login bounce)', async ({ page }) => {
    await loginAsWshopAdmin(page);
    const ROUTES = [
      '/workshopchallengecreation',
      '/enrollment_config_view',
      '/workshopchallengeparticipantdashboard',
      '/workshop_image_upload',
    ];
    const bounced: string[] = [];
    for (const route of ROUTES) {
      await page.goto(route, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(800); // bounded settle (these screens read images/forms; networkidle hangs)
      if (/\/login/.test(page.url())) bounced.push(`${route} -> ${page.url()}`);
    }
    expect(bounced, `legacy routes that bounced to /login (missing dashboard grant): ${bounced.join(', ')}`).toHaveLength(0);
  });
});
