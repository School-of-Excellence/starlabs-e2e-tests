import { Injectable, inject, signal } from '@angular/core';
import {
  Auth,
  authState,
  signInWithRedirect,
  getRedirectResult,
  GoogleAuthProvider,
  signOut,
  User,
} from '@angular/fire/auth';
import { Firestore, doc, getDoc } from '@angular/fire/firestore';

export interface ConsoleUser {
  email: string;
  displayName?: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly auth = inject(Auth);
  private readonly fs = inject(Firestore);

  readonly user = signal<ConsoleUser | null>(null);
  readonly signInError = signal<string | null>(null);
  private approverEmails = new Set<string>();

  constructor() {
    // Pick up the user if they return from a Google redirect.
    getRedirectResult(this.auth)
      .then((result) => {
        if (result?.user) this.applyUser(result.user);
      })
      .catch((e: any) => {
        console.error('[auth] redirect result error:', e?.code, e?.message);
        this.signInError.set(e?.message ?? 'Sign-in failed');
      });

    // Keep user in sync across tabs and on page reload.
    authState(this.auth).subscribe((u) => {
      if (u) {
        this.applyUser(u);
      } else {
        this.user.set(null);
        this.approverEmails.clear();
      }
    });
  }

  private applyUser(u: User): void {
    this.user.set({ email: u.email!, displayName: u.displayName ?? undefined });
    this.loadApprovers();
  }

  private async loadApprovers(): Promise<void> {
    try {
      const snap = await getDoc(doc(this.fs, 'console-config', 'allowlists'));
      if (!snap.exists()) return;
      const data = snap.data() as { approvers?: { development?: string[]; production?: string[] } };
      const all = [
        ...(data.approvers?.development ?? []),
        ...(data.approvers?.production ?? []),
      ];
      this.approverEmails = new Set(all.map((e) => e.toLowerCase()));
    } catch (e) {
      console.error('[auth] loadApprovers failed:', e);
    }
  }

  isApprover(): boolean {
    const email = this.user()?.email?.toLowerCase();
    return !!email && this.approverEmails.has(email);
  }

  async signIn(): Promise<void> {
    this.signInError.set(null);
    try {
      await signInWithRedirect(this.auth, new GoogleAuthProvider());
    } catch (e: any) {
      console.error('[auth] signIn failed:', e?.code, e?.message);
      this.signInError.set(e?.message ?? 'Sign-in failed');
    }
  }

  signOut(): void {
    signOut(this.auth);
    this.user.set(null);
  }
}
