/**
 * Repo registry (master plan 2026-07-02, L20) — the frontend mirror of functions/src/model.ts
 * REPO_TYPES. Drives per-repo UI affordances (CF repos: no preview/deploy; flutter: native
 * delivery) and every repo/branch picker, so future repos are one entry here + one in the
 * backend — no redesign.
 */

export type RepoType = 'web' | 'cloud-function' | 'flutter';

export const REPO_TYPES: Record<string, RepoType> = {
  'starlabs-angular': 'web',
  'starlabs-cloud-function': 'cloud-function',
  'breakthroughs-flutter': 'flutter',
};

export function repoTypeOf(repo: string): RepoType {
  return REPO_TYPES[repo] ?? 'web';
}

/** CF repos for the Test Run dialog's "CF source" picker (plan L4). */
export function cfRepos(): string[] {
  return Object.entries(REPO_TYPES)
    .filter(([, t]) => t === 'cloud-function')
    .map(([r]) => r);
}

export const DEFAULT_CF_REPO = 'starlabs-cloud-function';
/** Tests take CF from development by default (locked decision). */
export const DEFAULT_CF_BRANCH = 'development';
