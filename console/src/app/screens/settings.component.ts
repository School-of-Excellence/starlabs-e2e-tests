import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FirebaseService } from '../core/firebase.service';
import { AuthService } from '../core/auth.service';
import { Member, Role, ALLOWED_DOMAIN } from '../core/roles';
import { ToastService } from '../shared/toast.service';

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
  template: `
    @if (auth.isAdmin()) {
      <header class="head">
        <h2>Members & Roles</h2>
        <p class="muted">
          Roles are additive — a member's capabilities are the union of their roles.
          Only <code>&#64;{{ domain }}</code> accounts can sign in.
        </p>
      </header>

      <table>
        <thead>
          <tr>
            <th>Member</th>
            <th class="c">Developer</th>
            <th class="c">Tester</th>
            <th class="c">Admin</th>
            <th class="c">Active</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          @for (m of drafts(); track m.email) {
            <tr [class.inactive]="!m.active">
              <td>
                @if (m.isNew) {
                  <input
                    class="email-input"
                    type="email"
                    placeholder="name@{{ domain }}"
                    [value]="m.email"
                    (input)="setEmail(m, asValue($event))"
                  />
                  <input
                    class="name-input"
                    type="text"
                    placeholder="Display name"
                    [value]="m.displayName"
                    (input)="setName(m, asValue($event))"
                  />
                } @else {
                  <div class="name">{{ m.displayName || m.email }}</div>
                  <div class="email muted">{{ m.email }}</div>
                }
              </td>
              @for (r of roles; track r) {
                <td class="c">
                  <input
                    type="checkbox"
                    [checked]="m.roles.has(r)"
                    (change)="toggleRole(m, r, asChecked($event))"
                  />
                </td>
              }
              <td class="c">
                <input
                  type="checkbox"
                  [checked]="m.active"
                  (change)="toggleActive(m, asChecked($event))"
                />
              </td>
              <td class="c">
                <button
                  class="primary"
                  [disabled]="!m.dirty || !valid(m) || busy() === m.email"
                  (click)="save(m)"
                >
                  Save
                </button>
              </td>
            </tr>
          }
        </tbody>
      </table>

      @if (!hasNewRow()) {
        <button class="add" (click)="addRow()">+ Add member</button>
      }
    }
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .head h2 {
        margin: 0 0 4px;
        font-size: 20px;
      }
      .head p {
        margin: 0 0 18px;
        font-size: 13px;
      }
      table {
        width: 100%;
        border-collapse: collapse;
        background: var(--panel);
        border: 1px solid var(--border);
        border-radius: 10px;
        overflow: hidden;
      }
      th,
      td {
        padding: 12px 14px;
        text-align: left;
        border-bottom: 1px solid var(--border);
        font-size: 13px;
      }
      th {
        font-size: 11px;
        text-transform: uppercase;
        letter-spacing: 0.4px;
        color: var(--muted);
        background: var(--panel-2);
      }
      tbody tr:last-child td {
        border-bottom: none;
      }
      .c {
        text-align: center;
        width: 90px;
      }
      tr.inactive .name,
      tr.inactive .email {
        opacity: 0.5;
      }
      .name {
        font-weight: 600;
      }
      .email {
        font-size: 12px;
      }
      input[type='checkbox'] {
        accent-color: var(--accent);
        width: 16px;
        height: 16px;
        cursor: pointer;
      }
      .email-input,
      .name-input {
        display: block;
        width: 100%;
        background: var(--bg);
        border: 1px solid var(--border);
        color: var(--fg);
        border-radius: 6px;
        padding: 6px 9px;
        font-size: 13px;
        margin-bottom: 6px;
      }
      .email-input:focus,
      .name-input:focus {
        outline: none;
        border-color: var(--accent);
      }
      .add {
        margin-top: 14px;
      }
    `,
  ],
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
