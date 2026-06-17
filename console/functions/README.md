# StarLabs Release Console — Backend (functions)

The Cloud Functions backend for the release console. **GitHub is the source of
truth**; this backend *mirrors* GitHub via a webhook and adds the human workflow
(OK-to-Release sign-off + console-gated, allowlisted PR create/merge).

Deploys to Firebase project **`starlabs-cicd`**, isolated from the product
`starlabs-cloud-function` (so it never mixes with product code or ATC).

> This is a **scaffold**. Search the source for `TODO` for every spot that needs
> a live credential. Nothing here is installed, deployed, or committed yet.

---

## What it exports (`src/index.ts`)

| Function | Type | Auth | What it does |
|---|---|---|---|
| `webhookReceiver` | HTTPS | GitHub HMAC | Verifies `X-Hub-Signature-256`, handles `push` / `pull_request` / `deployment_status` / `workflow_run`, and updates `release-candidates/{repo__branch}`. Derives the lifecycle. **Never** sets `OK_TO_RELEASE`. |
| `setOkToRelease` | callable | Firebase Auth + `okToRelease` allowlist | The one **manual** status: sets `OK_TO_RELEASE` + `okToReleaseBy`. |
| `createPullRequest` | callable | Firebase Auth + `okToRelease` allowlist | Opens a PR (feature→development or development→production) **as the GitHub App**. |
| `approveAndMerge` | callable | Firebase Auth + **per-branch** `approvers` allowlist | **Double-guarded** merge: (a) authenticated, (b) in the base-branch approver allowlist, (c) only then merges **as the App**. |

### Status lifecycle (derived, except the one manual step)

```
NO_ACTION → OK_TO_RELEASE → PR_TO_DEV → DEV_MERGED → PR_TO_PROD → PROD_MERGED
 (push,      (setOkToRelease  (PR opened   (PR merged   (PR opened   (PR merged
  auto)       — MANUAL)        webhook)     webhook)     webhook)     webhook)
```

Event → status mapping (`webhookReceiver`):
- `push` to a feature branch → ensure a `NO_ACTION` candidate exists (no regress).
- `push` to `development`/`production` → `DEV_MERGED` / `PROD_MERGED` (merge landing).
- `pull_request` opened (base `development`/`production`) → `PR_TO_DEV` / `PR_TO_PROD`.
- `pull_request` closed **and merged** → `DEV_MERGED` / `PROD_MERGED`.
- `deployment_status` → records `lastDeploymentState` (+ preview URL when present).
- `workflow_run` → links `reportRunId` (resolved against `cicd-audit` by the UI).

The data shape lives in [`src/model.ts`](src/model.ts) (`ReleaseCandidate`,
`ReleaseStatus`, `AllowlistConfig`).

---

## External wiring (do these once — automation cannot)

### 1. Register a GitHub App

Org **School-of-Excellence** → Settings → Developer settings → **GitHub Apps** →
**New GitHub App**.

- **Webhook URL**: the deployed `webhookReceiver` URL (see below) —
  `https://us-central1-starlabs-cicd.cloudfunctions.net/webhookReceiver`.
- **Webhook secret**: generate a strong random string; you will store it as
  `GITHUB_WEBHOOK_SECRET` (step 4). This is what the HMAC check verifies.
- **Repository permissions** (least privilege for this console):
  - **Contents**: Read & write (create the PR branch refs / merge).
  - **Pull requests**: Read & write (create + merge PRs).
  - **Deployments**: Read-only (consume `deployment_status`).
  - **Actions**: Read-only (consume `workflow_run`) — optional but recommended.
- **Subscribe to events**: `push`, `pull_request`, `deployment_status`,
  `workflow_run`.
- After creation, note the **App ID**, and **generate a private key** (`.pem`).

### 2. Install the App on the org

App → **Install App** → install on **School-of-Excellence**, granting access to
the four repos (at minimum `starlabs-angular`, `starlabs-cloud-function`,
`breakthroughs-flutter`, `starlabs-e2e-tests`). Note the **Installation ID**
(the number in the install settings URL, or `GET /orgs/{org}/installation`).

### 3. Non-secret runtime config

Copy `.env.example` → `.env` and fill:

```
GITHUB_ORG=School-of-Excellence
GITHUB_APP_ID=<App ID from step 1>
GITHUB_APP_INSTALLATION_ID=<Installation ID from step 2>
```

### 4. Secrets (Secret Manager, not committed)

```bash
firebase functions:secrets:set GITHUB_WEBHOOK_SECRET  --project starlabs-cicd
# paste the webhook secret from step 1

firebase functions:secrets:set GITHUB_APP_PRIVATE_KEY --project starlabs-cicd
# paste the FULL contents of the .pem private key from step 1
```

### 5. Firestore allowlist config

Create the single config doc the callables read. Path:
`console-config/allowlists`. Values may be Firebase Auth **uids** or **emails**.

```jsonc
// Firestore → console-config → allowlists
{
  "okToRelease": ["appexperience@soexcellence.com"],
  "approvers": {
    "development": ["appexperience@soexcellence.com"],
    "production":  ["appexperience@soexcellence.com"]   // can be stricter than dev
  }
}
```

> The production approver list is independent and intended to be **stricter**
> than development — this mirrors per-base-branch CODEOWNERS, enforced by the
> console too (defence in depth; see `docs/GOAL.md` §3).

### 6. Firebase Auth (team-restricted)

Enable a sign-in provider (e.g. Google) on `starlabs-cicd` and restrict the
console UI to the team. The callables additionally enforce the allowlists above,
so even an authenticated non-allowlisted user cannot sign off or merge.

---

## Deploy to `starlabs-cicd`

From `console/` (which carries `firebase.json` for the `console` codebase):

```bash
cd console/functions
npm install                     # not run by the scaffold
npm run build                   # tsc → lib/
cd ..
firebase deploy --only functions:console --project starlabs-cicd
```

(Or `npm run deploy` from `console/functions`, which builds then deploys.)

After the first deploy, copy the printed `webhookReceiver` URL back into the
GitHub App's **Webhook URL** (step 1) if it differs from the default above, then
redeliver the GitHub App's `ping` to confirm a `200`.

---

## Local development

```bash
npm install
npm run build
npm run serve     # functions emulator on starlabs-cicd project id
```

For the webhook, point a tunnel (e.g. `cloudflared` / `ngrok`) at the local
functions emulator and set that URL as a **second** webhook on the App during
testing, or use the GitHub App's "Redeliver" on recent deliveries.

---

## Security model recap ("console-gated, stay on Free")

The GitHub App is the **merge authority**. Developers are asked (policy) not to
merge directly. `approveAndMerge` double-guards before it ever calls GitHub:

1. **Firebase Auth** — the caller must be signed in.
2. **Per-branch approver allowlist** — the caller must be in
   `approvers[base]` (Firestore).
3. **App-authored merge** — only then does the function merge the PR *as the
   App*, and the resulting `pull_request` webhook reflects `DEV_MERGED` /
   `PROD_MERGED` (GitHub stays authoritative).
