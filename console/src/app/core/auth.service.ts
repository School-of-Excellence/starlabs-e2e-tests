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

    console.info('[auth] init — processing any pending redirect result…');
    getRedirectResult(this.auth)
      .then((cred) => {
        console.info('[auth] getRedirectResult →', cred ? `user ${cred.user.email}` : 'null (no pending redirect)');
      })
      .catch((e: any) => {
        console.error('[auth] redirect result error:', e?.code, e?.message);
        this.signInError.set(e?.message ?? 'Sign-in failed');
      });

    // React to auth state across tabs / reloads. The gate runs on every sign-in.
    authState(this.auth).subscribe((u) => {
      console.info('[auth] authState emitted:', u ? `user ${u.email} (uid ${u.uid})` : 'null (signed out)');
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
      console.info('[auth] gate: start for', email);

      // Check 1 — domain.
      if (!isAllowedDomain(email)) {
        console.warn('[auth] gate: REJECT — domain not allowed:', email);
        this.rejectAndSignOut(`Use your @${ALLOWED_DOMAIN} account to sign in.`);
        return;
      }

      // Check 2 — active member. One doc per member in the top-level CICD-Users
      // collection, id = lowercased email.
      console.info('[auth] gate: reading CICD-Users/' + email.toLowerCase());
      const snap = await getDoc(doc(this.fs, 'CICD-Users', email.toLowerCase()));
      console.info('[auth] gate: member doc exists =', snap.exists());
      if (!snap.exists()) {
        this.rejectAndSignOut('You are not authorized for the console. Ask an admin to add you.');
        return;
      }
      const m = snap.data() as Member;
      if (!m.active) {
        console.warn('[auth] gate: REJECT — member inactive');
        this.rejectAndSignOut('Your console access is inactive. Ask an admin to reactivate it.');
        return;
      }

      // Check 3 — load roles → grant access.
      this.member.set({ ...m, email: email.toLowerCase() });
      this.user.set({ email: email, displayName: u.displayName ?? undefined });
      this.signInError.set(null);
      console.info('[auth] gate: GRANTED — roles =', m.roles);
    } catch (e: any) {
      console.error('[auth] gate failed:', e?.code, e?.message, e);
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
      // Sign-in only works when the OAuth handler (environment.firebase.authDomain) is the
      // SAME ORIGIN as the app, or third-party storage is allowed. If authDomain is a
      // different origin (e.g. *.firebaseapp.com vs the app's hosting domain), modern
      // browsers isolate third-party storage, the popup can't post the credential back to
      // the opener, and Firebase surfaces auth/popup-closed-by-user even though the Google
      // sign-in itself succeeded. See specs/journals/2026-06-27-console-signin-fix.md.
      console.info('[auth] signIn: opening Google popup…');
      const cred = await signInWithPopup(this.auth, provider);
      console.info('[auth] signIn: popup resolved →', cred.user.email);
    } catch (e: any) {
      console.warn('[auth] signIn: popup failed', e?.code, e?.message);
      // Popup blocked OR the cross-origin handshake was severed (popup-closed-by-user):
      // fall back to the full-page redirect flow, which keeps every hop top-level.
      if (
        e?.code === 'auth/popup-blocked' ||
        e?.code === 'auth/cancelled-popup-request' ||
        e?.code === 'auth/popup-closed-by-user'
      ) {
        try {
          console.info('[auth] signIn: falling back to redirect flow…');
          this.checking.set(true);
          await signInWithRedirect(this.auth, provider);
          return; // page navigates away; getRedirectResult() finishes the gate on return
        } catch (e2: any) {
          this.checking.set(false);
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
