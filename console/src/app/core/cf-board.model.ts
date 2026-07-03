/**
 * CF Board models (master plan 2026-07-02, L15–L19) — frontend mirror of the backend's
 * CfFunctionDoc (functions/src/model.ts) + the listCfBranches callable's response shape.
 */

export interface CfEnvDeploy {
  deployed: boolean;
  sha?: string;
  branch?: string;
  at?: number;
  by?: string;
  /** true when reconcilePoll's Cloud-Functions-API check healed this cell (not a postdeploy report). */
  healed?: boolean;
}

/** Where a function is deployed, collapsed (Option A, locked 2026-07-03). */
export type CfMatrixState = 'both' | 'dev-only' | 'prod-only' | 'none';

/** Firestore `cf-functions/{name}` — one row per Cloud Function in the Dev/Prod matrix. */
export interface CfFunctionDoc {
  repo: string;
  name: string;
  type?: string;
  file?: string;
  codebase?: string;
  dev?: CfEnvDeploy;
  prod?: CfEnvDeploy;
  /** DERIVED server-side at write time (Option A) — prefer these over recomputing. */
  state?: CfMatrixState;
  drift?: boolean;
  orphaned?: boolean;
  updatedAt: number;
}

/** Collapsed deploy state — stored value first (Option A), client derivation as legacy fallback. */
export function cfStateOf(f: CfFunctionDoc): CfMatrixState {
  if (f.state) return f.state;
  const d = !!f.dev?.deployed;
  const p = !!f.prod?.deployed;
  return d && p ? 'both' : d ? 'dev-only' : p ? 'prod-only' : 'none';
}

/** DRIFT: both envs deployed but different shas — stored value first, fallback derivation. */
export function cfDrift(f: CfFunctionDoc): boolean {
  if (typeof f.drift === 'boolean') return f.drift;
  return !!f.dev?.deployed && !!f.prod?.deployed && !!f.dev.sha && !!f.prod.sha && f.dev.sha !== f.prod.sha;
}

// --- listCfBranches response (Branches tab) ------------------------------------------------------

export interface CfChangedFunction {
  name: string;
  type: string;
  change: 'NEW' | 'UPDATED' | 'DELETED' | string;
}

export interface CfBranchInfo {
  name: string;
  lastCommit?: { sha?: string; msg?: string; author?: string; at?: number };
  /** Commits ahead of production — the "yet to deploy in production" signal. */
  aheadOfProd?: number;
  /** ~changed functions vs production (file-diff approximation, plan L19). */
  changedFunctions?: CfChangedFunction[];
  mergedToDev?: boolean;
  pr?: { number: number; url: string } | null;
  /** Commit LOG (newest first): each push's commits + CF names touched (lane-3, 2026-07-03). */
  commits?: { sha: string; msg?: string; author?: string; at?: number; changedFunctions?: string[] }[];
  error?: string;
}
