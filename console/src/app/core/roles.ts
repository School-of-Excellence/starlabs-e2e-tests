// Role → capability model for the release console (plan D1/D2, 2026-06-22).
//
// Roles are ADDITIVE: a member's effective capabilities are the UNION of the
// capabilities granted by each of their roles. The same person can be developer +
// tester + admin. Source of truth: Firestore `console-config/members/{email}`.
//
// This file is the FRONTEND copy. The backend keeps a structurally identical copy
// in functions/src/model.ts (Cloud Functions cannot import from the Angular src tree).
// Keep the two in sync.

/** The three roles an operator can assign in Settings. */
export type Role = 'developer' | 'tester' | 'admin';

/**
 * Capabilities gate ACTIONS. An action button is enabled only when ALL of:
 *   (1) the user is a signed-in active member on the allowed domain,
 *   (2) the user's roles grant the capability,
 *   (3) the candidate's workflow state allows the action,
 *   (4) the candidate is not stale (no unreviewed drift).
 * (3) and (4) live in status/freshness logic; this file covers (2).
 */
export type Capability =
  | 'DEPLOY_PREVIEW'        // developer/admin — fire the manual preview build
  | 'SIGNOFF_PREVIEW_DEV'   // tester/admin — "OK for dev" on the preview channel
  | 'SIGNOFF_DEV_PROD'      // tester/admin — "safe for prod" on the dev deploy
  | 'CREATE_PR_DEV'         // developer/admin — open PR feature → development
  | 'CREATE_PR_PROD'        // developer/admin — open PR development → production
  | 'MANAGE_MEMBERS';       // admin — Settings screen

/** The capability grant per role. (plan §2) NOTE: console NEVER merges (D3) — there is no merge capability. */
export const ROLE_CAPABILITIES: Record<Role, Capability[]> = {
  // Promotion to production is ADMIN-ONLY (D1, 2026-06-26): developers open feature→dev PRs from
  // Working Branches; only admins open development→production PRs from the Release Channel.
  developer: ['DEPLOY_PREVIEW', 'CREATE_PR_DEV'],
  tester: ['SIGNOFF_PREVIEW_DEV', 'SIGNOFF_DEV_PROD'],
  admin: [
    'DEPLOY_PREVIEW',
    'CREATE_PR_DEV',
    'CREATE_PR_PROD',
    'SIGNOFF_PREVIEW_DEV',
    'SIGNOFF_DEV_PROD',
    'MANAGE_MEMBERS',
  ],
};

/** Only this email domain may sign in (plan D2). */
export const ALLOWED_DOMAIN = 'soexcellence.com';

/**
 * Firestore `console-config/members/{email}` — the role source (plan §3.3).
 * Doc id is the LOWERCASED email (so the login gate and security rules can look it
 * up deterministically from the auth token).
 */
export interface Member {
  email: string;
  displayName?: string;
  roles: Role[];
  active: boolean;
  addedBy?: string;
  addedAt?: number;
}

/** The union of capabilities granted by a set of roles. */
export function capabilitiesFor(roles: readonly Role[]): Set<Capability> {
  const caps = new Set<Capability>();
  for (const r of roles) for (const c of ROLE_CAPABILITIES[r] ?? []) caps.add(c);
  return caps;
}

/** True if any of the given roles grants the capability. */
export function hasCapability(roles: readonly Role[], cap: Capability): boolean {
  return capabilitiesFor(roles).has(cap);
}

/** True if the email belongs to the allowed sign-in domain. */
export function isAllowedDomain(email: string | null | undefined): boolean {
  return !!email && email.toLowerCase().endsWith('@' + ALLOWED_DOMAIN);
}
