import { Injectable, signal } from '@angular/core';

/** Minimal view of the signed-in user the board needs. */
export interface ConsoleUser {
  email: string;
  displayName?: string;
}

/**
 * Auth + role gate for the console.
 *
 * Two checks matter for the board:
 *  - who is signed in (Firebase Auth, restricted to the team — ARCHITECTURE.md §7), and
 *  - whether they're an APPROVER (allowed to approve & merge into development/production).
 *
 * The console DOUBLES GitHub's branch-protection guard: it checks the approver's identity
 * before calling the merge Cloud Function (ARCHITECTURE.md §8). The Cloud Function re-checks
 * server-side — the client check is only to disable buttons; it is NOT a security boundary.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  /** Current user. In mock mode this is seeded so the board renders signed-in. */
  readonly user = signal<ConsoleUser | null>({
    email: 'reviewer@soexcellence.com',
    displayName: 'Mock Reviewer',
  });

  // TODO(auth): replace the seeded signal above with Firebase Auth state.
  //   constructor(private auth: Auth) {
  //     authState(this.auth).subscribe(u =>
  //       this.user.set(u ? { email: u.email!, displayName: u.displayName ?? undefined } : null));
  //   }

  /**
   * TODO(role): the approver allowlist is the source of truth for who may approve & merge.
   * It MUST be enforced server-side in the merge Cloud Function (read from config or a
   * Firestore `console-config/approvers` doc). This client list is a STUB — it only governs
   * button enablement and is duplicated here purely for UX. Keep it in sync with
   * .github/CODEOWNERS (per ARCHITECTURE.md §8, CODEOWNERS can differ per base branch).
   */
  private readonly APPROVER_ALLOWLIST_STUB = new Set<string>([
    'appexperience@soexcellence.com',
    // TODO: add real approver emails / load from console-config/approvers
  ]);

  /** True if the signed-in user is on the approver allowlist. STUB — see note above. */
  isApprover(): boolean {
    const email = this.user()?.email?.toLowerCase();
    return !!email && this.APPROVER_ALLOWLIST_STUB.has(email);
  }

  signOut(): void {
    // TODO(auth): call signOut(this.auth)
    this.user.set(null);
  }
}
