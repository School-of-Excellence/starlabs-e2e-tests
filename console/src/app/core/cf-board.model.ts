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

/** Firestore `cf-functions/{name}` — one row per Cloud Function in the Dev/Prod matrix. */
export interface CfFunctionDoc {
  repo: string;
  name: string;
  type?: string;
  file?: string;
  codebase?: string;
  dev?: CfEnvDeploy;
  prod?: CfEnvDeploy;
  orphaned?: boolean;
  updatedAt: number;
}

/** DRIFT: deployed in both envs but from different shas (prod runs different code than dev). */
export function cfDrift(f: CfFunctionDoc): boolean {
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
  error?: string;
}
