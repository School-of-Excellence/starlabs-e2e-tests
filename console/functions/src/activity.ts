/**
 * Activity-log helpers (plan §3.2, D7/D9). The log is a single flat collection
 * `activity-log/{id}` queried by `branchId`, ordered by `eventTime`.
 *
 * Reliability primitives:
 *  - DEDUPE (risk #2): webhook entries use the GitHub `X-GitHub-Delivery` id as
 *    the doc id; a duplicate delivery overwrites the same idempotent doc.
 *  - ORDERING (risk #1): `eventTime` is the EVENT's own timestamp (not arrival),
 *    so a replay ordered by eventTime is stable regardless of webhook reordering.
 *  - INTENT vs FACT (risk #5): console intents are written with confirmed:false;
 *    the confirming webhook later appends a confirmed:true fact.
 */

import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { ActivityLogEntry, PATHS } from './model';

/**
 * Idempotently write a webhook activity entry keyed by delivery id.
 * Returns false if an entry with this delivery id already exists (duplicate
 * delivery — caller should skip all side effects).
 */
export async function appendWebhookActivity(
  deliveryId: string,
  entry: ActivityLogEntry,
): Promise<boolean> {
  const db = getFirestore();
  const ref = db.collection(PATHS.activityLog).doc(deliveryId);
  try {
    // `create` fails if the doc already exists → atomic dedupe.
    await ref.create(stripUndefined({ ...entry }));
    return true;
  } catch (err: unknown) {
    const code = (err as { code?: number | string })?.code;
    // Firestore ALREADY_EXISTS = 6 (gRPC) — a duplicate delivery.
    if (code === 6 || code === 'already-exists') return false;
    throw err;
  }
}

/**
 * Append a non-webhook activity entry (console intent or reconcile decision).
 * Auto-ids; not deduped (these are caller-initiated, one per click).
 */
export async function appendActivity(entry: ActivityLogEntry): Promise<string> {
  const db = getFirestore();
  const ref = await db.collection(PATHS.activityLog).add(stripUndefined({ ...entry }));
  return ref.id;
}

/** Firestore rejects `undefined`; drop undefined leaves before writing. */
function stripUndefined(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined) continue;
    if (v && typeof v === 'object' && !Array.isArray(v) && !(v instanceof Date)) {
      out[k] = stripUndefined(v as Record<string, unknown>);
    } else {
      out[k] = v;
    }
  }
  return out;
}

/** Re-export for callers that want a server timestamp on detail fields. */
export const serverTimestamp = FieldValue.serverTimestamp;
