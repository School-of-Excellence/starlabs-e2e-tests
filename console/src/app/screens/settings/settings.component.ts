import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FirebaseService } from '../../core/firebase.service';
import { AuthService } from '../../core/auth.service';
import { Member, Role, ALLOWED_DOMAIN } from '../../core/roles';
import { ToastService } from '../../shared/toast.service';

const ALL_ROLES: Role[] = ['developer', 'tester', 'admin'];

/** A locally-editable draft of a member row. */
interface MemberDraft {
  email: string;
  displayName: string;
  roles: Set<Role>;
  active: boolean;
  isNew: boolean;
  dirty: boolean;
}

/**
 * Settings (plan §6.4) — admin-only. Members table with role + active toggles and an
 * "Add member" row. Save → `setMember`. The whole screen renders nothing if !isAdmin()
 * (the route guard also redirects, this is defence-in-depth).
 */
@Component({
  selector: 'rc-settings',
  standalone: true,
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.css',
})
export class SettingsComponent {
  private readonly fb = inject(FirebaseService);
  readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);

  readonly domain = ALLOWED_DOMAIN;
  readonly roles = ALL_ROLES;
  readonly busy = signal<string | null>(null);

  private readonly members = toSignal(this.fb.members(), { initialValue: [] as Member[] });
  /** Local edit buffer keyed by email; rebuilt from the stream plus any in-progress new row. */
  private readonly localEdits = signal<Record<string, MemberDraft>>({});
  private readonly newRows = signal<MemberDraft[]>([]);

  readonly drafts = computed<MemberDraft[]>(() => {
    const edits = this.localEdits();
    const fromStream = this.members().map((m) => edits[m.email] ?? this.toDraft(m));
    return [...fromStream, ...this.newRows()];
  });

  readonly hasNewRow = computed(() => this.newRows().length > 0);

  private toDraft(m: Member): MemberDraft {
    return {
      email: m.email,
      displayName: m.displayName ?? '',
      roles: new Set(m.roles),
      active: m.active,
      isNew: false,
      dirty: false,
    };
  }

  private commit(m: MemberDraft): void {
    if (m.isNew) {
      this.newRows.update((rows) => rows.map((r) => (r === m ? { ...m } : r)));
    } else {
      this.localEdits.update((e) => ({ ...e, [m.email]: { ...m, dirty: true } }));
    }
  }

  toggleRole(m: MemberDraft, r: Role, on: boolean): void {
    const roles = new Set(m.roles);
    on ? roles.add(r) : roles.delete(r);
    this.commit({ ...m, roles, dirty: true });
  }
  toggleActive(m: MemberDraft, active: boolean): void {
    this.commit({ ...m, active, dirty: true });
  }
  setEmail(m: MemberDraft, email: string): void {
    this.newRows.update((rows) => rows.map((r) => (r === m ? { ...r, email, dirty: true } : r)));
  }
  setName(m: MemberDraft, displayName: string): void {
    this.newRows.update((rows) =>
      rows.map((r) => (r === m ? { ...r, displayName, dirty: true } : r)),
    );
  }

  addRow(): void {
    this.newRows.update((rows) => [
      ...rows,
      { email: '', displayName: '', roles: new Set<Role>(), active: true, isNew: true, dirty: false },
    ]);
  }

  valid(m: MemberDraft): boolean {
    return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(m.email) && m.email.toLowerCase().endsWith('@' + this.domain);
  }

  asValue(e: Event): string {
    return (e.target as HTMLInputElement).value;
  }
  asChecked(e: Event): boolean {
    return (e.target as HTMLInputElement).checked;
  }

  async save(m: MemberDraft): Promise<void> {
    const payload: Member = {
      email: m.email.toLowerCase(),
      displayName: m.displayName || undefined,
      roles: Array.from(m.roles),
      active: m.active,
      addedBy: this.auth.user()?.email,
      addedAt: Date.now(),
    };
    this.busy.set(m.email);
    try {
      const res = await this.fb.setMember(payload);
      this.toast.show(res.ok, res.message);
      if (res.ok) {
        if (m.isNew) this.newRows.update((rows) => rows.filter((r) => r !== m));
        else
          this.localEdits.update((e) => {
            const next = { ...e };
            delete next[m.email];
            return next;
          });
      }
    } finally {
      this.busy.set(null);
    }
  }
}
