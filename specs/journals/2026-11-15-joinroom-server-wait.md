# 2026-11-15 — /joinroom server-wait coverage (LKJ-01..03)

**App change:** starlabs-angular `feature/openvidu-call-fixes` — OpenVidu call fixes plan
(`specs/plans/2026-11-14-openvidu-call-fixes.md`, items 2.1, 2.1b, 2.2, 3.1). Spec:
`queue/join-livekit-server-wait.spec.ts`, hook prefix `lkj`.

## Why the seed looks like this

- **`OCI_System/instance_status` is now seeded** (baseline: running, `healthy: 1, ready: 1`).
  OCI has been the active cloud since 2026-08-12 and the join screen defaults a room without
  `mediaProvider` to `oci`, so every seeded `/joinroom` (SS-11b included) gates on the OCI doc,
  which was never seeded — only `AWS_System` was. `ready` is new: the app now waits for a ready
  media node instead of a running VM.
- **The spec writes that doc mid-test.** It stands in for the 5-minute `CheckOciNodeStatus` job
  (the only production writer); a status change is the stimulus being tested, so it cannot live
  in the seed. Cases run `serial` and `afterEach` restores `OCI_STATUS_BASELINE` (exported from the
  seeder so the two can't drift). A parallel SS-11b during the ~10 s window would wait, then resume.
- **Negative controls:** stopped → the error branch and the pre-join must be absent;
  `healthy: 1, ready: 0` → must keep waiting (the bug 3.1 fixed); while the token retries, no join error.
- **Oracles:** the `waitingForServerAt` field the app writes (the test seeds it as `null`), and the
  token request count at the network boundary.

## Not driven (LKJ-ADDR1 fixme)

`lkj-server-failed` (20-min limit), `lkj-server-check` (momentary), `lkj-join-error`,
`lkj-enablesound` (needs a real LiveKit connection).

## Status

`--list` registers 4 cases; `hook-diff` aligned for `src/app/LiveKit` and `src/app/OpenVidu`.
**Never executed** — per operator rule suites run once, right before the push. The first real run
is the pre-push run (or the gate). Land order: app hooks first, then this spec.
