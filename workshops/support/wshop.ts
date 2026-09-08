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
  participant0: `participant0+${RUN}@example.com`,
  participant1: `participant1+${RUN}@example.com`,
  participant2: `participant2+${RUN}@example.com`,
};

/** Seeded profileids (for asserting app-written refs / progress rows). */
export const wsProfileIds = {
  admin: `${RUN}_pf_admin`,
  mover: '3LVxKXuyxldYoRDEpx5s', // == seed-workshops MOVER_PID (hardcoded dashboard allow-list id)
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
  const snap = await db.collection('workshopconfiguration').where('active', '==', false).get();
  for (const d of snap.docs) {
    const data = d.data() || {};
    const isDup = (data.detailpage && data.detailpage.title === title) && data.testrunid !== RUN;
    if (isDup) await d.ref.delete();
  }
}
