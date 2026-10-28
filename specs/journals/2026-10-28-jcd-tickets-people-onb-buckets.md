# 2026-10-28 — JCD-01 people-not-tickets; JCD-07 onboarding-by-product buckets

App: starlabs-angular `specs/journals/2026-10-28-pull-sashong-journeycoach.md`.

- **JCD-01.** The tickets tile now counts participants with at least one open `clientissue`. X had one
  open ticket and one closed, so "1 person" and "1 ticket" were the same number and the case could not
  tell the meanings apart. X now holds **two** open tickets and the tile must read 1. The closed ticket
  stays as the open-only negative control. JCH does not count X's tickets.
- **JCD-07.** There is no new seed; it reuses PJP_SLQ (product P2, assured, not onboarded, bought a minute
  ago), the JCD-05 entry point. That sale must be in To onboard and ≤7d, and NOT in 7+ d or Not assured
  (the negative controls). Each cell's number comes from `recomputeOnboardingProducts()`, and the list it
  opens is a separate filter over the bucket's source, so "rows == number" checks one code path against
  the other. The helper takes a `Locator` so the gate sees every `getByTestId` literal.
