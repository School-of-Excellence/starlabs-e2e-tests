/**
 * cicd-audit models (in-console report plan 2026-07-02 + master plan D1/D2).
 *
 * One `cicd-audit/<runId>` doc per (workflow run × suite) — a matrix run shares ONE githubRunId
 * across N suite docs, so the Report screen queries where('githubRunId'==…) and renders suite
 * tabs. `storage.reportJson` points at the machine-readable per-test report the screen renders;
 * `storage.report[]` lists every uploaded report file (screenshots/videos for the drawer).
 */

export interface CicdAuditRun {
  runId: string;
  repo: string;
  suite: string;
  stage: string;
  branch: string;
  sha: string;
  author: string;
  source: string;
  result: 'pass' | 'fail' | 'unknown' | string;
  githubRunId: string;
  cfRepo?: string;
  cfBranch?: string;
  runUrl?: string;
  createdAt: string;
  storage?: {
    base: string;
    report: string[];
    reportJson?: string;
    attachments: string[];
  };
}

// --- Parsed Playwright JSON report (merge-reports --reporter=json) -------------------------------

export interface ReportTestResult {
  status: string; // passed | failed | timedOut | skipped | interrupted
  duration: number;
  error?: { message?: string; stack?: string };
  errors?: { message?: string }[];
}

export interface ReportSpec {
  title: string;
  ok: boolean;
  tests: {
    expectedStatus?: string;
    status?: string;
    results: ReportTestResult[];
  }[];
}

export interface ReportSuite {
  title: string; // usually the spec file name
  file?: string;
  specs: ReportSpec[];
  suites?: ReportSuite[];
}

export interface ReportJson {
  suites: ReportSuite[];
  errors?: unknown[];
  stats?: {
    expected?: number;
    unexpected?: number;
    skipped?: number;
    flaky?: number;
    duration?: number;
  };
}

/** One flattened row for the Report screen tree: a test case with its outcome. */
export interface ReportCase {
  file: string;
  title: string;
  status: string; // passed | failed | skipped | flaky
  duration: number;
  errorMessage?: string;
}

/** Flatten the nested Playwright JSON into per-case rows (failures carry their error text). */
export function flattenReport(r: ReportJson): ReportCase[] {
  const out: ReportCase[] = [];
  const walk = (s: ReportSuite, file: string) => {
    const f = s.file ?? file ?? s.title;
    for (const spec of s.specs ?? []) {
      // A spec's outcome = its last result (retries overwrite); ok=false → failed.
      let status = spec.ok ? 'passed' : 'failed';
      let duration = 0;
      let errorMessage: string | undefined;
      for (const t of spec.tests ?? []) {
        for (const res of t.results ?? []) {
          duration += res.duration ?? 0;
          if (res.status === 'skipped' && spec.ok) status = 'skipped';
          const msg = res.error?.message ?? res.errors?.[0]?.message;
          if (msg && !spec.ok) errorMessage = msg;
        }
      }
      out.push({ file: f, title: spec.title, status, duration, errorMessage });
    }
    for (const child of s.suites ?? []) walk(child, f);
  };
  for (const s of r.suites ?? []) walk(s, s.file ?? s.title);
  return out;
}
