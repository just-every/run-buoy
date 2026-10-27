# Synthetic ChurnZero account mapping example

`accounts.csv` is a synthetic twenty-account CSV for the explicit column mapper. The headers are an example mapping contract, not a verified ChurnZero export schema. No customer export or versioned vendor schema was supplied. Select and review the actual headers from your export; the mapper never guesses them or supplies missing contract terms.

The fixture has explicit account identities, names, renewal dates, notice periods, contract references and invoice snapshots. `ChurnScore`, `ChurnScore Factors`, `Journey` and `Contact` are deliberately unmapped source columns. Their values remain in the retained original CSV; review names each unsupported column for each source account. They create no native health measures, customer people or journeys. In particular, retained journey labels are not paused Buoy journeys and establish no steps or execution authority.

MIGRATE-002 stays partial. Native contacts, ChurnScores and factors, tasks, plays, success plans, paused journeys with definition mapping, events, NPS, API intake and full source-schema verification remain required. These bytes are used only for deliberate review or tests and are never imported automatically.
