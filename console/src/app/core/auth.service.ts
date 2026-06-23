import { Injectable, inject, signal, computed } from '@angular/core';
import {
  Auth,
  authState,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  GoogleAuthProvider,
  signOut,
  User,
} from '@angular/fire/auth';
import { Firestore, doc, getDoc } from '@angular/fire/firestore';
import { environment } from '../../environments/environment';
import {
  Member,
  Role,
  Capability,
  ALLOWED_DOMAIN,
  isAllowedDomain,
  hasCapability,
} from './roles';

export interface ConsoleUser {
  email: string;
  displayName?: string;
}

/**
 * Login gate + role/capability source (plan D1/D2, 2026-06-22).
 *
 * THREE checks before access is granted:
 *   1. email domain == soexcellence.com
 *   2. an ACTIVE member doc exists at console-config/members/{lowercased email}
 *   3. load that member's roles → the UI unlocks capabilities accordingly
 *
 * These checks are ALSO enforced in Firestore security rules + the callables; this
 * service is for UX (gate the shell, gate the buttons). Failing 1 or 2 signs the user
 * back out with an explanatory error.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly auth = inject(Auth);
  private readonly fs = inject(Firestore);

  /** The signed-in + authorized user, or null. */
  readonly user = signal<ConsoleUser | null>(null);
  /** The resolved member record (roles, active), or null until loaded/authorized. */
  readonly member = signal<Member | null>(null);
  readonly signInError = signal<string | null>(null);
  /** True between popup return and gate resolution, so the shell can show a spinner. */
  readonly checking = signal<boolean>(false);

  /** Effective roles of the signed-in member. */
  readonly roles = computed<Role[]>(() => this.member()?.roles ?? []);

  constructor() {
    // Offline mock mode (environment.useMock): auto-authorize a full-capability member
    // so the console is fully clickable with zero Firebase/auth setup (CLAUDE.md).
    if (environment.useMock) {
      this.member.set({
        email: 'mock@soexcellence.com',
        displayName: 'Mock User',
        roles: ['developer', 'tester', 'admin'],
        active: true,
      });
      this.user.set({ email: 'mock@soexcellence.com', displayName: 'Mock User' });
      return;
    }

    getRedirectResult(this.auth).catch((e: any) => {
      console.error('[auth] redirect result error:', e?.code, e?.message);
      this.signInError.set(e?.message ?? 'Sign-in failed');
    });

    // React to auth state across tabs / reloads. The gate runs on every sign-in.
    authState(this.auth).subscribe((u) => {
      if (u) {
        void this.gate(u);
      } else {
        this.user.set(null);
        this.member.set(null);
      }
    });
  }

  /** Run the 3-check login gate; reject (sign out) on failure. */
  private async gate(u: User): Promise<void> {
    this.checking.set(true);
    try {
      const email = u.email ?? '';

      // Check 1 — domain.
      if (!isAllowedDomain(email)) {
        this.rejectAndSignOut(`Use your @${ALLOWED_DOMAIN} account to sign in.`);
        return;
      }

      // Check 2 — active member. One doc per member in the top-level CICD-Users
      // collection, id = lowercased email.
      const snap = await getDoc(doc(this.fs, 'CICD-Users', email.toLowerCase()));
      if (!snap.exists()) {
        this.rejectAndSignOut('You are not authorized for the console. Ask an admin to add you.');
        return;
      }
      const m = snap.data() as Member;
      if (!m.active) {
        this.rejectAndSignOut('Your console access is inactive. Ask an admin to reactivate it.');
        return;
      }

      // Check 3 — load roles → grant access.
      this.member.set({ ...m, email: email.toLowerCase() });
      this.user.set({ email: email, displayName: u.displayName ?? undefined });
      this.signInError.set(null);
    } catch (e: any) {
      console.error('[auth] gate failed:', e);
      this.rejectAndSignOut('Could not verify your access. Try again.');
    } finally {
      this.checking.set(false);
    }
  }

  private rejectAndSignOut(message: string): void {
    this.signInError.set(message);
    this.member.set(null);
    this.user.set(null);
    void signOut(this.auth);
  }

  // --- capability helpers used to gate the UI -----------------------------------

  hasCapability(cap: Capability): boolean {
    return hasCapability(this.roles(), cap);
  }
  isDeveloper(): boolean {
    return this.roles().includes('developer');
  }
  isTester(): boolean {
    return this.roles().includes('tester');
  }
  isAdmin(): boolean {
    return this.roles().includes('admin');
  }

  async signIn(): Promise<void> {
    this.signInError.set(null);
    const provider = new GoogleAuthProvider();
    // Hint Google to the org domain (defence-in-depth; the gate still verifies).
    provider.setCustomParameters({ hd: ALLOWED_DOMAIN, prompt: 'select_account' });
    try {
      // Popup is reliable on localhost. (signInWithRedirect breaks when the browser
      // blocks the third-party cookies the Firebase auth handler needs.) The authState
      // subscription runs the 3-check gate on the returned user.
      await signInWithPopup(this.auth, provider);
    } catch (e: any) {
      // If the popup is blocked, fall back to the redirect flow.
      if (e?.code === 'auth/popup-blocked' || e?.code === 'auth/cancelled-popup-request') {
        try {
          await signInWithRedirect(this.auth, provider);
          return;
        } catch (e2: any) {
          e = e2;
        }
      }
      console.error('[auth] signIn failed:', e?.code, e?.message);
      this.signInError.set(this.friendlyAuthError(e));
    }
  }

  /** Translate common Firebase Auth error codes into actionable messages. */
  private friendlyAuthError(e: any): string {
    switch (e?.code) {
      case 'auth/operation-not-allowed':
        return 'Google sign-in is not enabled for this project. Enable it in Firebase → Authentication → Sign-in method.';
      case 'auth/unauthorized-domain':
        return 'This domain is not authorized. Add it in Firebase → Authentication → Settings → Authorized domains.';
      case 'auth/popup-closed-by-user':
        return 'Sign-in was cancelled.';
      default:
        return e?.message ?? 'Sign-in failed.';
    }
  }

  signOut(): void {
    void signOut(this.auth);
    this.user.set(null);
    this.member.set(null);
  }
}
