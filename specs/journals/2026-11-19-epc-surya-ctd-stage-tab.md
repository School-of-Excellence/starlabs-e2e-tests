# 2026-11-19 — EPC (Surya features pull) hooks + delivery dashboard CTD stage tab

App: starlabs-angular charan-release `d4a9b052` (participation confirmations, Surya's new features only) and `fb978277`
(CTD D&I Appointment stage tab, Stages search + month columns).

- **events-controls-addressable.spec.ts**: `pf-row-revoke-attend` removed (Surya's single row Revoke now covers approved
  rows); `pf-bar-mark-attended` / `pf-bar-mark-restore` / `pf-bar-mark-notattended` (his buttons, renamed from another
  component's `epa-` prefix) and `epc-copy-link` registered. Finance / Customer status filters were kept in the app, so
  their refs stay.
- **delivery-dashboard-stuck.spec.ts DDC-CTD-01/02**: each Stages chip must render ITS board — CTD's five columns, and
  Starter Pack's ten with the month columns wired 1:1. The negative control is the switch: Starter Pack-only columns
  must vanish on CTD. No seed: the column list is config; card membership (CTD appointments) is deferred.
