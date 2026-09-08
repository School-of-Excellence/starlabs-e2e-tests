// @ts-nocheck
/**
 * seed-workshops.js — stand up the Workshops world on the dedicated disposable test project
 * (slabs-queue-e2e-exdcz), reusing the proven queue-suite primitives (allowlist-guarded admin init,
 * the staff auth chain, the dashboard route-grant doc shape).
 *
 * Mirrors e2e/recon-allcomp/workshops.md. PRODUCTION-SAFE BY CONSTRUCTION: every write goes through
 * seed-test-project.initAdmin() (hard-aborts off the test project), every doc is tagged
 * {testrunid:'wshop', _testdata:true}, and NO ATC collection is ever touched. The taxonomy picker the
 * workshop-configuration screen reads (`atc taxonomy`) is reference-only config (CLAUDE.md "safe"); we
 * seed NO selectedTaxonomies so that dropdown stays inert.
 *
 * Actors (custom roster — the workshop dashboard's manual-move button is gated by a HARDCODED set of
 * production profileids (workshop-dashboard.component.ts:1688), so the move-next actor must carry one):
 *   admin+wshop@example.com   roles {admin, ah}                 — list/config/dashboard render (super-role)
 *   mover+wshop@example.com   roles {admin, ah}, pid 3LVxK…     — drives the manual move-next write (WS-12)
 *   participant0..2+wshop@example.com roles {participant}        — enrolled into the dashboard workshop
 *
 * Usage:  node e2e/workshops/seed-workshops.js --seed | --teardown
 */
'use strict';

// initAdminAuto is the SHARED emulator-aware admin init (lib/seed-common): emulator-pinned when
// FIRESTORE_EMULATOR_HOST is set, else the cloud allowlist-guarded seed.initAdmin(). One copy for all seeders.
const { seed, seedDashboardRoutes, TAG, initAdminAuto } = require('../lib/seed-common');

const TESTRUNID = process.env.WSHOP_RUNID || 'wshop';

// The workshop dashboard's manual move-to-next action only renders/runs for a HARDCODED allow-list of
// production profileids (workshop-dashboard.component.ts:1688). To drive WS-12 (a real app-WRITE of
// manualcompletion:true) we make the "mover" actor's profileid EXACTLY one of those ids. This is an
// opaque doc id on a disposable test project — it couples only this one actor to the magic string, and
// nothing in prod is touched. The general "admin" actor keeps a run-namespaced profileid.
const MOVER_PID = '3LVxKXuyxldYoRDEpx5s';

// ---- deterministic doc ids (run-prefixed) -------------------------------------------------------
const ID = {
  W_INACTIVE: `${TESTRUNID}_W_inactive`,   // workshopconfiguration active:false (toggle/detail-save pivot)
  W_ACTIVE: `${TESTRUNID}_W_active`,       // workshopconfiguration active:true  (active-filter floor)
  W_DASH: `${TESTRUNID}_W_dash`,           // workshopconfiguration with challenges[] (dashboard pivot)
  ENR_A: `${TESTRUNID}_enr_a`,             // workshop participant enrolled — status 'enrolled'  (p0)
  ENR_B: `${TESTRUNID}_enr_b`,             // workshop participant enrolled — status 'enrollednotstarted' (p1)
  PW_A: `${TESTRUNID}_pw_a`,               // participant workshop for p0 (1 of 2 sub-challenges complete = 50%)
  PW_B: `${TESTRUNID}_pw_b`,               // participant workshop for p1

  // ---- 2026-09-04 addendum: the nine previously-uncovered routes (WS-16..WS-33) ----------------
  // See recon-allcomp/workshops.md "Addendum — 2026-09-04". Every negative-control doc below exists
  // ONLY so an app-side filter can be proven to RUN — without it a passing test cannot tell
  // "the filter works" from "the doc was never there".
  EW_KEEP: `${TESTRUNID}_ew_keep`,         // eiflix workshop — renders in the /createworkshop list (WS-16)
  EW_DEL: `${TESTRUNID}_ew_del`,           // eiflix workshop — the WS-17 hard-delete target
  HW_CS1: `${TESTRUNID}_hw_cs1`,           // eiflixhomewidgets comingsoon order:1 (WS-18/19)
  HW_CS2: `${TESTRUNID}_hw_cs2`,           // eiflixhomewidgets comingsoon order:2 (WS-19)
  HW_CS_NOORDER: `${TESTRUNID}_hw_cs3`,    // eiflixhomewidgets comingsoon, NO order → sorts last (WS-19)
  HW_ADS: `${TESTRUNID}_hw_ads`,           // eiflixhomewidgets widgettype:'ads' — NEGATIVE CONTROL (WS-18) + delete target (WS-20)
  HS_A: `${TESTRUNID}_hs_a`,               // eiflixhomeseries row (tab 3)
  NUT_SEGMENT: `${TESTRUNID}_nut_seg`,     // newusertags type:'newusersegments' (WS-22/23 + campaign segment join)
  NUT_CAL_A: `${TESTRUNID}_nut_cal_a`,     // newusertags type:'wccalendar'
  NUT_CAL_B: `${TESTRUNID}_nut_cal_b`,     // newusertags type:'wccalendar'
  NUT_LOC: `${TESTRUNID}_nut_loc`,         // newusertags type:'location'
  NU_A: `${TESTRUNID}_nu_a`,               // new_user_data newest, tagged   (WS-21/22)
  NU_B: `${TESTRUNID}_nu_b`,               // new_user_data middle, tagged   (WS-21/22)
  NU_C: `${TESTRUNID}_nu_c`,               // new_user_data oldest, UNTAGGED — NEGATIVE CONTROL (WS-22) + WS-23 write target
  CLASSIFY_DOC: 'eiflixdiscoverpage',      // classify/<fixed id> — the single doc /eiflixdiscoverpage manages
  EVT_BIG: `${TESTRUNID}_evt_big`,         // event collection atcmodel:'B!G'      (WS-28)
  EVT_NONBIG: `${TESTRUNID}_evt_nonbig`,   // event collection NOT B!G — NEGATIVE CONTROL (WS-28)
  JRN_BIG: `${TESTRUNID}_jrn_big`,         // journey atcmodel:'B!G' — keeps the `in` filter non-empty (Risk #12)
  // The bigeventmentor doc id MUST EQUAL the event id: onEventChange() does a direct
  // getDoc(doc(db,'bigeventmentor', eventId)) (bigeventmentor.component.ts:201) and createBigEventMentor()
  // writes it under the event's own id (ts:289). A separately-named doc is simply never found, and the
  // screen silently renders the "create" button instead of the status board.
  BEM: `${TESTRUNID}_evt_big`,             // == EVT_BIG (bigeventmentor doc, WS-29 move target)
  DF_A: `${TESTRUNID}_df_a`,               // delivery forms (default db) for /formtemplateworkshop (WS-26)
  CAMP_LIVE: `${TESTRUNID}_camp_live`,     // eiflixcampaign — dates say LIVE      (WS-31)
  CAMP_SCHED: `${TESTRUNID}_camp_sched`,   // eiflixcampaign — dates say SCHEDULED (WS-31)
  CAMP_ENDED: `${TESTRUNID}_camp_ended`,   // eiflixcampaign — dates say ENDED     (WS-31)
  CAL_SINGLE: `${TESTRUNID}_cal_single`,   // workshopcampaigncalendar single-day  (WS-32)
  CAL_SPAN: `${TESTRUNID}_cal_span`,       // workshopcampaigncalendar 3-day span  (WS-32)
  CAL_DELETED: `${TESTRUNID}_cal_deleted`, // workshopcampaigncalendar deleted:true — NEGATIVE CONTROL (WS-32)
};

/** The five stacked calendar events on ONE day — 5 > MAX_CHIPS(3) so the app renders "+2 more" (WS-33). */
const CAL_STACK_IDS = [1, 2, 3, 4, 5].map((n) => `${TESTRUNID}_cal_stack${n}`);

// Actors. profileids are run-prefixed except the mover (see MOVER_PID). Emails follow actors.ts'
// `<role>+<run>@example.com` convention.
const PF = {
  admin: `${TESTRUNID}_pf_admin`,
  mover: MOVER_PID,
  p0: `${TESTRUNID}_pf_p0`,
  p1: `${TESTRUNID}_pf_p1`,
  p2: `${TESTRUNID}_pf_p2`,
};
const EMAIL = {
  admin: `admin+${TESTRUNID}@example.com`,
  mover: `mover+${TESTRUNID}@example.com`,
  p0: `participant0+${TESTRUNID}@example.com`,
  p1: `participant1+${TESTRUNID}@example.com`,
  p2: `participant2+${TESTRUNID}@example.com`,
};

function roster() {
  const mk = (key, roles, role) => ({ uid: `${TESTRUNID}_u_${key}`, profileid: PF[key], email: EMAIL[key], role: role || key, roles });
  const staff = [
    mk('admin', ['admin', 'ah'], 'admin'),
    mk('mover', ['admin', 'ah'], 'admin'),
  ];
  const participants = [
    mk('p0', ['participant'], 'participant'),
    mk('p1', ['participant'], 'participant'),
    mk('p2', ['participant'], 'participant'),
  ];
  return { staff, operators: [], participants };
}

// Routes the workshop specs navigate to (each needs a dashboard route-config grant for authGuard).
// /create-workshop and /workshopconfig/:id are UNGUARDED (app.routes.ts:260-261) — granted anyway for
// uniformity; the guard simply isn't consulted there.
const ROUTES = [
  { route: '/workshops', label: 'Workshops' },
  { route: '/create-workshop', label: 'Create Workshop' },
  { route: '/workshopconfig', label: 'Workshop Configuration' },
  { route: '/workshop_dashboard', label: 'Workshop Dashboard' },
  { route: '/engagementdashboard', label: 'Engagement Dashboard' },
  { route: '/bigengagementdashboard', label: 'Capacity / BIG Engagement Dashboard' },
  { route: '/productpageworkshop', label: 'Workshop Products' },
  { route: '/formtemplateworkshop', label: 'Form Template Workshop' },
  { route: '/workshop_image_upload', label: 'Workshop Image Upload' },
  // Legacy eiflix Workshop/* routes — granted so the deep-suite legacy route-mount smoke can reach them.
  { route: '/workshopchallengecreation', label: 'Workshop Challenge Creation' },
  { route: '/enrollment_config_view', label: 'Enrolment Config View' },
  { route: '/workshopchallengeparticipantdashboard', label: 'Workshop Challenge Participant Dashboard' },
  // 2026-09-04 addendum. Only three of the nine addendum routes actually carry `authGuard`
  // (/createworkshop 186, /bigeventmentor 294, /eiflixoperationsdashboard 295) — the other six are
  // declared with NO canActivate at all (app.routes.ts:286-297). Granting all nine keeps the grant
  // table uniform and self-documenting; the guard simply is not consulted on the unguarded six.
  { route: '/createworkshop', label: 'Legacy Eiflix Workshops' },              // GUARDED
  { route: '/bigeventmentor', label: 'B!G Event Mentor' },                      // GUARDED
  { route: '/eiflixoperationsdashboard', label: 'Eiflix Operations Dashboard' },// GUARDED
  { route: '/eiflixhomeconfig', label: 'Eiflix Home Config' },                  // unguarded
  { route: '/newusersprofile', label: 'New Users Profile' },                    // unguarded
  { route: '/eiflixdiscoverpage', label: 'Eiflix Discover Page' },              // unguarded
  { route: '/campaigndashboard', label: 'Campaign Dashboard' },                 // unguarded
  { route: '/wccalendar', label: 'Workshop / Campaign Calendar' },              // unguarded
];

// A two-curriculum challenge structure shared by the workshop-config doc AND the seeded participant
// workshop docs. Curriculum[0] has 2 sub-challenges (1 completed on p0 = 50%); the manual move-next
// (WS-12) marks the FIRST not-completed sub-challenge of the current curriculum completed.
function workshopChallenges() {
  return [
    {
      type: 'challenge',
      challengeid: `${TESTRUNID}_ch0`,
      heading: 'Module One',
      subheading: 'Foundations',
      challenges: [
        { type: 'video', challengeid: `${TESTRUNID}_ch0_s0`, heading: 'Intro Video', status: '' },
        { type: 'video', challengeid: `${TESTRUNID}_ch0_s1`, heading: 'Deep Dive', status: '' },
      ],
    },
  ];
}

/**
 * 2026-09-04 addendum seed — the nine previously-uncovered routes (WS-16..WS-33).
 * Split into its own function purely for readability; it is called at the end of seedWorkshops() and
 * shares the same run tag, so teardown is unchanged in shape.
 *
 * `at` is seedWorkshops' local-clock offset helper (used for campaign live/scheduled/ended, which the
 * app classifies with LOCAL accessors). `utcDay` is the calendar helper — /wccalendar stores all-day
 * dates at UTC midnight and reads them back through getUTC* accessors (wccalendar.component.ts:57-61),
 * so a local-midnight stamp would land the event on the wrong calendar day for any non-UTC runner.
 */
async function seedAddendum(db, T, tag, at) {
  const utcDay = (dayOffset) => {
    const now = new Date();
    return T.fromDate(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + dayOffset)));
  };

  // --- /createworkshop (legacy eiflix) -----------------------------------------------------------
  // view-workshop.component.html dereferences row.startdate/enddate/lastregistrationdate with a BARE
  // .toDate() (lines 22/27/32) — a doc missing ANY of the three throws on render and trips the console
  // guard. All three are mandatory here; `docid` is what deleteContent() keys the deleteDoc off (ts:88).
  const eiflixWorkshop = (id, title) => db.collection('eiflix workshop').doc(id).set({
    docid: id, title, description: `seeded legacy eiflix workshop ${title}`,
    startdate: at(3), enddate: at(10), lastregistrationdate: at(1), ...tag,
  });
  await eiflixWorkshop(ID.EW_KEEP, `Legacy Keep ${TESTRUNID}`);
  await eiflixWorkshop(ID.EW_DEL, `Legacy Delete ${TESTRUNID}`);

  // --- /eiflixhomeconfig -------------------------------------------------------------------------
  // ONE collection, partitioned CLIENT-SIDE by widgettype (upcomingworkshops.component.ts:129,133).
  // The 'ads' doc is the NEGATIVE CONTROL for WS-18: without it, "the comingsoon tab filtered the ads
  // out" is indistinguishable from "there were no ads docs". HW_CS_NOORDER carries NO `order` field —
  // orderOf() falls back to MAX_SAFE_INTEGER (ts:260), so it must render LAST (WS-19).
  await db.collection('eiflixhomewidgets').doc(ID.HW_CS1).set({
    docid: ID.HW_CS1, widgettype: 'comingsoon', order: 1, title: `HC First ${TESTRUNID}`,
    with: 'Coach A', type: 'Workshop', cost: '499', location: 'Online', totalseats: 30,
    unlimitedseat: false, confirmed: 5, showconfirmedseat: true, show: true, eventdate: at(4), ...tag,
  });
  await db.collection('eiflixhomewidgets').doc(ID.HW_CS2).set({
    docid: ID.HW_CS2, widgettype: 'comingsoon', order: 2, title: `HC Second ${TESTRUNID}`,
    with: 'Coach B', type: 'Masterclass', cost: '999', location: 'Chennai', totalseats: 20,
    unlimitedseat: false, confirmed: 2, showconfirmedseat: false, show: true, eventdate: at(6), ...tag,
  });
  await db.collection('eiflixhomewidgets').doc(ID.HW_CS_NOORDER).set({
    docid: ID.HW_CS_NOORDER, widgettype: 'comingsoon', /* order deliberately ABSENT */
    title: `HC Unordered ${TESTRUNID}`, with: 'Coach C', type: 'Webinar', cost: '0',
    location: 'Online', totalseats: 10, unlimitedseat: false, confirmed: 0,
    showconfirmedseat: false, show: false, eventdate: at(8), ...tag,
  });
  await db.collection('eiflixhomewidgets').doc(ID.HW_ADS).set({
    docid: ID.HW_ADS, widgettype: 'ads', order: 1, head: 'AD', headright: 'NEW',
    title: `HC AdOnly ${TESTRUNID}`, subtitle: 'seeded ad', description: 'ads-tab only',
    footer: 'footer', buttonname: 'Go', navigationlink: 'https://example.com/ad', show: true, ...tag,
  });
  await db.collection('eiflixhomeseries').doc(ID.HS_A).set({
    docid: ID.HS_A, title: `HC Series ${TESTRUNID}`, created: at(-2),
    homeseries: [{ title: 'Ep 1' }, { title: 'Ep 2' }, { title: 'Ep 3' }], ...tag,
  });

  // --- newusertags (segments, calendar types, locations) -----------------------------------------
  const tagDoc = (id, type, name) => db.collection('newusertags').doc(id).set({ docid: id, type, name, ...tag });
  await tagDoc(ID.NUT_SEGMENT, 'newusersegments', `WS Segment ${TESTRUNID}`);
  await tagDoc(ID.NUT_CAL_A, 'wccalendar', `WS CalType A ${TESTRUNID}`);
  await tagDoc(ID.NUT_CAL_B, 'wccalendar', `WS CalType B ${TESTRUNID}`);
  await tagDoc(ID.NUT_LOC, 'location', `WS Venue ${TESTRUNID}`);

  // --- /newusersprofile --------------------------------------------------------------------------
  // Rendered created-DESC (ts:305) → the app's row order must be A, B, C. NU_C is UNTAGGED: it is the
  // negative control for the WS-22 segment filter AND the WS-23 assign target (a reset helper clears
  // its tags before the write case so the assertion is on what the APP wrote).
  const newUser = (id, name, createdOffset, tags) => db.collection('new_user_data').doc(id).set({
    docid: id, name, email: `${id}@example.com`, phonenumber: '9999900001', countryCode: '+91',
    enable: true, created: at(createdOffset), tags, ...tag,
  });
  await newUser(ID.NU_A, `NU Alpha ${TESTRUNID}`, -1, [ID.NUT_SEGMENT]);
  await newUser(ID.NU_B, `NU Bravo ${TESTRUNID}`, -2, [ID.NUT_SEGMENT]);
  await newUser(ID.NU_C, `NU Charlie ${TESTRUNID}`, -3, []);

  // --- /eiflixdiscoverpage -----------------------------------------------------------------------
  // A SINGLE fixed-id doc the screen owns end to end (classify/eiflixdiscoverpage). `merge:true` on
  // save (ts:1196) is the behaviour WS-25 proves: we plant a SENTINEL field that the UI never touches,
  // edit a different field, and require the sentinel to survive. Not our doc by nature — teardown only
  // removes it when it still carries OUR run tag.
  await db.collection('classify').doc(ID.CLASSIFY_DOC).set({
    docid: ID.CLASSIFY_DOC,
    wsSentinel: `SENTINEL ${TESTRUNID}`,   // NOT one of the screen's allFields → never in the save
                                           // payload → must survive the merge untouched (WS-25)
    orientationbuttonname: `WS Orientation ${TESTRUNID}`, // a PLAIN-TEXT allFields key (textFields, ts:180) — WS-24 asserts
                                           // the input renders this, WS-25 overwrites it. Chosen over a
                                           // richFields key: those render as ngx-editor (ProseMirror)
                                           // contenteditables, not inputs.
    ...tag,
  }, { merge: true });

  // --- /bigeventmentor ---------------------------------------------------------------------------
  // EVT_NONBIG is the NEGATIVE CONTROL: the screen queries `event collection where atcmodel=='B!G'`
  // (ts:159), so the non-B!G title must NOT appear in the picker. JRN_BIG exists because ts:167 issues
  // `where('activejourney','in', this.bigjourney)` and Firestore THROWS on an empty `in` array — with
  // no B!G journey the screen errors before render and the failure mimics a UI bug (Risk #12).
  await db.collection('event collection').doc(ID.EVT_BIG).set({
    docid: ID.EVT_BIG, atcmodel: 'B!G', eventname: `BIG Event ${TESTRUNID}`,
    name: `BIG Event ${TESTRUNID}`, eventdate: at(5), ...tag,
  });
  await db.collection('event collection').doc(ID.EVT_NONBIG).set({
    docid: ID.EVT_NONBIG, atcmodel: 'NOT-BIG', eventname: `NonBIG Event ${TESTRUNID}`,
    name: `NonBIG Event ${TESTRUNID}`, eventdate: at(5), ...tag,
  });
  await db.collection('journey').doc(ID.JRN_BIG).set({
    docid: ID.JRN_BIG, atcmodel: 'B!G', journeyname: `BIG Journey ${TESTRUNID}`, ...tag,
  });
  // Put p0 into the B!G participant pool so the board resolves a NAME rather than falling back to the
  // raw profileid (`mapparticipant[id] || id`, bigeventmentor.html:137). `bigjourney` is built from the
  // journey DOC IDS (ts:163), so activejourney must be the journey doc id, not its name.
  await db.collection('participant metadata').doc(PF.p0).set({ activejourney: ID.JRN_BIG }, { merge: true });
  // p0 starts in `registered` and is ABSENT from `reached` — WS-29 drives the real move and asserts the
  // app wrote BOTH arrays (added to one, removed from the other).
  await db.collection('bigeventmentor').doc(ID.BEM).set({
    docid: ID.BEM, eventid: ID.EVT_BIG, eventname: `BIG Event ${TESTRUNID}`,
    reached: [], registered: [PF.p0], notregistered: [], noteligible: [],
    createdAt: new Date(), ...tag,
  });

  // --- /formtemplateworkshop (DEFAULT db only) ---------------------------------------------------
  // The screen is ENTIRELY query-param driven — bare /formtemplateworkshop renders nothing
  // (showcontent stays false) and in fact THROWS at ngAfterViewInit:260, which dereferences
  // `this.participantformtemplateid.formid` when no `?id=` is present. The ONE path that stays in the
  // DEFAULT db is `?id=<delivery forms docid>` with no `patchdata` (ts:260-290) — that is what WS-26
  // drives. The temporary_forms / formsByClient paths go through getFirestore('firestore-forms'), a
  // NAMED db the emulator cannot give rules to (Risk #11), so WS-27 skips there.
  //
  // Shape is dictated by the template: formname (h1), formdescription (p), and formarray[] — the
  // component walks formarray and registers a FormControl per non-label/video/audio entry (ts:270-284),
  // so a malformed entry throws before showcontent flips.
  await db.collection('delivery forms').doc(ID.DF_A).set({
    docid: ID.DF_A,
    formname: `WS Form ${TESTRUNID}`,
    formdescription: `Seeded delivery form for ${TESTRUNID}`,
    formfor: 'workshop',
    formarray: [
      { type: 'label', fieldname: `WS Form Section ${TESTRUNID}`, fielddescription: 'seeded section' },
      { type: 'text', fieldname: `WS Form Question ${TESTRUNID}`, fielddescription: 'seeded question', required: false },
    ],
    ...tag,
  });

  // --- /campaigndashboard ------------------------------------------------------------------------
  // Status and progress-% are NEVER stored — the app derives them (statusOf ts:188, pct ts:162). We seed
  // only DATES and the two money fields; the chip text and "75%" are values the app computed. Offsets
  // (not fixed dates) so the suite does not rot — the app compares against the client clock (Risk #15).
  const campaign = (id, name, startOff, endOff, expected, achieved, sales) =>
    db.collection('eiflixcampaign').doc(id).set({
      docid: id, campaignname: name, startdate: at(startOff), enddate: at(endOff),
      segment: ID.NUT_SEGMENT,             // resolved to the tag NAME by the app's join (ts:169)
      expectedsalevalue: expected, achievedsalesvalue: achieved, numberofsales: sales,
      channels: ['Email'], manualnotes: [], campaignassets: [], ...tag,
    });
  await campaign(ID.CAMP_LIVE, `Camp Live ${TESTRUNID}`, -2, 5, 200000, 150000, 12);   // → 75%
  await campaign(ID.CAMP_SCHED, `Camp Sched ${TESTRUNID}`, 10, 20, 100000, 0, 0);      // → 0%
  await campaign(ID.CAMP_ENDED, `Camp Ended ${TESTRUNID}`, -20, -5, 50000, 50000, 4);  // → 100%

  // --- /wccalendar -------------------------------------------------------------------------------
  // CAL_DELETED is the NEGATIVE CONTROL for the soft-delete filter (`deleted !== true`, ts:181): the doc
  // stays in Firestore and must never render. It shares CAL_SINGLE's day on purpose, so the same day
  // proves both halves — one event renders, its soft-deleted sibling does not.
  const calEvent = (id, title, startOff, endOff, extra) =>
    db.collection('workshopcampaigncalendar').doc(id).set({
      docid: id, title, type: ID.NUT_CAL_A, startdate: utcDay(startOff), enddate: utcDay(endOff),
      allday: true, location: ID.NUT_LOC, note: 'seeded', showinapp: true, repeat: 'none',
      repeatuntil: null, ...(extra || {}), ...tag,
    });
  await calEvent(ID.CAL_SINGLE, `Cal Single ${TESTRUNID}`, 3, 3);
  await calEvent(ID.CAL_SPAN, `Cal Span ${TESTRUNID}`, 5, 7);            // renders on 3 consecutive days
  await calEvent(ID.CAL_DELETED, `Cal Deleted ${TESTRUNID}`, 3, 3, { deleted: true });
  // Exactly 5 events on ONE day: MAX_CHIPS is 3 (ts:107), so the app renders 3 chips + "+2 more"
  // (ts:327,346). 2 is computed by the app from 5-3 and appears nowhere in this seed.
  for (let i = 0; i < CAL_STACK_IDS.length; i++) {
    await calEvent(CAL_STACK_IDS[i], `Cal Stack ${i + 1} ${TESTRUNID}`, 10, 10, { type: ID.NUT_CAL_B });
  }

  return {
    eiflixWorkshops: 2, homeWidgets: 4, homeSeries: 1, newusertags: 4, newUsers: 3,
    events: 2, journeys: 1, bigeventmentor: 1, deliveryForms: 1, campaigns: 3,
    calendarEvents: 3 + CAL_STACK_IDS.length,
  };
}

async function seedWorkshops() {
  const admin = initAdminAuto();
  const db = admin.firestore();
  const auth = admin.auth();
  const T = admin.firestore.Timestamp;
  const tag = TAG(TESTRUNID);

  const { staff, operators, participants } = roster();

  // 1) Auth chain for the custom roster (Auth users + user_data + profile_data + users_roles + the
  //    queue DRIVEN_ROUTES grants). Reused verbatim from the queue seeder.
  await seed.seedAuthChain(db, auth, TESTRUNID, { staff, operators, participants });

  // 2) Dashboard grants for THIS group's routes.
  const staffProfileIds = staff.map((s) => s.profileid);
  const allRoles = [...new Set(staff.flatMap((s) => s.roles))];
  const participantProfileIds = participants.map((p) => p.profileid);
  await seedDashboardRoutes(db, TESTRUNID, ROUTES, { staffProfileIds, allRoles, participantProfileIds });

  // --- refs / helpers ---
  const wsRef = (id) => db.collection('workshopconfiguration').doc(id);
  const at = (dayOffset, h = 9, m = 0) => { const d = new Date(); d.setDate(d.getDate() + dayOffset); d.setHours(h, m, 0, 0); return T.fromDate(d); };

  // 3) participant metadata for every enrolled profile — the dashboard progress table renders the
  //    participant NAME via mapProfile[profileid].name (workshop-dashboard.html:779); a missing name
  //    map throws on row render and trips the console guard. name/email/phonenumber are the fields the
  //    dashboard + comms paths read.
  const meta = (pf, name) => db.collection('participant metadata').doc(pf).set({
    docid: pf, profileid: pf, name, email: `${name.replace(/\s+/g, '.').toLowerCase()}@example.com`,
    phonenumber: '9999900000', countrycode: '+91', customerstatus: 'active', ...tag,
  });
  await meta(PF.p0, `WS Alpha ${TESTRUNID}`);
  await meta(PF.p1, `WS Bravo ${TESTRUNID}`);
  await meta(PF.p2, `WS Charlie ${TESTRUNID}`);

  // 4) WORKSHOP CONFIG DOCS. Every app doc stores its own id as `docid` (app-wide convention) — the
  //    workshops list toggles/duplicates key off workshop.docid (workshops.component.ts:198,241), NOT
  //    the idField. atcmodel:null keeps any ATC branch dead.
  // 4a) inactive, not-completed — pivot for the activate toggle (WS-04) + detail-page save (WS-05).
  await wsRef(ID.W_INACTIVE).set({
    docid: ID.W_INACTIVE, active: false, workshopcompleted: false, categorybased: false, atcmodel: null,
    created: at(-10), detailpage: {
      type: 'workshop', title: `Inactive Workshop ${TESTRUNID}`, shortdescription: 'seeded inactive',
      workshopStartDate: at(2), workshopEndDate: at(9),
      registrationStartDate: at(-5), registrationEndDate: at(1),
    }, ...tag,
  });
  // 4b) active — counted by the active-filter floor (WS-03).
  await wsRef(ID.W_ACTIVE).set({
    docid: ID.W_ACTIVE, active: true, workshopcompleted: false, categorybased: false, atcmodel: null,
    created: at(-8), detailpage: {
      type: 'workshop', title: `Active Workshop ${TESTRUNID}`, shortdescription: 'seeded active',
      workshopStartDate: at(1), workshopEndDate: at(8),
      registrationStartDate: at(-6), registrationEndDate: at(0),
    }, ...tag,
  });
  // 4c) dashboard pivot — carries challenges[] so the participant-workshop progress + move-next align.
  await wsRef(ID.W_DASH).set({
    docid: ID.W_DASH, active: true, workshopcompleted: false, categorybased: false, atcmodel: null,
    created: at(-6), detailpage: {
      type: 'workshop', title: `Dashboard Workshop ${TESTRUNID}`, shortdescription: 'seeded dashboard',
      workshopStartDate: at(-1), workshopEndDate: at(6),
      registrationStartDate: at(-7), registrationEndDate: at(-2),
    },
    challenges: workshopChallenges(), ...tag,
  });

  // 5) ENROLLMENT for the dashboard workshop. The dashboard reads `workshop participant enrolled` where
  //    workshopref==ref (status-agnostic for totalEnrolled), but the progress table only includes
  //    status==='enrolled' rows (rebuildProgressFromMap, ts:841). So p0 is 'enrolled' (shows progress +
  //    move-next), p1 is 'enrollednotstarted' (counted in totalEnrolled only).
  const dashRef = wsRef(ID.W_DASH);
  const pwARef = db.collection('participant workshop').doc(ID.PW_A);
  const pwBRef = db.collection('participant workshop').doc(ID.PW_B);

  await db.collection('workshop participant enrolled').doc(ID.ENR_A).set({
    docid: ID.ENR_A, profileid: PF.p0, status: 'enrolled', workshopref: dashRef,
    participantworkshopref: pwARef, enrollmentdate: at(-5), ...tag,
  });
  await db.collection('workshop participant enrolled').doc(ID.ENR_B).set({
    docid: ID.ENR_B, profileid: PF.p1, status: 'enrollednotstarted', workshopref: dashRef,
    participantworkshopref: pwBRef, enrollmentdate: at(-4), ...tag,
  });

  // participant workshop docs. p0: curriculum[0] has 2 sub-challenges, the FIRST completed → the app
  // computes progressPercentage = 1/2*100 = 50 (calculateParticipantProgress, ts:987). This is the
  // KNOWN precondition WS-11 asserts the RENDERED value against; WS-12 then drives the real move-next
  // and asserts the app WROTE manualcompletion:true on sub-challenge[1].
  const pwChallengesP0 = [
    {
      type: 'challenge', challengeid: `${TESTRUNID}_ch0`, heading: 'Module One',
      challenges: [
        { type: 'video', challengeid: `${TESTRUNID}_ch0_s0`, heading: 'Intro Video', status: 'completed' },
        { type: 'video', challengeid: `${TESTRUNID}_ch0_s1`, heading: 'Deep Dive', status: '' },
      ],
    },
  ];
  await pwARef.set({
    docid: ID.PW_A, profileid: PF.p0, workshopref: dashRef, workshopparticipantenrolledRef: db.collection('workshop participant enrolled').doc(ID.ENR_A),
    challenges: pwChallengesP0, created: at(-5), ...tag,
  });
  await pwBRef.set({
    docid: ID.PW_B, profileid: PF.p1, workshopref: dashRef, workshopparticipantenrolledRef: db.collection('workshop participant enrolled').doc(ID.ENR_B),
    challenges: workshopChallenges(), created: at(-4), ...tag,
  });

  // 6) PRODUCT PAGE doc — the productpageworkshop screen reads the SINGLE fixed-id doc
  //    `static meta data/Product Page` and renders products[] into a mat-table (product-page.component
  //    .ts:194-198). It does NOT exist on the test project (verified), and no other e2e suite seeds it,
  //    so we own it: seed a KNOWN products[] (run-tagged) and delete the doc in teardown. The product-page
  //    deep case asserts the app rendered exactly these product names (app read → table rows).
  await db.collection('static meta data').doc('Product Page').set({
    docid: 'Product Page',
    products: [
      { productname: `WS Product Alpha ${TESTRUNID}`, shortdescription: 'seeded product one', claimlink: 'https://example.com/a', buttonname: 'Claim A', productimage: '' },
      { productname: `WS Product Bravo ${TESTRUNID}`, shortdescription: 'seeded product two', claimlink: 'https://example.com/b', buttonname: 'Claim B', productimage: '' },
    ],
    ...tag,
  });

  // 7) 2026-09-04 addendum — the nine previously-uncovered routes (WS-16..WS-33).
  const addendum = await seedAddendum(db, T, tag, at);

  return {
    TESTRUNID, ID, PF, EMAIL,
    counts: { workshops: 3, enrolled: 2, participantWorkshops: 2, participantMeta: 3, products: 2, ...addendum },
  };
}

// Collections this seed writes (for teardown). The testrunid-scoped sweep catches our run-tagged docs
// (including the fixed-id `static meta data/Product Page` we seeded with this run's tag).
const SEEDED = [
  'workshopconfiguration', 'workshop participant enrolled', 'participant workshop', 'participant metadata',
  'static meta data',
  // auth-chain + dashboard (shared shape; testrunid-scoped so other runs are untouched)
  'user_data', 'profile_data', 'users_roles', 'dashboard',
  // 2026-09-04 addendum (WS-16..WS-33). All run-tagged, so the sweep is scoped to THIS run.
  'eiflix workshop', 'eiflixhomewidgets', 'eiflixhomeseries', 'newusertags', 'new_user_data',
  'classify', 'event collection', 'journey', 'bigeventmentor', 'bigeventparticipantsplan',
  'delivery forms', 'eiflixcampaign', 'workshopcampaigncalendar',
];

async function teardownWorkshops() {
  const admin = initAdminAuto();
  const db = admin.firestore();
  const n = await seed.teardownCollections(db, SEEDED, TESTRUNID);
  // Belt-and-suspenders: the Product Page doc is a single fixed-id doc WE own on the test project
  // (verified absent before our run). Delete it explicitly so re-seeds start clean even if the
  // testrunid-scoped sweep ever changes. Guarded: only delete if it still carries OUR run tag.
  const pp = await db.collection('static meta data').doc('Product Page').get();
  if (pp.exists && (pp.data() || {}).testrunid === TESTRUNID) {
    await db.collection('static meta data').doc('Product Page').delete().catch(() => {});
  }
  // Clean any enrollment docs the WS-08 enroll test created (app-written → NO testrunid; key by the
  // dashboard workshopref + the p2 profile that only the enroll test ever enrolls).
  const dashRef = db.collection('workshopconfiguration').doc(ID.W_DASH);
  for (const col of ['workshop participant enrolled', 'participant workshop']) {
    const snap = await db.collection(col).where('workshopref', '==', dashRef).where('profileid', '==', PF.p2).get().catch(() => ({ docs: [] }));
    for (const d of snap.docs) await d.ref.delete().catch(() => {});
  }
  // 2026-09-04 addendum cleanup for docs the APP writes (no testrunid on them, so the sweep misses):
  //  • eiflixdailywatchers — /eiflixoperationsdashboard writes a day-keyed rollup cache as a SIDE EFFECT
  //    of rendering (ts:1227/1247). The doc id is a shared day key, not run-scoped (Risk #14).
  //  • bigeventparticipantsplan — /bigeventmentor's move-to-level path creates per-participant docs.
  for (const col of ['eiflixdailywatchers', 'bigeventparticipantsplan']) {
    const snap = await db.collection(col).get().catch(() => ({ docs: [] }));
    for (const d of snap.docs) {
      const data = d.data() || {};
      // Only ours: either run-tagged, or keyed to this run's B!G event.
      if (data.testrunid === TESTRUNID || data.eventid === ID.EVT_BIG) await d.ref.delete().catch(() => {});
    }
  }
  // classify/eiflixdiscoverpage is a FIXED-id doc we do not own outright — remove it only while it still
  // carries OUR run tag (same guard as `static meta data/Product Page` above).
  const cls = await db.collection('classify').doc(ID.CLASSIFY_DOC).get().catch(() => ({ exists: false }));
  if (cls.exists && (cls.data() || {}).testrunid === TESTRUNID) {
    await db.collection('classify').doc(ID.CLASSIFY_DOC).delete().catch(() => {});
  }

  // Also delete the Auth users (emails carry the run id).
  const auth = admin.auth();
  for (const key of Object.keys(PF)) {
    await auth.deleteUser(`${TESTRUNID}_u_${key}`).catch(() => {});
  }
  return n;
}

module.exports = { TESTRUNID, ID, CAL_STACK_IDS, PF, EMAIL, ROUTES, SEEDED, MOVER_PID, seedWorkshops, teardownWorkshops };

if (require.main === module) {
  const mode = process.argv[2];
  (async () => {
    if (mode === '--seed') { const r = await seedWorkshops(); console.log('[seed-workshops] seeded', JSON.stringify(r.counts), 'run=', r.TESTRUNID); }
    else if (mode === '--teardown') { const n = await teardownWorkshops(); console.log('[seed-workshops] torn down', n, 'docs for run', TESTRUNID); }
    else { console.log('usage: seed-workshops.js --seed | --teardown'); process.exit(1); }
    process.exit(0);
  })().catch((e) => { console.error('FAILED:', e.message || e); process.exit(1); });
}
