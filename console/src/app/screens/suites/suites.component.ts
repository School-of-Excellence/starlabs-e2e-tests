import { Component, computed, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { FirebaseService } from '../../core/firebase.service';

interface SuiteRow {
  key: string;
  title: string;
  description: string;
  ciReady: boolean;
  capture: string;
  alwaysRun?: boolean;
  appPaths: string[];
  cfPaths: string[];
  reviewNote?: string;
  areas: string[];
}

interface SuiteDefRaw {
  title?: string;
  description?: string;
  ciReady?: boolean;
  capture?: string;
  alwaysRun?: boolean;
  appPaths?: string[];
  cfPaths?: string[];
  reviewNote?: string;
  areas?: Record<string, unknown>;
}

/**
 * Test Suites screen (operator flow, 2026-07-03) — a READ-ONLY view of the suites catalogue
 * mirror (`console-config/suites`). Shows every suite's routing globs (which app/CF file changes
 * LOCK it in the Test Run dialog), capture mode, sub-areas, cross-cutting set and the CF
 * predeploy gate. Editing happens ONLY via `suites-manifest.json` in the hub repo (PR → merge →
 * mirror) — this screen exists to SEE and review the map, never to change it.
 */
@Component({
  selector: 'rc-suites',
  standalone: true,
  imports: [DatePipe],
  templateUrl: './suites.component.html',
  styleUrl: './suites.component.css',
})
export class SuitesComponent {
  private readonly fb = inject(FirebaseService);

  /** ONE DOC PER SUITE stream (lane-1 lock 2026-07-03) + the slim meta doc. */
  private readonly suiteDocs = toSignal(this.fb.testSuites(), { initialValue: [] as Record<string, unknown>[] });
  readonly meta = toSignal(this.fb.suitesMeta(), { initialValue: null });

  readonly rows = computed<SuiteRow[]>(() =>
    this.suiteDocs()
      .map((d) => {
        const s = d as SuiteDefRaw & { key?: string };
        const key = (s.key as string) ?? '';
        return {
          key,
          title: s.title ?? key,
          description: s.description ?? '',
          ciReady: !!s.ciReady,
          capture: s.capture ?? 'failure-only',
          alwaysRun: s.alwaysRun,
          appPaths: s.appPaths ?? [],
          cfPaths: s.cfPaths ?? [],
          reviewNote: s.reviewNote,
          areas: Object.keys(s.areas ?? {}).filter((k) => !k.startsWith('_')),
        };
      })
      .sort((a, b) => Number(b.ciReady) - Number(a.ciReady) || a.key.localeCompare(b.key)),
  );

  readonly crossCutting = computed(() => {
    const cc = this.meta()?.crossCutting ?? {};
    return { app: cc?.appPaths ?? [], cf: cc?.cfPaths ?? [] };
  });

  readonly cfPredeploy = computed(() => this.meta()?.cfPredeploy ?? null);

  readonly reviewCount = computed(() => this.rows().filter((r) => r.reviewNote).length);
}
