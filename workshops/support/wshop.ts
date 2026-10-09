// wshop.ts — actors, login, and the per-test external/prod stub installer for the Workshops suite.
//
// Reuses the queue suite's real-login form helper (actors.ts loginAs), external stubs (Zoom/FCM/
// Wati/email/OpenVidu), and the prod-endpoint firewall (e2e/_shared/prod-firewall) so no workshop
// screen can hit a real production Cloud Function (workshopprogressmessage / sendBatchEmail prod URLs)
// or open a real Zoom window. NOTE: on the test project getCloudFunctionUrl() returns '' for
// workshopprogressmessage (the project isn't in its URL map, workshop-dashboard.component.ts:481), so
// the comms HTTP path is inert here regardless — the firewall is belt-and-suspenders.
import { Page } from '@playwright/test';
import { loginAs } from '../../queue/support/actors';
import { installAllExternalStubs } from '../../queue/stubs';
import { installProdFirewall } from '../../_shared/prod-firewall';

const RUN = process.env.WSHOP_RUNID || 'wshop';
export const PASSWORD = 'Test!1234';

/** Seeded product-page products (seed-workshops.js Product Page doc). The product-page screen renders
 *  one row per entry — the deep case asserts the app drew exactly these names from the doc it read. */
export const wsProductNames = [
  `WS Product Alpha ${RUN}`,
  `WS Product Bravo ${RUN}`,
];

/** Seeded workshop actors (seed-workshops.js roster). */
export const wsActors = {
  admin: `admin+${RUN}@example.com`,        // roles {admin, ah} — super-role (list/config/dashboard)
  mover: `mover+${RUN}@example.com`,        // profileid is the hardcoded move-next id (WS-12)
  limited: `limited+${RUN}@example.com`,    // same roles/routes as admin — only Dashboard Access differs
  participant0: `participant0+${RUN}@example.com`,
  participant1: `participant1+${RUN}@example.com`,
  participant2: `participant2+${RUN}@example.com`,
};

/**
 * `participant metadata`.name / .email are NOT ours to choose — they are CF-OWNED. The deployed trigger
 * profiledata_to_participantmetadata (starlabs-cloud-function/functions/components/participantmetadata.js)
 * fires on every profile_data write and merge-sets {name, email, countrycode, phonenumber} :=
 * profile_data.{name, email, countrycode, number}, and seedAuthChain sets profile_data.name = the actor's
 * EMAIL. That CF write is async and lands seconds AFTER seed-workshops.js wrote "WS Alpha <run>", so the
 * dashboard and the Communication dialog render the EMAIL as the name (observed in CI 2026-09-15: the card
 * read "participant0+wshop@example.com"). These are the names a spec can rely on; call
 * alignWorkshopMetadataNames() first so the precondition holds in BOTH orders (same approach as evomap's
 * evoMetaNames — see evomap/support/evomap.ts). Phone (9999900000) and country code (+91) are identical on
 * both sides, and new_user_data people have no profile_data, so their seeded names ("NU Alpha <run>") stand.
 */
export const wsMetaNames = {
  p0: wsActors.participant0,
  p1: wsActors.participant1,
  p2: wsActors.participant2,
  // The staff actors have profile_data too, so the same CF rewrites THEIR metadata name to their email.
  // The Dashboard Access pickers list people from `participant metadata`, so these are the labels those
  // pickers actually render — never the seed's "WS Admin <run>".
  admin: wsActors.admin,
  mover: wsActors.mover,
  limited: wsActors.limited,
};

/**
 * PRECONDITION write only: put the CF's terminal name/email onto p0/p1/p2's `participant metadata` so a
 * spec sees the same values whether the CF landed before or after the seed. {merge:true} keeps the seeded
 * customerstatus / activejourney / phone fields the specs also assert on.
 */
export async function alignWorkshopMetadataNames(): Promise<void> {
  const admin = seed.initAdmin();
  const db = admin.firestore();
  const pairs: [string, string][] = [
    [wsProfileIds.p0, wsMetaNames.p0], [wsProfileIds.p1, wsMetaNames.p1], [wsProfileIds.p2, wsMetaNames.p2],
    [wsProfileIds.admin, wsMetaNames.admin], [wsProfileIds.mover, wsMetaNames.mover],
    [wsProfileIds.limited, wsMetaNames.limited],
  ];
  for (const [pf, email] of pairs) {
    await db.collection('participant metadata').doc(pf).set({ name: email, email: email.toLowerCase() }, { merge: true });
  }
}

/** Seeded profileids (for asserting app-written refs / progress rows). */
export const wsProfileIds = {
  admin: `${RUN}_pf_admin`,
  mover: '3LVxKXuyxldYoRDEpx5s', // == seed-workshops MOVER_PID (a plain opaque id since 2026-09-23)
  limited: `${RUN}_pf_limited`,
  p0: `${RUN}_pf_p0`,
  p1: `${RUN}_pf_p1`,
  p2: `${RUN}_pf_p2`,
};

/** Seeded doc ids the specs assert against (mirror seed-workshops.js ID). */
export const wsIds = {
  W_INACTIVE: `${RUN}_W_inactive`,
  W_ACTIVE: `${RUN}_W_active`,
  W_DASH: `${RUN}_W_dash`,
  ENR_A: `${RUN}_enr_a`,
  ENR_B: `${RUN}_enr_b`,
  PW_A: `${RUN}_pw_a`,
  PW_B: `${RUN}_pw_b`,
};

// =================================================================================================
// 2026-09-04 addendum — the nine previously-uncovered routes (WS-16..WS-33).
// Recon: e2e/recon-allcomp/workshops.md "Addendum — 2026-09-04".
// Ids and display names MIRROR seed-workshops.js; specs import from here so no spec ever hardcodes a
// seeded string (one place to change when the seed changes).
// =================================================================================================

/** Seeded doc ids for the addendum routes (mirror seed-workshops.js ID). */
export const wsAddIds = {
  EW_KEEP: `${RUN}_ew_keep`,
  EW_DEL: `${RUN}_ew_del`,
  HW_CS1: `${RUN}_hw_cs1`,
  HW_CS2: `${RUN}_hw_cs2`,
  HW_CS_NOORDER: `${RUN}_hw_cs3`,
  HW_ADS: `${RUN}_hw_ads`,
  HS_A: `${RUN}_hs_a`,
  EP_HS: `${RUN}_ep_hs`,
  JRN_AUD: `${RUN}_jrn_aud`,
  TIER_AUD: `${RUN}_tier_aud`,
  NUT_SEGMENT: `${RUN}_nut_seg`,
  NUT_CAL_A: `${RUN}_nut_cal_a`,
  NUT_CAL_B: `${RUN}_nut_cal_b`,
  NUT_LOC: `${RUN}_nut_loc`,
  NU_A: `${RUN}_nu_a`,
  NU_B: `${RUN}_nu_b`,
  NU_C: `${RUN}_nu_c`,
  CLASSIFY_DOC: 'eiflixdiscoverpage',
  EVT_BIG: `${RUN}_evt_big`,
  EVT_NONBIG: `${RUN}_evt_nonbig`,
  JRN_BIG: `${RUN}_jrn_big`,
  BEM: `${RUN}_evt_big`,   // == EVT_BIG — the bigeventmentor doc is keyed BY THE EVENT ID (ts:201,289)
  DF_A: `${RUN}_df_a`,
  CAMP_LIVE: `${RUN}_camp_live`,
  CAMP_SCHED: `${RUN}_camp_sched`,
  CAMP_ENDED: `${RUN}_camp_ended`,
  CAL_SINGLE: `${RUN}_cal_single`,
  CAL_SPAN: `${RUN}_cal_span`,
  CAL_DELETED: `${RUN}_cal_deleted`,
};

/** The five stacked calendar-event ids (one day, > MAX_CHIPS) — WS-33. */
export const wsCalStackIds = [1, 2, 3, 4, 5].map((n) => `${RUN}_cal_stack${n}`);

/** Seeded display strings the specs locate by. Kept next to the ids so both move together. */
export const wsAddNames = {
  ewKeep: `Legacy Keep ${RUN}`,
  ewDel: `Legacy Delete ${RUN}`,
  hwFirst: `HC First ${RUN}`,
  hwSecond: `HC Second ${RUN}`,
  hwUnordered: `HC Unordered ${RUN}`,
  hwAds: `HC AdOnly ${RUN}`,          // widgettype:'ads' — NEGATIVE CONTROL, must NOT show in tab 1
  hsSeries: `HC Series ${RUN}`,
  segment: `WS Segment ${RUN}`,
  calTypeA: `WS CalType A ${RUN}`,
  calTypeB: `WS CalType B ${RUN}`,
  venue: `WS Venue ${RUN}`,
  nuAlpha: `NU Alpha ${RUN}`,         // created -1d → newest
  nuBravo: `NU Bravo ${RUN}`,         // created -2d
  nuCharlie: `NU Charlie ${RUN}`,     // created -3d, UNTAGGED — NEGATIVE CONTROL for the tag filter
  classifySentinel: `SENTINEL ${RUN}`,   // NOT an allFields key → never in the save payload (WS-25)
  classifyText: `WS Orientation ${RUN}`,  // the `orientationbuttonname` text field (WS-24 read / WS-25 overwrite)
  evtBig: `BIG Event ${RUN}`,
  evtNonBig: `NonBIG Event ${RUN}`,   // NEGATIVE CONTROL — must NOT be offered by the B!G-only picker
  deliveryForm: `WS Form ${RUN}`,
  campLive: `Camp Live ${RUN}`,
  campSched: `Camp Sched ${RUN}`,
  campEnded: `Camp Ended ${RUN}`,
  calSingle: `Cal Single ${RUN}`,
  calSpan: `Cal Span ${RUN}`,
  calDeleted: `Cal Deleted ${RUN}`,   // deleted:true — NEGATIVE CONTROL, must never render
  /** The 5 stacked one-day events. All share a start date, so the app's (startdate, title) chip sort
   *  (wccalendar.component.ts:322-325) makes #1 reliably one of the 3 VISIBLE chips — a stable anchor
   *  for locating the overflow day cell in WS-33. */
  calStack: (n: number) => `Cal Stack ${n} ${RUN}`,
};

/** Day offsets the calendar seed used (specs need them to find the right day cell). */
export const wsCalOffsets = { single: 3, spanStart: 5, spanEnd: 7, stack: 10 };

/**
 * Re-create the WS-17 hard-delete target (`eiflix workshop/EW_DEL`) so the delete case is re-runnable.
 * PRECONDITION write only — WS-17 asserts the doc is GONE after the app's deleteDoc, never that this
 * write landed. All three Timestamps are mandatory: view-workshop.component.html:22/27/32 calls
 * .toDate() with no null guard, so a partial doc throws on render.
 */
export async function resetEiflixWorkshopDeleteTarget(): Promise<void> {
  const admin = seed.initAdmin();
  const db = admin.firestore();
  const T = admin.firestore.Timestamp;
  const at = (d: number) => { const x = new Date(); x.setDate(x.getDate() + d); x.setHours(9, 0, 0, 0); return T.fromDate(x); };
  await db.collection('eiflix workshop').doc(wsAddIds.EW_DEL).set({
    docid: wsAddIds.EW_DEL, title: wsAddNames.ewDel, description: `seeded legacy eiflix workshop ${wsAddNames.ewDel}`,
    startdate: at(3), enddate: at(10), lastregistrationdate: at(1), testrunid: RUN, _testdata: true,
  });
}

/**
 * Re-create the WS-20 delete target (`eiflixhomewidgets/HW_ADS`). This doc is ALSO the WS-18 negative
 * control, so the read case must run against a present doc — call this before WS-18 as well if the
 * suite order ever changes. PRECONDITION write only.
 */
export async function resetHomeWidgetAds(): Promise<void> {
  const admin = seed.initAdmin();
  const db = admin.firestore();
  await db.collection('eiflixhomewidgets').doc(wsAddIds.HW_ADS).set({
    docid: wsAddIds.HW_ADS, widgettype: 'ads', order: 1, head: 'AD', headright: 'NEW',
    title: wsAddNames.hwAds, subtitle: 'seeded ad', description: 'ads-tab only',
    footer: 'footer', buttonname: 'Go', navigationlink: 'https://example.com/ad', show: true,
    testrunid: RUN, _testdata: true,
  });
}

/**
 * Clear NU_C's tags so WS-23 starts from the KNOWN "untagged" precondition and the assertion is on the
 * tag array the APP wrote. PRECONDITION write only.
 */
export async function resetNewUserTags(): Promise<void> {
  const admin = seed.initAdmin();
  const db = admin.firestore();
  await db.collection('new_user_data').doc(wsAddIds.NU_C).set({ tags: [] }, { merge: true });
}

/**
 * Restore the classify sentinel + clear the field WS-25 types into, so the merge-safety assertion is
 * re-runnable. The SENTINEL is the whole point: WS-25 proves the app's setDoc(merge:true) (ts:1196) did
 * not clobber a field the UI never touched. PRECONDITION write only.
 */
export async function resetClassifySentinel(): Promise<void> {
  const admin = seed.initAdmin();
  const db = admin.firestore();
  await db.collection('classify').doc(wsAddIds.CLASSIFY_DOC).set({
    docid: wsAddIds.CLASSIFY_DOC,
    wsSentinel: wsAddNames.classifySentinel,
    orientationbuttonname: wsAddNames.classifyText,
    testrunid: RUN, _testdata: true,
  }, { merge: true });
}

/**
 * Reset the bigeventmentor buckets: p0 in `registered`, `reached` empty. WS-29 drives the real move and
 * asserts the app wrote BOTH sides (p0 added to reached AND removed from registered).
 * PRECONDITION write only.
 */
export async function resetBigEventMentorBuckets(): Promise<void> {
  const admin = seed.initAdmin();
  const db = admin.firestore();
  await db.collection('bigeventmentor').doc(wsAddIds.BEM).set({
    reached: [], registered: [wsProfileIds.p0], notregistered: [], noteligible: [],
  }, { merge: true });
}

/** Install the prod firewall + all external stubs. Call in beforeEach BEFORE navigating. */
export async function installWshopStubs(page: Page): Promise<void> {
  await installProdFirewall(page);
  installAllExternalStubs(page);
}

/**
 * Like installWshopStubs, but returns the live array of PRODUCTION endpoint URLs the firewall blocked.
 * Used by the comms-safety case (WS-09/WS-14): after driving the workshop comms path, the array must
 * stay empty for any *production* CF host (no real Wati/Postmark/sendBatchEmail escaped). The array is
 * mutated in place as requests are intercepted, so read it AFTER the action.
 */
export async function installWshopStubsCapturingProdBlocks(page: Page): Promise<string[]> {
  const blocked = await installProdFirewall(page);
  installAllExternalStubs(page);
  return blocked;
}

/** Log in via the real Angular login form as the seeded super-role admin. */
export async function loginAsWshopAdmin(page: Page): Promise<void> {
  await loginAs(page, wsActors.admin, PASSWORD);
}

/** Log in as the seeded "mover" admin (profileid in the hardcoded move-next allow-list). */
export async function loginAsWshopMover(page: Page): Promise<void> {
  await loginAs(page, wsActors.mover, PASSWORD);
}

/**
 * Log in as the seeded LIMITED admin — identical roles and route grants to `admin`, but named in no
 * global access list and granted exactly two dashboard actions on W_DASH. Anything this actor cannot
 * reach is the Dashboard Access gate, never the route guard.
 */
export async function loginAsWshopLimited(page: Page): Promise<void> {
  await loginAs(page, wsActors.limited, PASSWORD);
}

/**
 * Log in as a seeded PARTICIPANT — roles ['participant'], and deliberately NOT granted any workshop
 * route (none of the ROUTES entries in seed-workshops.js set `participant: true`, so the participant
 * appears in neither the route's roles[] nor its profileid[]). This is the actor the route-guard cases
 * use: an authenticated user who must not reach an operator screen.
 */
export async function loginAsWshopParticipant(page: Page): Promise<void> {
  await loginAs(page, wsActors.participant0, PASSWORD);
}

// CommonJS — reuse the allowlist-guarded admin init (only ever the test project).
// eslint-disable-next-line @typescript-eslint/no-var-requires
const seed = require('../../fixtures/seed-test-project');

/**
 * Reset the W_INACTIVE workshop back to the INACTIVE precondition (so the activate-toggle test WS-04 is
 * order- and re-run-independent). PRECONDITION write only — the test asserts the value the APP writes on
 * the real toggle, never this reset value (anti-circularity).
 */
export async function resetWorkshopInactive(): Promise<void> {
  const admin = seed.initAdmin();
  const db = admin.firestore();
  await db.collection('workshopconfiguration').doc(wsIds.W_INACTIVE).set({ active: false }, { merge: true });
}

/**
 * Reset p0's participant-workshop challenges back to the 1-of-2-complete precondition (so the manual
 * move-next test WS-12 is re-run-stable). PRECONDITION write only.
 */
export async function resetParticipantWorkshopP0(): Promise<void> {
  const admin = seed.initAdmin();
  const db = admin.firestore();
  await db.collection('participant workshop').doc(wsIds.PW_A).set({
    challenges: [
      {
        type: 'challenge', challengeid: `${RUN}_ch0`, heading: 'Module One',
        challenges: [
          { type: 'video', challengeid: `${RUN}_ch0_s0`, heading: 'Intro Video', status: 'completed' },
          { type: 'video', challengeid: `${RUN}_ch0_s1`, heading: 'Deep Dive', status: '' },
        ],
      },
    ],
  }, { merge: true });
}

/**
 * The instant WDC-10 stamps on p0's completed step, in the machine's local zone (seed-time Node and the
 * test browser share it). The dashboard renders it with formatDateTime → "15 Sept 2026, 8:05 pm".
 */
export const wsP0CompletedAt = new Date(2026, 8, 15, 20, 5, 0, 0);

/**
 * Same 1-of-2 precondition as resetParticipantWorkshopP0, plus a KNOWN `completed` timestamp and a
 * `platform_name` on the completed step, so the card's date/time and platform pill assert against known
 * inputs. PRECONDITION write only — the spec asserts the FORMAT and LABEL the app derived.
 */
export async function stampParticipantWorkshopP0Completed(platformName = 'eiflixapp'): Promise<void> {
  const admin = seed.initAdmin();
  const db = admin.firestore();
  const T = admin.firestore.Timestamp;
  await db.collection('participant workshop').doc(wsIds.PW_A).set({
    challenges: [
      {
        type: 'challenge', challengeid: `${RUN}_ch0`, heading: 'Module One',
        challenges: [
          { type: 'video', challengeid: `${RUN}_ch0_s0`, heading: 'Intro Video', status: 'completed',
            completed: T.fromDate(wsP0CompletedAt), platform_name: platformName },
          { type: 'video', challengeid: `${RUN}_ch0_s1`, heading: 'Deep Dive', status: '' },
        ],
      },
    ],
  }, { merge: true });
}

/** Seeded Firebase Auth uids (seed-workshops.js roster: `${RUN}_u_${key}`). */
export const wsUids = { p0: `${RUN}_u_p0`, p1: `${RUN}_u_p1`, p2: `${RUN}_u_p2` };

/** The support-chat group WDC-11 attaches to W_DASH (created by the precondition, deleted afterwards). */
export const wsChatGroupId = `${RUN}_chat`;

/**
 * PRECONDITION for the "Users Not in Chat Group" card: point W_DASH at a fresh, EMPTY `supportchat`
 * group, give p0 the `firebaseuserref` (→ user_data/{uid}) the dashboard resolves an existing user's uid
 * from, and make sure p1 has none — so p0 is addable and p1 shows as "no login yet". The spec asserts what
 * the APP writes into members[]; nothing here pre-empts that.
 */
export async function setupChatGroupPrecondition(): Promise<void> {
  const admin = seed.initAdmin();
  const db = admin.firestore();
  const FV = admin.firestore.FieldValue;
  await db.collection('supportchat').doc(wsChatGroupId).set({ docid: wsChatGroupId, members: [], testrunid: RUN, _testdata: true });
  await db.collection('workshopconfiguration').doc(wsIds.W_DASH).set({ selectedgroup: wsChatGroupId }, { merge: true });
  await db.collection('participant metadata').doc(wsProfileIds.p0).set({ firebaseuserref: db.doc(`user_data/${wsUids.p0}`) }, { merge: true });
  await db.collection('participant metadata').doc(wsProfileIds.p1).set({ firebaseuserref: FV.delete() }, { merge: true });
}

/** Give p1 a login reference too (WDC-11b needs both enrollees addable). PRECONDITION write only. */
export async function giveP1LoginRef(): Promise<void> {
  const admin = seed.initAdmin();
  const db = admin.firestore();
  await db.collection('participant metadata').doc(wsProfileIds.p1).set({ firebaseuserref: db.doc(`user_data/${wsUids.p1}`) }, { merge: true });
}

/** Undo setupChatGroupPrecondition (and giveP1LoginRef) so the rest of the suite sees the plain seed. */
export async function teardownChatGroupPrecondition(): Promise<void> {
  const admin = seed.initAdmin();
  const db = admin.firestore();
  const FV = admin.firestore.FieldValue;
  await db.collection('workshopconfiguration').doc(wsIds.W_DASH).set({ selectedgroup: FV.delete() }, { merge: true });
  await db.collection('participant metadata').doc(wsProfileIds.p0).set({ firebaseuserref: FV.delete() }, { merge: true });
  await db.collection('participant metadata').doc(wsProfileIds.p1).set({ firebaseuserref: FV.delete() }, { merge: true });
  await db.collection('supportchat').doc(wsChatGroupId).delete().catch(() => undefined);
}

/** The group's current members[] — the value the APP wrote. */
export async function chatGroupMembers(): Promise<string[]> {
  const admin = seed.initAdmin();
  const snap = await admin.firestore().collection('supportchat').doc(wsChatGroupId).get();
  const m = snap.exists ? (snap.data() || {})['members'] : [];
  return Array.isArray(m) ? m.map(String) : [];
}

/** The typed answer WDC-12 puts on p0's assignment — long enough to be clamped at three lines. */
export const wsP0AssignmentAnswer =
  `Answer line one for ${RUN}. ` + 'This sentence is repeated to push the answer well past the three-line clamp. '.repeat(6) + 'END-OF-ANSWER';

/**
 * PRECONDITION for All Assignments: give p0 a COMPLETED question/text assignment as a second
 * sub-challenge of Module One (the seed's two videos stay), so the dashboard's All Assignments section
 * lists one assignment with one text submission. The spec asserts the APP's expand/collapse; restored
 * by resetParticipantWorkshopP0 afterwards.
 */
export async function stampParticipantWorkshopP0TextAssignment(): Promise<void> {
  const admin = seed.initAdmin();
  const db = admin.firestore();
  const T = admin.firestore.Timestamp;
  await db.collection('participant workshop').doc(wsIds.PW_A).set({
    challenges: [
      {
        type: 'challenge', challengeid: `${RUN}_ch0`, heading: 'Module One', subheading: 'Foundations',
        challenges: [
          { type: 'video', challengeid: `${RUN}_ch0_s0`, heading: 'Intro Video', status: 'completed' },
          { type: 'video', challengeid: `${RUN}_ch0_s1`, heading: 'Deep Dive', status: '' },
          { type: 'assignment', assignmenttype: 'question', submissionformat: 'text',
            challengeid: `${RUN}_ch0_s2`, name: `Reflection ${RUN}`, heading: `Reflection ${RUN}`,
            status: 'completed', completed: T.fromDate(wsP0CompletedAt), result: wsP0AssignmentAnswer },
        ],
      },
    ],
  }, { merge: true });
}

/**
 * PRECONDITION for the Challenge Progress Overview rules (WDC-13): W_DASH gets THREE challenges —
 * Module One, Module Two, and a zoom call — and the two enrollees get matching progress rows:
 *   p0: Module One COMPLETED, Module Two untouched → on Module Two p0 is "Ready to Start"
 *   p1: Module One UNTOUCHED, Module Two untouched → on Module One p1 is simply "Not Started" (the old
 *       rule also showed them as "Ready to Start"); on Module Two p1 is "Not Started" (blocked)
 * so the expected chips are: row 1 → 1 Completed · 0 In Progress · 1 Not Started (no Ready chip);
 * row 2 → 1 Ready to Start · 1 Not Started (not 2); row 3 (zoom) → no chips, no action button.
 * The spec asserts what the APP counted; this only sets the inputs. Undone by teardownOverviewShape().
 */
export async function setupOverviewShape(): Promise<void> {
  const admin = seed.initAdmin();
  const db = admin.firestore();
  const one = (statuses: string[], status?: string) => ({
    type: 'challenge', challengeid: `${RUN}_ch0`, heading: 'Module One', subheading: 'Foundations', ...(status ? { status } : {}),
    challenges: [
      { type: 'video', challengeid: `${RUN}_ch0_s0`, heading: 'Intro Video', status: statuses[0] },
      { type: 'video', challengeid: `${RUN}_ch0_s1`, heading: 'Deep Dive', status: statuses[1] },
    ],
  });
  const two = () => ({
    type: 'challenge', challengeid: `${RUN}_ch1`, heading: 'Module Two', subheading: 'Momentum',
    challenges: [{ type: 'video', challengeid: `${RUN}_ch1_s0`, heading: 'Next Video', status: '' }],
  });
  const zoom = () => ({ type: 'zoomcall', challengeid: `${RUN}_zoom`, heading: 'Live Call', subheading: 'with EIS', status: 'pending' });
  await db.collection('workshopconfiguration').doc(wsIds.W_DASH).set({ challenges: [one(['', '']), two(), zoom()] }, { merge: true });
  await db.collection('participant workshop').doc(wsIds.PW_A).set({ challenges: [one(['completed', 'completed'], 'completed'), two(), zoom()] }, { merge: true });
  await db.collection('participant workshop').doc(wsIds.PW_B).set({ challenges: [one(['', '']), two(), zoom()] }, { merge: true });
  // The overview counts only enrollees whose enrolment status is 'enrolled' (rebuildProgressFromMap);
  // the seed leaves p1 as 'enrollednotstarted' (a Total Enrolled-only case for WS-07). Promote p1 for
  // this shape so both people are in the statistics — restored by teardownOverviewShape().
  await db.collection('workshop participant enrolled').doc(wsIds.ENR_B).set({ status: 'enrolled' }, { merge: true });
}

/** Back to the seed: one challenge on W_DASH, p0 1-of-2 complete, p1 untouched. */
export async function teardownOverviewShape(): Promise<void> {
  const admin = seed.initAdmin();
  const db = admin.firestore();
  const base = () => ({
    type: 'challenge', challengeid: `${RUN}_ch0`, heading: 'Module One', subheading: 'Foundations',
    challenges: [
      { type: 'video', challengeid: `${RUN}_ch0_s0`, heading: 'Intro Video', status: '' },
      { type: 'video', challengeid: `${RUN}_ch0_s1`, heading: 'Deep Dive', status: '' },
    ],
  });
  await db.collection('workshopconfiguration').doc(wsIds.W_DASH).set({ challenges: [base()] }, { merge: true });
  await db.collection('participant workshop').doc(wsIds.PW_B).set({ challenges: [base()] }, { merge: true });
  await db.collection('workshop participant enrolled').doc(wsIds.ENR_B).set({ status: 'enrollednotstarted' }, { merge: true });
  await resetParticipantWorkshopP0();
}

/** The `loginlog` rows WS-31 seeds (ids run-scoped; removed by clearLoginLogs()). */
export const wsLoginLogIds = {
  todayP0: `${RUN}_ll_today_p0`, todayP1: `${RUN}_ll_today_p1`, weekP0: `${RUN}_ll_week_p0`,
  monthP2: `${RUN}_ll_month_p2`, oldP0: `${RUN}_ll_old_p0`, otherApp: `${RUN}_ll_other`,
};

/**
 * PRECONDITION for the EiFlix Mobile App Logs table: six `loginlog` documents —
 *   today  : p0 (android 2.3.1), p1 (ios 2.3.0), and one for a DIFFERENT app (negative control)
 *   3 days : p0 (android 2.2.9)           → in 7D and 30D, not Today
 *   20 days: p2 (ios 2.3.1)               → in 30D only
 *   40 days: p0 (android 2.0.0)           → never (outside 30D)
 * `date` is a Timestamp — the field the dashboard's range query bounds. The spec asserts the APP's
 * range/app filtering, name mapping, sorting and paging over these known inputs.
 */
export async function seedLoginLogs(): Promise<void> {
  const admin = seed.initAdmin();
  const db = admin.firestore();
  const T = admin.firestore.Timestamp;
  const ago = (days: number, h = 10) => { const d = new Date(); d.setDate(d.getDate() - days); if (days) d.setHours(h, 0, 0, 0); return T.fromDate(d); };
  const put = (id: string, data: any) => db.collection('loginlog').doc(id).set({ docid: id, ...data, testrunid: RUN, _testdata: true });
  await Promise.all([
    put(wsLoginLogIds.todayP0, { app: 'EiFlix', profileid: wsProfileIds.p0, date: ago(0), device_os: 'android', current_version: '2.3.1' }),
    put(wsLoginLogIds.todayP1, { app: 'EiFlix', profileid: wsProfileIds.p1, date: ago(0), device_os: 'ios', current_version: '2.3.0' }),
    put(wsLoginLogIds.otherApp, { app: 'SolarVoice', profileid: wsProfileIds.p0, date: ago(0), device_os: 'android', current_version: '9.9.9' }),
    put(wsLoginLogIds.weekP0, { app: 'EiFlix', profileid: wsProfileIds.p0, date: ago(3), device_os: 'android', current_version: '2.2.9' }),
    put(wsLoginLogIds.monthP2, { app: 'EiFlix', profileid: wsProfileIds.p2, date: ago(20), device_os: 'ios', current_version: '2.3.1' }),
    put(wsLoginLogIds.oldP0, { app: 'EiFlix', profileid: wsProfileIds.p0, date: ago(40), device_os: 'android', current_version: '2.0.0' }),
  ]);
}

export async function clearLoginLogs(): Promise<void> {
  const admin = seed.initAdmin();
  const db = admin.firestore();
  await Promise.all(Object.values(wsLoginLogIds).map(id => db.collection('loginlog').doc(id).delete().catch(() => undefined)));
}

/**
 * Reset the INACTIVE workshop's challenges to a KNOWN single-curriculum array (WS-06 asserts the app
 * grew the array by exactly 1 after adding a curriculum in the UI). Also clears triggerFunction so the
 * settings-toggle test WS-10 starts from false. PRECONDITION write only.
 */
export async function resetWorkshopConfigBaseline(): Promise<void> {
  const admin = seed.initAdmin();
  const db = admin.firestore();
  await db.collection('workshopconfiguration').doc(wsIds.W_INACTIVE).set({
    triggerFunction: false,
    challenges: [
      {
        type: 'challenge', challengeid: `${RUN}_cfg_ch0`, heading: 'Config Module One', subheading: 'Baseline',
        challenges: [{ type: 'video', challengeid: `${RUN}_cfg_ch0_s0`, heading: 'Baseline Video', status: '' }],
      },
    ],
  }, { merge: true });
}

/**
 * Delete any enrollment docs the WS-08 enroll flow created for p2 on the dashboard workshop, so the test
 * is re-runnable (it asserts a +1 delta). App-written docs carry NO testrunid — we key them by their
 * natural key (workshopref==W_DASH AND profileid==p2). PRECONDITION reset only.
 */
export async function cleanEnrollmentForP2(): Promise<void> {
  const admin = seed.initAdmin();
  const db = admin.firestore();
  const dashRef = db.collection('workshopconfiguration').doc(wsIds.W_DASH);
  for (const col of ['workshop participant enrolled', 'participant workshop']) {
    const snap = await db.collection(col).where('workshopref', '==', dashRef).where('profileid', '==', wsProfileIds.p2).get();
    for (const d of snap.docs) await d.ref.delete();
  }
}

/**
 * Delete any duplicate workshopconfiguration docs the WS-13 duplicate flow created (a copy of the ACTIVE
 * workshop with active:false and the SAME title). App-written → NO testrunid; key by the duplicated
 * title + active:false. PRECONDITION reset only (the assertion reads the post-state count, not this).
 */
export async function cleanDuplicateWorkshops(title: string): Promise<void> {
  const admin = seed.initAdmin();
  const db = admin.firestore();
  // The duplicate copies detailpage wholesale, so detailpage.title === the source title. We can't query
  // a nested field cheaply without an index, so scan the small active:false set and match in memory.
  //
  // IDENTIFYING THE COPY: duplicateWorkshop() copies the SOURCE DOC WHOLESALE, which means the duplicate
  // inherits our seed's `testrunid` too. The old `data.testrunid !== RUN` test therefore excluded the very
  // doc it was meant to find — the copy was never deleted (verified: a stale duplicate survived a run) and
  // WS-13's matching assertion saw 0. What actually separates the copy from our seeded docs is its ID:
  // the app generates a fresh one, so anything that is not a seeded id is app-written.
  const seededIds = new Set<string>(Object.values(wsIds));
  const snap = await db.collection('workshopconfiguration').where('active', '==', false).get();
  for (const d of snap.docs) {
    const data = d.data() || {};
    const isDup = !!data.detailpage && data.detailpage.title === title && !seededIds.has(d.id);
    if (isDup) await d.ref.delete();
  }
}

// =================================================================================================
// 2026-09-23 — Dashboard Access. The workshop screens deny by default: a profileid can do nothing
// unless "static meta data"/"Workshop Admin" or workshopsettings/{workshop id} names it. Helpers
// below read those two documents with the admin SDK, so a spec can assert what the APP wrote rather
// than what the test set up, and restore the seeded shape afterwards.
// =================================================================================================

/** The eleven per-workshop actions, in the order the editor lists them. */
export const wsAccessKeys = [
  'sendcommunication', 'qanda', 'diagnose', 'clear', 'enroll', 'export',
  'extend', 'participantprogress', 'allassignments', 'allforms', 'allvideoask',
] as const;

/** What the seed grants `limited` on W_DASH — and nothing else, anywhere. */
export const wsLimitedGrants = ['qanda', 'export'];

/** The three shared lists, as the app stores them. */
export async function workshopAdminLists(): Promise<{ dashboardAdmins: string[]; editAccess: string[]; newUsersAccess: string[] }> {
  const admin = seed.initAdmin();
  const snap = await admin.firestore().collection('static meta data').doc('Workshop Admin').get();
  const d: any = snap.exists ? (snap.data() || {}) : {};
  const list = (v: any) => (Array.isArray(v) ? v.map(String) : []);
  return {
    dashboardAdmins: list(d.workshopdashboardadmin),
    editAccess: list(d.workshopeditaccess),
    newUsersAccess: list(d.workshopnewusersaccess),
  };
}

/** One workshop's grants: profileid -> the actions ticked for them. */
export async function workshopDashboardAccess(workshopId: string): Promise<Record<string, string[]>> {
  const admin = seed.initAdmin();
  const snap = await admin.firestore().collection('workshopsettings').doc(workshopId).get();
  const raw: any = snap.exists ? (snap.data() || {})['dashboardaccess'] : null;
  const out: Record<string, string[]> = {};
  if (raw && typeof raw === 'object') {
    for (const k of Object.keys(raw)) out[k] = Array.isArray(raw[k]) ? raw[k].map(String) : [];
  }
  return out;
}

/**
 * Put W_DASH's grants back to the seeded shape. The access spec SAVES through the app (that write is
 * the oracle), so without this a second run would start from the first run's leftovers. PRECONDITION
 * write only — no assertion ever reads this value back.
 */
export async function resetDashboardAccess(): Promise<void> {
  const admin = seed.initAdmin();
  await admin.firestore().collection('workshopsettings').doc(wsIds.W_DASH).set({
    workshopid: wsIds.W_DASH,
    dashboardaccess: { [wsProfileIds.limited]: [...wsLimitedGrants] },
    testrunid: RUN,
    _testdata: true,
  });
}

/** Put the three shared lists back to the seeded shape (same reason as resetDashboardAccess). */
export async function resetWorkshopAdminLists(): Promise<void> {
  const admin = seed.initAdmin();
  await admin.firestore().collection('static meta data').doc('Workshop Admin').set({
    docid: 'Workshop Admin',
    workshopdashboardadmin: [wsProfileIds.admin, wsProfileIds.mover],
    workshopeditaccess: [wsProfileIds.admin, wsProfileIds.mover],
    workshopnewusersaccess: [wsProfileIds.admin, wsProfileIds.mover],
    testrunid: RUN,
    _testdata: true,
  });
}

// =================================================================================================
// 2026-09-24 — Cost is optional on an upcoming workshop (eiflixhomeconfig).
// =================================================================================================

/** The title WS-34 types, so the doc the APP creates can be found and cleaned up by it. */
export const wsUpcomingCostTitle = `WS Cost Unset ${RUN}`;

/**
 * Delete any `eiflixhomewidgets` doc carrying WS-34's title. The app generates the id and writes no
 * testrunid, so the run-scoped sweep cannot see it — the title is the only handle. PRECONDITION and
 * teardown only; the case never asserts on this.
 */
export async function cleanUpcomingCostWidget(): Promise<void> {
  const admin = seed.initAdmin();
  const snap = await admin.firestore().collection('eiflixhomewidgets')
    .where('title', '==', wsUpcomingCostTitle).get().catch(() => ({ docs: [] as any[] }));
  for (const d of snap.docs) await d.ref.delete().catch(() => { });
}

// =================================================================================================
// 2026-09-29 — series-level fields on the Add Home Series dialog (eiflixhomeconfig, Home Series tab).
// =================================================================================================

/** The episode WS-39 picks — the dialog refuses to save with none selected. */
export const wsHomeSeriesEpisodeTitle = `WS HS Episode ${RUN}`;

/** The series title WS-39 types, and the handle its cleanup uses. */
export const wsHomeSeriesTitle = `WS HS Fields ${RUN}`;

/** Exactly what WS-39 types and toggles, so the spec asserts app output against known input. */
export const wsHomeSeriesFields = {
  pickoftheweek: true,
  heading: `HS Heading ${RUN}`,
  headleft: `HS Left ${RUN}`,
  headright: `HS Right ${RUN}`,
  subtitle: `HS Subtitle ${RUN}`,
  buttontext: `HS Button ${RUN}`,
};

/**
 * Delete any `eiflixhomeseries` doc carrying WS-39's title. The app generates the id and writes no
 * testrunid, so the run-scoped sweep cannot see it — the title is the only handle. PRECONDITION and
 * teardown only; the case never asserts on this.
 */
export async function cleanHomeSeriesFieldsDoc(): Promise<void> {
  const admin = seed.initAdmin();
  const snap = await admin.firestore().collection('eiflixhomeseries')
    .where('title', '==', wsHomeSeriesTitle).get().catch(() => ({ docs: [] as any[] }));
  for (const d of snap.docs) await d.ref.delete().catch(() => { });
}

// =================================================================================================
// 2026-09-29 — audience (Journey OR Tier) on a Create / Assign EiFlix Home row.
// =================================================================================================

/** The names the audience dropdowns render; the DOCUMENT IDS are what get stored. */
export const wsAudienceNames = {
  journey: `WS Audience Journey ${RUN}`,
  tier: `WS Audience Tier ${RUN}`,
};

/** The one home-config document the EiFlix Home tab reads and writes. */
export async function eiflixHomeConfig(): Promise<any[]> {
  const admin = seed.initAdmin();
  const snap = await admin.firestore().collection('classify').doc('eiflixwebapp').get();
  const v = snap.exists ? (snap.data() || {})['homeconfig'] : null;
  return Array.isArray(v) ? v : [];
}

/**
 * Clear the home-config array. `classify/eiflixwebapp` is a fixed-id document shared with the live
 * EiFlix home surface, so this NEVER deletes it — it empties only the one field the tab owns, and
 * only on the disposable test project (initAdmin hard-aborts anywhere else). PRECONDITION and
 * teardown only; no assertion reads this back.
 */
export async function resetEiflixHomeConfig(): Promise<void> {
  const admin = seed.initAdmin();
  await admin.firestore().collection('classify').doc('eiflixwebapp')
    .set({ homeconfig: [], testrunid: RUN, _testdata: true }, { merge: true });
}

// =================================================================================================
// 2026-10-01 — Participant Progress Details: Email column, email in search, text "New" tag.
// =================================================================================================

/**
 * p0's stored email, read straight from Firestore — the INDEPENDENT oracle for the Email column.
 *
 * Never hard-code the expected address: `participant metadata`.email is CF-OWNED (see wsMetaNames
 * above), so whichever of the seed or the trigger wrote last is the value the dashboard renders.
 * Reading it back makes the assertion correct in both orders without the test choosing the value.
 */
export async function p0MetadataEmail(): Promise<string> {
  const admin = seed.initAdmin();
  const snap = await admin.firestore().collection('participant metadata').doc(wsProfileIds.p0).get();
  return String((snap.data() || {})['email'] || '');
}

/**
 * PRECONDITION: give p0 a display name that shares NO substring with their email, so a search for the
 * email can only match through the email. Without this the two are identical (the CF sets
 * metadata.name := profile_data.name, which seedAuthChain sets to the actor's EMAIL), and a passing
 * search would prove nothing — the name path would satisfy it.
 *
 * Restore with alignWorkshopMetadataNames(), which puts the CF's terminal name back.
 */
export const wsP0SearchName = `ZZ Searchable ${RUN}`;
export async function stampP0DistinctName(): Promise<void> {
  const admin = seed.initAdmin();
  await admin.firestore().collection('participant metadata').doc(wsProfileIds.p0)
    .set({ name: wsP0SearchName }, { merge: true });
}

/**
 * PRECONDITION: flip p0's `workshoponly` flag — the condition the dashboard renders the "New" tag on.
 * Not a CF-owned field (the trigger merges only name/email/countrycode/phonenumber), so this write
 * stands. Pass false to remove it again; the suite runs with workers:1, so the stamp is not racing
 * another case.
 */
export async function stampP0Workshoponly(on: boolean): Promise<void> {
  const admin = seed.initAdmin();
  const FV = admin.firestore.FieldValue;
  await admin.firestore().collection('participant metadata').doc(wsProfileIds.p0)
    .set({ workshoponly: on ? true : FV.delete() }, { merge: true });
}

// =================================================================================================
// 2026-10-02 — New users / Existing users filter on the EiFlix Mobile App Logs.
// =================================================================================================

/**
 * Extra `loginlog` rows for the user-type filter, kept SEPARATE from seedLoginLogs() on purpose.
 *
 * WS-31 asserts exact tallies off that seed ("2 of 2 unique people", four rows in 30D, three name
 * options). Adding people to it would have rewritten every one of those numbers. These rows exist
 * only for the duration of the user-type case's own describe.
 */
export const wsLogUserTypeIds = {
  newUserRow: `${RUN}_ll_today_nu_new`,
  paidUserRow: `${RUN}_ll_today_nu_paid`,
};

/**
 * PRECONDITION for the user-type filter: two more EiFlix logins today, one from each side of the
 * rule the dashboard's own cards use.
 *
 *   NU_A — a `new_user_data` record with no `movedtoexist`  → still a NEW user
 *   NU_C — the same, flipped to `movedtoexist: true`        → counts as EXISTING
 *
 * NU_C is the doc this suite already treats as mutable (resetNewUserTags), and flipping a field
 * changes no document COUNT, so WS-30's floor over `new_user_data` is untouched. Restored by
 * clearUserTypeLoginLogs().
 *
 * Neither NU person has a `participant metadata` row, so the table shows their new_user_data name
 * ("NU Alpha <run>" / "NU Charlie <run>") — the CF that rewrites metadata names never touches them.
 */
export async function seedUserTypeLoginLogs(): Promise<void> {
  const admin = seed.initAdmin();
  const db = admin.firestore();
  const T = admin.firestore.Timestamp;
  const today = T.fromDate(new Date());
  await db.collection('new_user_data').doc(wsAddIds.NU_C).set({ movedtoexist: true }, { merge: true });
  await Promise.all([
    db.collection('loginlog').doc(wsLogUserTypeIds.newUserRow).set({
      docid: wsLogUserTypeIds.newUserRow, app: 'EiFlix', profileid: wsAddIds.NU_A,
      date: today, device_os: 'android', current_version: '3.0.0', testrunid: RUN, _testdata: true,
    }),
    db.collection('loginlog').doc(wsLogUserTypeIds.paidUserRow).set({
      docid: wsLogUserTypeIds.paidUserRow, app: 'EiFlix', profileid: wsAddIds.NU_C,
      date: today, device_os: 'ios', current_version: '3.0.1', testrunid: RUN, _testdata: true,
    }),
  ]);
}

/** Undo seedUserTypeLoginLogs: drop the two rows and put NU_C back to "not moved". */
export async function clearUserTypeLoginLogs(): Promise<void> {
  const admin = seed.initAdmin();
  const db = admin.firestore();
  const FV = admin.firestore.FieldValue;
  await db.collection('new_user_data').doc(wsAddIds.NU_C).set({ movedtoexist: FV.delete() }, { merge: true });
  await Promise.all(Object.values(wsLogUserTypeIds).map(id =>
    db.collection('loginlog').doc(id).delete().catch(() => undefined)));
}

// =================================================================================================
// 2026-10-06 — popup banner: `classify/eiflixpopupbanner` moves to a `popupbanner` array of maps.
// =================================================================================================

/** The fixed-id document the Popup banner dialog on /workshops owns. */
export const wsPopupBannerDoc = { col: 'classify', id: 'eiflixpopupbanner' };

/** The legacy flat banner the seed plants — the shape live in production before the array. */
export const wsPopupBannerLegacy = {
  title: `<p>WS Legacy Banner ${RUN}</p>`,
  header: `<p>WS Legacy Eyebrow ${RUN}</p>`,
  button1link: `https://example.com/${RUN}`,
};

/**
 * PRECONDITION: put the document back to the PRE-ARRAY shape — flat fields, no `popupbanner`.
 *
 * This is the state the migration has to cope with, and the one that matters: the banner already
 * live is held in those flat fields, so an editor that read only the new array would show nothing
 * and its first save would replace a live banner with an empty list.
 *
 * `classify` is a shared collection this suite does not own outright (same as eiflixdiscoverpage),
 * so the write is run-tagged and the teardown only removes what still carries our tag.
 */
export async function seedLegacyPopupBanner(): Promise<void> {
  const admin = seed.initAdmin();
  const FV = admin.firestore.FieldValue;
  await admin.firestore().collection(wsPopupBannerDoc.col).doc(wsPopupBannerDoc.id).set({
    docid: wsPopupBannerDoc.id,
    ...wsPopupBannerLegacy,
    description: '', button1text: '', button2text: '', footer: '',
    desktop: '', tablet: '', mobile: '', enable: true,
    popupbanner: FV.delete(),
    testrunid: RUN, _testdata: true,
  }, { merge: true });
}

/** The `popupbanner` array as the APP wrote it, or null when the field is absent. */
export async function popupBannerArray(): Promise<any[] | null> {
  const admin = seed.initAdmin();
  const snap = await admin.firestore().collection(wsPopupBannerDoc.col).doc(wsPopupBannerDoc.id).get();
  const v = snap.exists ? (snap.data() || {})['popupbanner'] : undefined;
  return Array.isArray(v) ? v : null;
}

/** The whole document, for asserting the legacy flat fields survived the save. */
export async function popupBannerDoc(): Promise<any> {
  const admin = seed.initAdmin();
  const snap = await admin.firestore().collection(wsPopupBannerDoc.col).doc(wsPopupBannerDoc.id).get();
  return snap.exists ? (snap.data() || {}) : {};
}

/** Drop the run-tagged popup banner document (teardown only). */
export async function clearPopupBanner(): Promise<void> {
  const admin = seed.initAdmin();
  const ref = admin.firestore().collection(wsPopupBannerDoc.col).doc(wsPopupBannerDoc.id);
  const snap = await ref.get().catch(() => ({ exists: false, data: () => ({}) } as any));
  if (snap.exists && (snap.data() || {})['testrunid'] === RUN) await ref.delete().catch(() => undefined);
}

// =================================================================================================
// 2026-10-08 — evergreen "days remaining" in the Extended Participants dialog.
// =================================================================================================

/** The evergreen world CN/WS-49 needs. Nothing else in the suite seeds an evergreen workshop. */
export const wsEvergreenIds = {
  WORKSHOP: `${RUN}_W_evergreen`,
  ENR_ACTIVE: `${RUN}_ev_enr_active`,
  ENR_LAPSED: `${RUN}_ev_enr_lapsed`,
  ENR_LASTDAY: `${RUN}_ev_enr_lastday`,
  PW_ACTIVE: `${RUN}_ev_pw_active`,
  PW_LAPSED: `${RUN}_ev_pw_lapsed`,
  PW_LASTDAY: `${RUN}_ev_pw_lastday`,
};

/** Days out the seeded extension runs — the number the app must render as "N days left". */
export const WS_EVERGREEN_DAYS_LEFT = 12;

/**
 * PRECONDITION for the Extended Participants dialog: an evergreen workshop with two extended
 * participants — one whose extension is still running, one whose has lapsed.
 *
 * `extenduntill` is stored the way the app writes it: 23:59 on the chosen day. The ACTIVE one is set
 * exactly WS_EVERGREEN_DAYS_LEFT calendar days out, so the rendered "N days left" is the app's own
 * arithmetic over a known input — the test supplies the date and never the answer.
 *
 * The dialog's trigger only renders when `evergreenWorkshop === true` AND
 * `evergreenWorkshopMeta.workshopDays > 0` (computeEvergreenDayDistribution), so both are set.
 *
 * ORDERING CONSTRAINT — read this before moving the case that calls it. These three run-tagged
 * `workshop participant enrolled` docs are counted by WS-07's precondition, which asserts the run
 * has EXACTLY 2 of them. That holds only because the evergreen describe is declared last in
 * workshop-dashboard.spec.ts and the suite runs serially (workers:1, fullyParallel:false), so WS-07
 * has already run by the time these exist, and clearEvergreenExtended() removes them afterwards.
 * Moving the describe above WS-07 would break it with a confusing "expected 2, got 5".
 */
export async function seedEvergreenExtended(): Promise<void> {
  const admin = seed.initAdmin();
  const db = admin.firestore();
  const T = admin.firestore.Timestamp;
  const tag = { testrunid: RUN, _testdata: true };

  // 23:59 local on a day N ahead (negative = in the past), matching confirmExtend().
  const endOfDay = (daysFromToday: number) => {
    const d = new Date();
    d.setDate(d.getDate() + daysFromToday);
    return T.fromDate(new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 0, 0));
  };
  const ago = (days: number) => { const d = new Date(); d.setDate(d.getDate() - days); return T.fromDate(d); };

  const wsRef = db.collection('workshopconfiguration').doc(wsEvergreenIds.WORKSHOP);
  await wsRef.set({
    docid: wsEvergreenIds.WORKSHOP, active: true, workshopcompleted: false, categorybased: false,
    atcmodel: null, created: ago(30),
    evergreenWorkshop: true,
    evergreenWorkshopMeta: { workshopDays: 7 },
    detailpage: {
      type: 'workshop', title: `Evergreen Workshop ${RUN}`, shortdescription: 'seeded evergreen',
      workshopStartDate: ago(30), workshopEndDate: ago(1),
      registrationStartDate: ago(40), registrationEndDate: ago(31),
    },
    challenges: [{
      type: 'challenge', challengeid: `${RUN}_ev_ch0`, heading: 'Evergreen Module', subheading: 'One',
      challenges: [{ type: 'video', challengeid: `${RUN}_ev_ch0_s0`, heading: 'Evergreen Video', status: '' }],
    }],
    ...tag,
  });

  const pwActive = db.collection('participant workshop').doc(wsEvergreenIds.PW_ACTIVE);
  const pwLapsed = db.collection('participant workshop').doc(wsEvergreenIds.PW_LAPSED);
  const pwLastDay = db.collection('participant workshop').doc(wsEvergreenIds.PW_LASTDAY);

  // Both enrolled long enough ago to sit past workshopDays, which is what puts them in the
  // Completed/Extended reckoning rather than a day bucket.
  await db.collection('workshop participant enrolled').doc(wsEvergreenIds.ENR_ACTIVE).set({
    docid: wsEvergreenIds.ENR_ACTIVE, profileid: wsProfileIds.p0, status: 'enrolled',
    workshopref: wsRef, participantworkshopref: pwActive, enrollmentdate: ago(20), ...tag,
  });
  await db.collection('workshop participant enrolled').doc(wsEvergreenIds.ENR_LAPSED).set({
    docid: wsEvergreenIds.ENR_LAPSED, profileid: wsProfileIds.p1, status: 'enrolled',
    workshopref: wsRef, participantworkshopref: pwLapsed, enrollmentdate: ago(20), ...tag,
  });
  await db.collection('workshop participant enrolled').doc(wsEvergreenIds.ENR_LASTDAY).set({
    docid: wsEvergreenIds.ENR_LASTDAY, profileid: wsProfileIds.p2, status: 'enrolled',
    workshopref: wsRef, participantworkshopref: pwLastDay, enrollmentdate: ago(20), ...tag,
  });

  const pwBase = {
    workshopref: wsRef, challenges: [], ...tag,
  };
  await pwActive.set({
    docid: wsEvergreenIds.PW_ACTIVE, profileid: wsProfileIds.p0, ...pwBase,
    evergreenaccessto: {
      extendworkshop: [{ extenduntill: endOfDay(WS_EVERGREEN_DAYS_LEFT), created: ago(2) }],
    },
  });
  await pwLapsed.set({
    docid: wsEvergreenIds.PW_LAPSED, profileid: wsProfileIds.p1, ...pwBase,
    evergreenaccessto: {
      extendworkshop: [{ extenduntill: endOfDay(-3), created: ago(10) }],
    },
  });
  // Ends TODAY at 23:59 — the boundary the day count is most likely to get wrong, and the reason
  // the rule counts calendar days rather than elapsed hours. Must read "Last day", never "0 days".
  await pwLastDay.set({
    docid: wsEvergreenIds.PW_LASTDAY, profileid: wsProfileIds.p2, ...pwBase,
    evergreenaccessto: {
      extendworkshop: [{ extenduntill: endOfDay(0), created: ago(1) }],
    },
  });
}

/** Remove the evergreen world (teardown only). */
export async function clearEvergreenExtended(): Promise<void> {
  const admin = seed.initAdmin();
  const db = admin.firestore();
  const drop = (col: string, id: string) => db.collection(col).doc(id).delete().catch(() => undefined);
  await Promise.all([
    drop('workshopconfiguration', wsEvergreenIds.WORKSHOP),
    drop('workshop participant enrolled', wsEvergreenIds.ENR_ACTIVE),
    drop('workshop participant enrolled', wsEvergreenIds.ENR_LAPSED),
    drop('workshop participant enrolled', wsEvergreenIds.ENR_LASTDAY),
    drop('participant workshop', wsEvergreenIds.PW_ACTIVE),
    drop('participant workshop', wsEvergreenIds.PW_LAPSED),
    drop('participant workshop', wsEvergreenIds.PW_LASTDAY),
  ]);
}

// =================================================================================================
// 2026-10-09 — EiFlix App Logs: web sign-ins (`eiflixweb: true`) join the app sign-ins.
// =================================================================================================

export const wsWebLoginIds = {
  webToday: `${RUN}_ll_today_web`,
  webFlagFalse: `${RUN}_ll_today_webfalse`,
};

/** The version strings WS-51 identifies its rows by — unique, so no other seed row collides. */
export const wsWebLoginVersions = { web: '4.0.0', notWeb: '8.8.8' };

/**
 * PRECONDITION for the web-login rows, kept SEPARATE from seedLoginLogs() because WS-31 asserts
 * exact tallies off that seed ("2 of 2 unique people", four rows in 30D, "1–4 of 4").
 *
 *   webToday     — `eiflixweb: true`, NO `app` field at all (how the web client really writes it),
 *                  and a `device_os` of 'android' on purpose: the table must still read 'web',
 *                  because the flag says where the session happened and the other field is stale.
 *   webFlagFalse — another product WITH `eiflixweb: false`. The sharp negative control for this
 *                  change: a present-but-false flag must not let a non-EiFlix row onto the table.
 */
export async function seedWebLoginLogs(): Promise<void> {
  const admin = seed.initAdmin();
  const db = admin.firestore();
  const T = admin.firestore.Timestamp;
  const now = T.fromDate(new Date());
  const put = (id: string, data: any) =>
    db.collection('loginlog').doc(id).set({ docid: id, ...data, testrunid: RUN, _testdata: true });
  await Promise.all([
    put(wsWebLoginIds.webToday, {
      eiflixweb: true, profileid: wsProfileIds.p0, date: now,
      device_os: 'android', current_version: wsWebLoginVersions.web,
    }),
    put(wsWebLoginIds.webFlagFalse, {
      app: 'SolarVoice', eiflixweb: false, profileid: wsProfileIds.p1, date: now,
      device_os: 'ios', current_version: wsWebLoginVersions.notWeb,
    }),
  ]);
}

/** Undo seedWebLoginLogs. */
export async function clearWebLoginLogs(): Promise<void> {
  const admin = seed.initAdmin();
  const db = admin.firestore();
  await Promise.all(Object.values(wsWebLoginIds).map(id =>
    db.collection('loginlog').doc(id).delete().catch(() => undefined)));
}

// =================================================================================================
// 2026-10-09 — EiFlix Report: unique users per surface.
// =================================================================================================

export const wsReportLoginIds = { p1Android: `${RUN}_ll_today_p1_android` };

/**
 * PRECONDITION for the report's MOBILE TOTAL. The other seeders give each person one surface, so
 * the union and the sum happen to agree and a broken dedup would pass. This puts p1 — who already
 * has an iOS sign-in today — on Android as well, so Android + iOS is 5 while the true unique total
 * is 4. Only correct deduplication produces 4.
 *
 * Run alongside seedLoginLogs() + seedWebLoginLogs() + seedUserTypeLoginLogs(); today then holds:
 *   android      p0, p1, NU_A              → 3  (NU_A is the one NEW user)
 *   ios          p1, NU_C                  → 2  (NU_C has movedtoexist:true, so it is EXISTING)
 *   mobile total p0, p1, NU_A, NU_C        → 4  (NOT 5)
 *   web          p0                        → 1  (p0 is on Android AND web — counted in both)
 */
export async function seedReportLoginLogs(): Promise<void> {
  const admin = seed.initAdmin();
  const db = admin.firestore();
  const T = admin.firestore.Timestamp;
  await db.collection('loginlog').doc(wsReportLoginIds.p1Android).set({
    docid: wsReportLoginIds.p1Android, app: 'EiFlix', profileid: wsProfileIds.p1,
    date: T.fromDate(new Date()), device_os: 'android', current_version: '5.0.0',
    testrunid: RUN, _testdata: true,
  });
}

/** Undo seedReportLoginLogs. */
export async function clearReportLoginLogs(): Promise<void> {
  const admin = seed.initAdmin();
  await admin.firestore().collection('loginlog').doc(wsReportLoginIds.p1Android)
    .delete().catch(() => undefined);
}

// =================================================================================================
// 2026-10-09 — EiFlix Report: Total Content Consumption.
// =================================================================================================

export const wsConsumptionIds = {
  appExisting: `${RUN}_ca_cons_app_existing`,
  appNew: `${RUN}_ca_cons_app_new`,
  webExisting: `${RUN}_ca_cons_web_existing`,
  otherPlatform: `${RUN}_ca_cons_other`,
};

/**
 * Seconds chosen so the rendered durations are unmistakable and cannot collide with any other
 * number on the dashboard:
 *   app existing  3661s  =  1 hours 01 minutes 01 seconds
 *   app new       7322s  =  2 hours 02 minutes 02 seconds
 *   app TOTAL    10983s  =  3 hours 03 minutes 03 seconds   (the sum, which the app must compute)
 *   web existing  3723s  =  1 hours 02 minutes 03 seconds
 */
export const wsConsumptionSeconds = { appExisting: 3661, appNew: 7322, webExisting: 3723 };
export const wsConsumptionText = {
  appExisting: '1 hours 01 minutes 01 seconds',
  appNew: '2 hours 02 minutes 02 seconds',
  appTotal: '3 hours 03 minutes 03 seconds',
  webExisting: '1 hours 02 minutes 03 seconds',
  webNew: '0 hours 00 minutes 00 seconds',
};

/**
 * PRECONDITION for Total Content Consumption: `content analytics` rows dated TODAY, one per case.
 *
 *   appExisting   platform_name 'eiflixapp',  p0 (participant metadata → existing)
 *   appNew        platform_name 'EiflixApp',  NU_A (new_user_data, not moved → NEW) — and the MIXED
 *                 CASE is deliberate: platform matching must be case-insensitive, so this row has
 *                 to land in the same bucket as the lowercase one.
 *   webExisting   platform_name 'Eiflixweb',  p0
 *   otherPlatform platform_name 'SolarVoice', a big number that must NOT appear anywhere.
 *
 * Run alongside the base content seed. These ids are run-scoped and swept by the same teardown.
 */
export async function seedConsumption(): Promise<void> {
  const admin = seed.initAdmin();
  const db = admin.firestore();
  const T = admin.firestore.Timestamp;
  const today = T.fromDate(new Date());
  const tag = { testrunid: RUN, _testdata: true };
  const put = (id: string, platform_name: string, totaltimespend: number, profileid: string) =>
    db.collection('content analytics').doc(id).set({
      docid: id, platform_name, totaltimespend, profileid, type: 'eiflixcontent',
      videoid: `${RUN}_vid_cons`, videoname: `TEST_VID_CONS_${RUN}`, logdate: today, ...tag,
    });
  await Promise.all([
    put(wsConsumptionIds.appExisting, 'eiflixapp', wsConsumptionSeconds.appExisting, wsProfileIds.p0),
    put(wsConsumptionIds.appNew, 'EiflixApp', wsConsumptionSeconds.appNew, wsAddIds.NU_A),
    put(wsConsumptionIds.webExisting, 'Eiflixweb', wsConsumptionSeconds.webExisting, wsProfileIds.p0),
    put(wsConsumptionIds.otherPlatform, 'SolarVoice', 99999, wsProfileIds.p1),
  ]);
}

/** Undo seedConsumption. */
export async function clearConsumption(): Promise<void> {
  const admin = seed.initAdmin();
  const db = admin.firestore();
  await Promise.all(Object.values(wsConsumptionIds).map(id =>
    db.collection('content analytics').doc(id).delete().catch(() => undefined)));
}
