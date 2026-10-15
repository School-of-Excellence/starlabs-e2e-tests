# 2026-10-15 — /profilelist role filter (PL-RF-01)

App change: starlabs-angular `specs/journals/2026-10-15-profilelist-role-filter.md`. The screen gained a
multi-select "Filter by role" with a search box, a per-role count, and a clear button. Hooks are
`pl-role-filter`, `-search`, `-option`, `-count` and `-clear`, with the prefix `pl` for ProfilelistComponent.

## Why the seed looks like this
- **A role nobody else holds.** `pltester` is added to the role vocabulary (`starlabs roles/roles`) and
  given only to p2 through the auth chain. With a real role such as `admin` or `ah`, the filter's output
  would move whenever another suite seeds staff. A run-owned role keeps the result exact.
- **Negative control: p3**, a plain participant. It is visible before filtering and must be gone after.
  Without it, a green test could not tell "the filter ran" from "the table was already small".
- **Independent oracle.** The expected count is `users_roles where pltester == true`, read with the admin
  SDK. The option's count badge and the number of filtered rows are both checked against it, and neither
  is a value the test wrote.
- **Keyboard search.** ngx-mat-select-search renders a hidden input beside the visible one, so the case
  types into the auto-focused box (the same approach as SAS-06). `pl-role-search` is registered in PL-ADDR1.

## Routing note
The readiness gate matches the FIRST ci-ready suite in manifest order. `modes` claims
`src/app/Participants Profile Management/**` before `profiles` does, so a profilelist-only change selects
`modes` and not `profiles`. PL-RF-01 runs on full runs, or when `profiles` is dispatched explicitly.

## Status
Authored and listed (`--list`), and the hooks are aligned both ways. Not executed locally; the first run is in CI.
