# 2026-10-02 — DDC-FLT-01/02 + JTED-09 (app dfdb6b57, mahalakshmi)

## Why the seed looks like this
- **DDC world (seedDdcStuck)** gains filter axes on the two rows the All tab shows: STALE (Stuck) = active ·
  regular · holds a second product; RECENT (Initiated – Not Consuming) = non active · defaulted · nothing else.
  Each filter therefore has exactly one row to keep and one to drop.
- **The parallel product is NDFU** (`DDC Parallel Product`) with a real participantsproduct row for STALE: NDFU so
  it never becomes a dashboard row of its own (the dashboard only reads DFU products), a real PP row so the
  metadata `activeproduct [P, P2]` is what productsdata_to_pmd would derive (CF-consistent).
- **FTO world** gets distinct `statusdate.initiated` per member (ONG 40d, DIAGDONE 30d, NOSTEPS 25d, NS 20d, DONE
  none) — JTED-09 asserts that exact order; the metadata insertion order (ONG, NS, DIAGDONE, …) differs, so a green
  run can only be the app's sort.

## Run (local emulator WITH functions, app charan-release 4ed20c1a on :4320)
DDC-FLT-01/02 + JTED-09 pass first run; full journey 87 pass (JP-20/JP-22 their usual `test.fail()`) / 28 skip / 0 fail.
