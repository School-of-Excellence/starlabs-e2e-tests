# 2026-10-16 — Communication Grid Planner redesign (surya-development): hooks back, first behavioural case

surya-development rewrote `communication-grid-planner.component.html`. The redesign adds event / search /
participant filters, duplicate, a per-day add button, a day side panel, and a new-communication popup.
The rewrite dropped every literal `cgp-*` hook. The gate blocked it twice: 8 selectors this spec drives
had gone, and 25 new controls had no hook.

## What the app side does now
- **Old names kept where the control survived**: `cgp-filter-event`, `cgp-toolbar-refresh`,
  `cgp-cal-prev-month` / `-next-month`, `cgp-lib-add-communication`, `cgp-lib-close-analytics`,
  `cgp-form-save` / `-cancel`. This spec's existing cases still address them.
- **New controls** get `cgp-filter-*`, `cgp-cal-*`, `cgp-form-*` and `cgp-side-*` hooks.
  `cgp-lib-send` and `cgp-email-recipients` became literal. The gate counts `[attr.data-testid]` bindings
  as unhooked, so the old per-doc versions blocked it.
- A commented-out duplicate "+ Add Communication" button was deleted. The scanner does not strip HTML
  comments, so dead markup counted as a new unhooked element.

## Why the seed looks like this (CGP-FLT-01)
- Two `communication planner` docs dated **today at noon**: `CGP Alpha <run>` and `CGP Bravo <run>`. The
  screen streams only the displayed month and buckets each doc by `date.toLocaleDateString()`. Noon today
  is inside the default month whatever the timezone, as long as the browser shares it with the seeder.
- **No eventref.** `selectedEvent` starts `null`, so the event filter is inactive and both docs render.
  The search is then the only rule being tested.
- **Bravo is the negative control.** Without it, "Alpha is still there" cannot tell a working filter from
  one that never ran.
- The route grant `/communication-grid-planner` was added to the comms ROUTES. `communication planner`
  was added to the teardown list.

## Status
Authored and listed, hooks aligned both ways, gate green. Not executed locally; the first run is CI.
