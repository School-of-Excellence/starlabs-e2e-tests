// chat.spec.ts — Group Chat (/group-chat): the REAL-UI sidebar-render, message-send and role-gate cases.
//
// SCREEN: /group-chat renders Events/Chat/group-chat-screen (hook prefix `gcs`) since app 2e329eb1 — it
// used to render chat-screen (`.chat-name` / `.chat-item` / `button.create-group-btn`), which is why this
// file was rewritten 2026-09-18 after comms run1 failed all three cases on the old selectors.
// Recon: e2e/recon-allcomp/comms-notifications.md (CN-09 / CN-08 / CN-17).
//
// What the screen does (group-chat-screen.component.ts):
//   · ngOnInit paints static DEMO rows, then bootstrapLive() resolves the user's profile_data (user_ref ==
//     user_data/{uid}); only then does it go live and REPLACE the demo rows with its own stream.
//   · loadGroups(): supportchat where type=='group' and isdelete==false, plus — for anyone who is NOT
//     chatxadmin/admin — where members array-contains uid. That filter is the screen's role gate.
//   · send() → writeMessage(): setDoc supportchat/{id}/messages/{id} {message, sender_uid, …} and
//     updateDoc on the group's last_* fields.
//
// Seeded world (seed-comms.js §5): `Seeded Group <run>` (type group, members admin/chatadmin/p0/p1,
//   group_admin [chatadmin] — posting needs member AND group_admin, canMessage; without it the thread shows
//   "Contact the group admin…" instead of a composer, which is how CN-08 failed on comms run 2).
//   chatadmin+<run>  roles {chatxadmin, admin}  → sees every group
//   staff+<run>      roles {eventcoordinator}   → granted /group-chat, member of NO group (negative control)
//
// ANTI-CIRCULARITY: the seed is a precondition. CN-09 asserts a row the APP rendered from its own query;
// CN-08 asserts the message the app rendered back and the message doc the APP wrote (text unique per run +
// timestamp, sender the app resolved); CN-17 asserts the app's query EXCLUDED a group for a non-member.
import { test, expect } from '@playwright/test';
import {
  commsIds, commsUids, installCommsStubs, loginAsChatAdmin, loginAsCommsStaff, resetChatGroup,
} from './support/comms';
import { attachConsoleGuard, assertNoFatal, ConsoleGuard } from '../queue/support/console-guard';
import { pollUntil } from '../queue/support/firestore-admin';

const RUN = process.env.COMM_RUNID || 'comm';
const GROUP_NAME = `Seeded Group ${RUN}`;

test.describe('Comms — group chat (real UI, anti-circular)', () => {
  let guard: ConsoleGuard;
  test.beforeEach(async ({ page }) => {
    guard = attachConsoleGuard(page);
    await installCommsStubs(page);
  });
  test.afterEach(() => assertNoFatal(guard, 'comms chat: no fatal console errors / pageerrors'));

  // ===========================================================================================
  // CN-09 — the seeded group renders in the group list (app built it from its live stream)
  // ===========================================================================================
  test('CN-09 the seeded group renders in the group list', async ({ page }) => {
    await resetChatGroup(); // precondition: ensure the group is active (isdelete:false) for re-runs
    await loginAsChatAdmin(page);
    await page.goto('/group-chat', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/group-chat/, { timeout: 30_000 });

    // [REAL-UI] a live row carries group_name. The name is run-unique, so a demo row can never satisfy it.
    const row = page.getByTestId('gcs-list-row').filter({ hasText: GROUP_NAME });
    await expect(row, 'CN-09: the seeded group must appear in the group list').toBeVisible({ timeout: 30_000 });
    await expect(row.locator('.wc-row-name'), 'CN-09: the row shows the group name').toHaveText(GROUP_NAME);
  });

  // ===========================================================================================
  // CN-08 — sending a message renders it back and the app writes the message doc
  // ===========================================================================================
  test('CN-08 sending a message renders it back in the thread', async ({ page }) => {
    await resetChatGroup();
    await loginAsChatAdmin(page);
    await page.goto('/group-chat', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/group-chat/, { timeout: 30_000 });

    // Open the seeded group (real click → openItem → subscribes to its messages).
    const row = page.getByTestId('gcs-list-row').filter({ hasText: GROUP_NAME });
    await expect(row, 'CN-08: the seeded group must be selectable').toBeVisible({ timeout: 30_000 });
    await row.click();

    const input = page.getByTestId('gcs-composer-input');
    await expect(input, 'CN-08: the composer must render once the group is open').toBeVisible({ timeout: 20_000 });

    // Unique text so neither the seeded last_message nor a prior run can satisfy the assertions.
    const text = `e2e ${RUN} ping ${Date.now()}`;
    await input.fill(text);
    // The send button only exists while the draft is non-empty (*ngIf draft.trim()).
    const send = page.getByTestId('gcs-composer-send');
    await expect(send, 'CN-08: send appears once text is typed').toBeEnabled({ timeout: 10_000 });
    await send.click();

    // [ASSERT] the thread shows the message …
    await expect(page.locator('.wc-bubble', { hasText: text }), 'CN-08: the sent message must render in the thread')
      .toBeVisible({ timeout: 30_000 });
    await expect(input, 'CN-08: the composer clears after sending').toHaveValue('');

    // … and the APP wrote it: the message doc (sender resolved by the app from the signed-in profile) …
    const msgs = await pollUntil(
      () => queryMessages(commsIds.CHAT_GROUP),
      (rows) => rows.some((m: any) => m.message === text),
      { label: 'CN-08: a supportchat message doc with the typed text', timeoutMs: 30_000 },
    );
    const mine = msgs.find((m: any) => m.message === text);
    expect(mine!.sender_uid, 'CN-08: sender_uid is the signed-in chat-admin').toBe(commsUids.chatadmin);
    expect(mine!.type, 'CN-08: a text-only message').toBe('text');
    // … and the group's preview fields (resetChatGroup put 'Seeded last message' there first).
    await pollUntil(() => getGroup(commsIds.CHAT_GROUP), (g) => g?.last_message === text,
      { label: 'CN-08: supportchat.last_message updated by the app', timeoutMs: 30_000 });
  });

  // ===========================================================================================
  // CN-17 — the group list is role-gated: a non-member, non-chat-admin staffer sees none of it
  // ===========================================================================================
  test('CN-17 a staffer who is neither chat-admin nor a member does not get the group', async ({ page }) => {
    await resetChatGroup();
    await loginAsCommsStaff(page);
    await page.goto('/group-chat', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/group-chat/, { timeout: 30_000 });

    // The staffer's screen went LIVE (profile_data resolved) and its membership-filtered query came back
    // empty: the empty state replaces the demo rows. Without this, "the group is absent" could equally
    // mean the screen never left demo mode.
    await expect(page.getByText('No groups yet — create one'), 'CN-17: the live, member-filtered list is empty')
      .toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('gcs-list-row').filter({ hasText: GROUP_NAME }),
      'CN-17: a non-member staffer must not see the seeded group').toHaveCount(0);
    // The control is not role-gated on this screen — it renders for the staffer too.
    await expect(page.getByTestId('gcs-header-create'), 'CN-17: the create control renders').toBeVisible();
  });
});

// ----- helpers: read the app's OUTPUT for the round-trip corroboration ---------------------------------
// eslint-disable-next-line @typescript-eslint/no-var-requires
const seed = require('../fixtures/seed-test-project');
async function queryMessages(chatId: string): Promise<any[]> {
  const db = seed.initAdmin().firestore();
  const snap = await db.collection('supportchat').doc(chatId).collection('messages').get();
  return snap.docs.map((d: any) => ({ id: d.id, ...d.data() }));
}
async function getGroup(chatId: string): Promise<any> {
  const snap = await seed.initAdmin().firestore().collection('supportchat').doc(chatId).get();
  return snap.exists ? snap.data() : null;
}
