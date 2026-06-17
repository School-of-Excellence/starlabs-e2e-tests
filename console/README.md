# StarLabs Release Console

A web app — the grown-up version of the hub's [`dashboard/`](../dashboard) — that **views and
orchestrates releases**, with **GitHub as the source of truth**. It mirrors GitHub via webhooks
into Firestore `release-candidates/{branch}` and adds the human workflow on top: review the
preview, mark **OK to Release**, open/approve PRs, and watch the board advance.

See [`docs/ARCHITECTURE.md` §7](../docs/ARCHITECTURE.md) for the full data model and lifecycle.

> **Scaffold status:** frontend skeleton only. Firebase wiring, sign-in, and the callable
> Cloud Functions are stubbed with `TODO(...)` markers. The board renders & is clickable
> **offline** in mock-data mode (the default), so it can be reviewed before any backend exists.

---

## What's here

```
console/
├─ src/
│  ├─ main.ts                         app bootstrap
│  ├─ index.html · styles.css         shell + dark palette (carried from dashboard/)
│  ├─ environments/
│  │  ├─ environment.ts               useMock flag + functions region
│  │  └─ firebase.config.example.ts   copy → firebase.config.ts with starlabs-cicd web config
│  └─ app/
│     ├─ app.component.ts             header (user / project pill / sign-out) + board
│     ├─ app.config.ts                providers — Firebase providers TODO block
│     ├─ core/
│     │  ├─ release-candidate.model.ts  RcStatus, ReleaseCandidate, RcNote, RcAction
│     │  ├─ auth.service.ts             user + approver allowlist (STUB role check)
│     │  ├─ firebase.service.ts         reads release-candidates + calls the 4 functions; MOCK mode
│     │  └─ mock-data.ts                one candidate per status for offline review
│     └─ board/
│        ├─ board.component.ts          card grid + status filter + action toast
│        ├─ release-card.component.ts   one card: repo, branch, chip, preview, report, notes, buttons
│        └─ status.ts                   chip colors + per-status / per-role action gating
├─ angular.json · tsconfig*.json · package.json
├─ firebase.json · .firebaserc        Firebase Hosting on starlabs-cicd
└─ .gitignore
```

### The board

Each card shows **repo · branch · status chip · preview URL · e2e report link · QA notes** and
four action buttons:

| Button | Calls (Cloud Function) | Enabled when |
|---|---|---|
| **Mark OK to Release** | `markOkToRelease` | status = `NO_ACTION` |
| **Create PR → dev** | `createPrToDev` | status = `OK_TO_RELEASE` |
| **Create PR → prod** | `createPrToProd` | status = `DEV_MERGED` |
| **Approve & Merge** | `approveAndMerge` | status ∈ {`PR_TO_DEV`, `PR_TO_PROD`} **and** user is an approver |

Buttons are disabled by **status** (the lifecycle gate in `board/status.ts`) **and** by the
signed-in user's **role** (approver allowlist in `core/auth.service.ts`). Both checks are also
re-enforced **server-side** in the Cloud Functions — the client gating is for UX only.

**Status chips** are color-coded:
`NO_ACTION` (grey) · `OK_TO_RELEASE` (green) · `PR_TO_DEV` (blue) · `DEV_MERGED` (deep blue) ·
`PR_TO_PROD` (amber) · `PROD_MERGED` (purple).

---

## Run locally (mock mode — no backend needed)

```bash
cd console
npm install --legacy-peer-deps   # --legacy-peer-deps required for Angular (ARCHITECTURE.md §4)
npm start                        # http://localhost:4200
```

`environment.useMock` defaults to `true`, so the board renders from
[`mock-data.ts`](src/app/core/mock-data.ts). Action buttons log the call they *would* make and
optimistically advance the card, so you can click through the whole lifecycle offline.

## Configure (connect to the real backend)

1. **Firebase web config.** In the Firebase Console for the **`starlabs-cicd`** project:
   Project settings → General → Your apps → Web app → SDK setup → Config. Then:
   ```bash
   cp src/environments/firebase.config.example.ts src/environments/firebase.config.ts
   # fill apiKey / messagingSenderId / appId (firebase.config.ts is gitignored)
   ```
2. **Wire the Firebase providers.** Uncomment the `firebaseProviders` block in
   [`app.config.ts`](src/app/app.config.ts) and the matching `httpsCallable` / `collectionData`
   blocks in [`firebase.service.ts`](src/app/core/firebase.service.ts).
3. **Sign-in.** Implement the Google popup in `auth.service.ts` / `app.component.ts` (the hub
   [`dashboard/index.html`](../dashboard/index.html) shows the `signInWithPopup` flow). Auth is
   restricted to the team.
4. **Approver allowlist.** Replace `APPROVER_ALLOWLIST_STUB` in `auth.service.ts` with the real
   source (e.g. a `console-config/approvers` Firestore doc), kept in sync with
   `.github/CODEOWNERS` (per ARCHITECTURE.md §8). The merge Cloud Function MUST enforce it
   server-side — the client list only governs button enablement.
5. **Flip the flag.** Set `useMock: false` in [`environment.ts`](src/environments/environment.ts).

> The four callable functions (`markOkToRelease`, `createPrToDev`, `createPrToProd`,
> `approveAndMerge`) and the `webhookReceiver` live in the console's backend on `starlabs-cicd`
> (isolated from the product `starlabs-cloud-function`). That backend is **out of scope** for
> this frontend scaffold.

## Deploy (Firebase Hosting on starlabs-cicd)

The console deploys to a dedicated Hosting site on the **`starlabs-cicd`** project.

```bash
# one-time: create the hosting site (id referenced by firebase.json + .firebaserc)
firebase hosting:sites:create starlabs-cicd-console --project starlabs-cicd
firebase target:apply hosting console starlabs-cicd-console --project starlabs-cicd

# build + deploy
npm run build
firebase deploy --only hosting --project starlabs-cicd
# or: npm run deploy
```

If you prefer a different site id, change it in **both** `firebase.json` (`hosting.site`) and
`.firebaserc` (`targets.starlabs-cicd.hosting.console`).
