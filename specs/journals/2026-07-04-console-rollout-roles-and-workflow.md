# 2026-07-04 — Release Console: Team Rollout (Roles, Access & Workflow)

**Audience:** developers, testers, admins on the School of Excellence CI/CD pipeline.
**Scope:** `starlabs-angular` (live). `starlabs-cloud-function` follows the *same* model once its
branch protection is set (pending). **Author:** session (operator: appexperience@soexcellence.com).

> This is the onboarding + operating guide. Read it before your first action in the console.

---

## 0. The one thing to understand first — there are TWO access systems

| System | Controls | Where it's set |
|---|---|---|
| **Console roles** | which **buttons** you can click in the console | Firestore members doc — an **admin** assigns roles in **Settings** |
| **GitHub branch protection** | who can **merge** a PR into `development` / `production` | GitHub repo → Branches (the merge **allow-list**) |

They are independent. You can have a console role *and* not be a GitHub merger, or vice-versa.
Sign-in to the console is **Google, `@soexcellence.com` only** — no other domain can log in.

---

## 1. The three roles and what each can do

Roles are **additive** — one person can be developer **+** tester **+** admin (capabilities union).

- **Developer**
  - ✅ **Deploy preview** (build a preview channel + run tests)
  - ✅ **Create PR → development**
  - ❌ cannot sign off, ❌ cannot create PR → production
- **Tester**
  - ✅ **OK for dev** (validate the preview channel)
  - ✅ **OK to promote** (validate the development deploy)
  - ❌ cannot deploy previews, ❌ cannot open PRs
- **Admin**
  - ✅ everything a developer + tester can do
  - ✅ **Create PR → production** (promotion is **admin-only**)
  - ✅ **Manage members** (Settings — add people, assign roles)

**Rule of thumb:** developers *build & propose*, testers *validate*, admins *promote to production & manage the team*.

---

## 2. GitHub merge access (the allow-list) — separate from console roles

- **No one** can `git push` directly to `development` or `production` — it is rejected.
- Every change reaches those branches **only via a PR that an allow-list member merges on GitHub**.
- Current mergers (`starlabs-angular`, `development` + `production`):
  `vignesh-027` · `CharanReddy-AH` · `GokulHavinashM` · `Nandakumar23`
- Admins/org-owners can also merge (GitHub can't exclude them) — treat as the trusted break-glass.
- **Feature branches are unrestricted** — anyone with Write access can create/push/commit to them.

---

## 3. Onboarding a new person (an **admin** does this)

- [ ] Person has a **`@soexcellence.com` Google account**.
- [ ] **GitHub access:** add them to the repo with **Write** role (lets them push feature branches + open PRs). *Do NOT give Admin/Maintain* unless they must merge — those roles bypass the merge allow-list.
- [ ] **If they should merge** dev/prod PRs → add their GitHub username to the branch-protection **allow-list** (repo → Settings → Branches → *Restrict who can push*).
- [ ] **Console role:** open the console → **Settings** → add the member by email → tick role(s): `developer` / `tester` / `admin`.
- [ ] Tell them to open the console and **Sign in with Google**. Their buttons appear based on their role.

---

## 4. The end-to-end workflow (who does what, in order)

**A. Developer — build & propose**
- Create a **feature branch** off `development` (e.g. `feature/<thing>` or `<name>-development`).
- Code → commit → **push the feature branch**. *(Never push to `development`/`production` — blocked.)*
- Console → **Deploy preview** → a preview channel builds and the **test suite** runs.

**B. Tester — validate the preview**
- Console → **Preview Channels** → open the preview URL + **View report**.
- If good → **OK for dev**. *(This unlocks the developer's "Create PR → dev".)*

**C. Developer — open the PR to development**
- Console → **Create PR → dev**. *The console opens the PR — it does **not** merge.*

**D. Merger (allow-list) — merge on GitHub**
- Review PR on GitHub → **Merge**.
- Card flips to **DEV MERGED** → `development` **auto-deploys** to `starlabs-test`.

**E. Tester — validate the dev deploy**
- Wait for the dev deploy to show **deployed** (success).
- Console → **Environment deploys** (top of Preview Channels) → **OK to promote**.
  *(Button stays hidden until the dev deploy succeeds — by design.)*

**F. Admin — promote to production**
- Console → **Release Channel** → **Create PR → production**. *(Admin-only.)*

**G. Merger (allow-list) — merge on GitHub**
- Review the `development → production` PR → **Merge**.
- `production` **auto-deploys** to `fir-sample`.

```
Developer            Tester           Developer        Merger          Tester            Admin           Merger
Deploy preview  →   OK for dev   →   Create PR→dev →  Merge (GH)  →   OK to promote  →  Create PR→prod → Merge (GH)
   (build+test)      (validate)       (console)        DEV MERGED      (validate deploy)  (console)        PROD deploy
```

---

## 5. Golden rules (do / don't)

- ✅ Do **all release actions through the console** — it mirrors GitHub and keeps everyone in sync.
- ✅ Every change to `development`/`production` goes through a **PR** (console creates it, allow-list merges it).
- ✅ Resolve merge **conflicts on the feature branch** (`git pull origin development`, fix, push) — never on the protected branch.
- ✅ **After every deploy, the tester re-validates** (a new deploy clears the prior sign-off).
- ❌ **Never `git push` to `development`/`production`** — it's rejected, and a CLI merge would leave the console blind (it tracks merges via PRs, not raw pushes).
- ❌ Don't hand out GitHub **Admin/Maintain** casually — it silently bypasses the merge allow-list.

---

## 6. Quick reference — role → action

| Action (console button) | Capability | Developer | Tester | Admin |
|---|---|:--:|:--:|:--:|
| Deploy preview | `DEPLOY_PREVIEW` | ✅ | — | ✅ |
| OK for dev | `SIGNOFF_PREVIEW_DEV` | — | ✅ | ✅ |
| Create PR → dev | `CREATE_PR_DEV` | ✅ | — | ✅ |
| OK to promote | `SIGNOFF_DEV_PROD` | — | ✅ | ✅ |
| Create PR → prod | `CREATE_PR_PROD` | — | — | ✅ |
| Manage members | `MANAGE_MEMBERS` | — | — | ✅ |
| **Merge dev/prod PR** | *(GitHub, not console)* | only if on the allow-list | only if on the allow-list | admins bypass |

---

## Pending / notes for the next session
- `starlabs-cloud-function` branch protection not yet applied — repeat §2 on its `development` branch
  (CF has no `production` branch by design; prod state = the Functions deploy matrix).
- Console↔GitHub role note: making someone a console `admin` does **not** grant GitHub merge rights —
  add them to the branch-protection allow-list separately.
- Doc drift to fix elsewhere: `CLAUDE.md` still references `approveAndMerge`/approver allowlist
  (removed under D3 — the console never merges).
