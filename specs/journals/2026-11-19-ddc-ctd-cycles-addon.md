# 2026-11-19 — Delivery dashboard: CTD delivery sequence + cycle toggle, Add-on chips

App: starlabs-angular charan-release `4cdfd509`.

- **DDC-CTD-01 rewritten.** The CTD board is no longer five appointment columns: it is the full delivery sequence (4 forms,
  Diagnostics, Implementation 1 / 2, Review, Completion) in two versions. The case drives the new 1st / Next Cycle toggle
  (`ddc-ctd-cycle-first` / `-next`): the third column must swap My Evolution Wishlist → My Pocket ATC and nothing else.
  The column lists are app config; WHO lands in each column (deliverytype, submitted forms, attended appointments) needs a
  CTD world in the seed and stays deferred.
- **DDC-ADDR4** registers the Add-on count chips (`ddc-chip-addon`, `ddc-btn-addon`) — a behavioral case needs an
  `Addons` package seed.
